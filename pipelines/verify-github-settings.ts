import { readFileSync } from "node:fs";

import {
  branchApiSnapshot,
  classifyProviderFailure,
  compareRepositorySettings,
  observed,
  protectionApiSnapshot,
  releasesApiSnapshot,
  repositoryApiSnapshot,
  rulesetsApiSnapshot,
  unavailable,
  type DesiredRepositorySettings,
  type EndpointDiagnostic,
  type LiveRepositorySettings,
  type Observation,
  type ProviderFailure,
} from "./github-repository-settings.ts";

interface EndpointResult {
  readonly endpoint: string;
  readonly status: number;
  readonly ok: boolean;
  readonly data: unknown;
  readonly message: string;
}

const DEFAULT_REPOSITORY = "SouthernGentlemen/FightLab";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function repositoryName(): string {
  return argument("--repo") ?? process.env.GITHUB_REPOSITORY ?? DEFAULT_REPOSITORY;
}

function optionalToken(): string | undefined {
  return process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
}

function providerMessage(data: unknown, fallback: string): string {
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    const message = (data as Record<string, unknown>).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

async function readEndpoint(endpoint: string, token: string | undefined): Promise<EndpointResult> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "FightLab-live-settings-verifier",
  };
  if (token !== undefined) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(endpoint, { headers });
    const text = await response.text();
    let data: unknown = null;
    if (text.length > 0) {
      try {
        data = JSON.parse(text) as unknown;
      } catch {
        data = text;
      }
    }
    return {
      endpoint,
      status: response.status,
      ok: response.ok,
      data,
      message: providerMessage(data, response.statusText),
    };
  } catch (error) {
    return {
      endpoint,
      status: 0,
      ok: false,
      data: null,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function failure(result: EndpointResult): ProviderFailure {
  return classifyProviderFailure(result.endpoint, result.status, result.message);
}

function diagnostic(result: EndpointResult): EndpointDiagnostic {
  if (result.ok) {
    return {
      endpoint: result.endpoint,
      status: result.status,
      state: "observed",
      message: "provider read succeeded",
    };
  }
  if (result.status === 404 && /branch not protected/i.test(result.message)) {
    return {
      endpoint: result.endpoint,
      status: result.status,
      state: "observed",
      message: result.message,
    };
  }
  const reason = failure(result);
  return {
    endpoint: result.endpoint,
    status: result.status,
    state: reason.state,
    kind: reason.kind,
    message: reason.message,
  };
}

function observation<T>(result: EndpointResult, map: (data: unknown) => T): Observation<T> {
  return result.ok ? observed(map(result.data)) : unavailable(failure(result));
}

function formatObservation<T>(value: Observation<T>): string {
  return value.state === "observed"
    ? (JSON.stringify(value.value) ?? "undefined")
    : `${value.state} (${value.reason.kind}, HTTP ${value.reason.status}): ${value.reason.message}`;
}

async function main(): Promise<void> {
  const repository = repositoryName();
  const token = optionalToken();
  const [owner, name, extra] = repository.split("/");
  if (!owner || !name || extra !== undefined) {
    throw new Error(`expected --repo owner/name, received ${repository}`);
  }

  const base = `https://api.github.com/repos/${owner}/${name}`;
  const branchName = "main";
  const endpoints = {
    repository: base,
    branch: `${base}/branches/${encodeURIComponent(branchName)}`,
    protection: `${base}/branches/${encodeURIComponent(branchName)}/protection`,
    rulesets: `${base}/rulesets`,
    releases: `${base}/releases?per_page=100`,
  };

  const [repoResult, branchResult, protectionResult, rulesetsResult, releasesResult] = await Promise.all([
    readEndpoint(endpoints.repository, token),
    readEndpoint(endpoints.branch, token),
    readEndpoint(endpoints.protection, token),
    readEndpoint(endpoints.rulesets, token),
    readEndpoint(endpoints.releases, token),
  ]);

  const repoSnapshot = repoResult.ok ? repositoryApiSnapshot(repoResult.data) : null;
  let branchProtection: LiveRepositorySettings["branchProtection"];
  if (branchResult.ok) {
    branchProtection = observed(branchApiSnapshot(branchResult.data));
  } else if (protectionResult.ok) {
    branchProtection = observed(protectionApiSnapshot(protectionResult.data));
  } else if (protectionResult.status === 404 && /branch not protected/i.test(protectionResult.message)) {
    branchProtection = observed({ protected: false, requiredChecks: [] });
  } else {
    branchProtection = unavailable<import("./github-repository-settings.ts").BranchProtectionSnapshot>(
      failure(branchResult),
    );
  }

  const mergeMethods = repoSnapshot === null
    ? unavailable<readonly import("./github-repository-settings.ts").MergeMethod[]>(failure(repoResult))
    : repoSnapshot.mergeMethods === null
      ? unavailable<readonly import("./github-repository-settings.ts").MergeMethod[]>({
          state: "inaccessible",
          kind: "field-unavailable",
          endpoint: endpoints.repository,
          status: repoResult.status,
          message: "repository response omitted merge-method policy fields for this credential",
        })
      : observed(repoSnapshot.mergeMethods);

  const live: LiveRepositorySettings = {
    visibility: repoSnapshot === null ? unavailable<string>(failure(repoResult)) : observed(repoSnapshot.visibility),
    defaultBranch: repoSnapshot === null ? unavailable<string>(failure(repoResult)) : observed(repoSnapshot.defaultBranch),
    branchProtection,
    mergeMethods,
    rulesets: observation(rulesetsResult, rulesetsApiSnapshot),
    releases: observation(releasesResult, releasesApiSnapshot),
    diagnostics: [repoResult, branchResult, protectionResult, rulesetsResult, releasesResult].map(diagnostic),
  };

  const desired = JSON.parse(
    readFileSync(new URL("../config/github-repository-settings.json", import.meta.url), "utf8"),
  ) as DesiredRepositorySettings;
  const comparisons = compareRepositorySettings(desired, live);
  const json = process.argv.includes("--json");

  if (json) {
    console.log(JSON.stringify({
      repository,
      authentication: token === undefined ? "anonymous-public-read" : "runtime-token-present-value-redacted",
      live,
      comparisons,
    }, null, 2));
  } else {
    console.log(`Repository: ${repository}`);
    console.log(`Authentication: ${token === undefined ? "anonymous public read" : "runtime token present (value redacted)"}`);
    console.log(`Visibility: ${formatObservation(live.visibility)}`);
    console.log(`Default branch: ${formatObservation(live.defaultBranch)}`);
    console.log(`Main protection: ${formatObservation(live.branchProtection)}`);
    console.log(`Merge methods: ${formatObservation(live.mergeMethods)}`);
    console.log(`Rulesets: ${formatObservation(live.rulesets)}`);
    console.log(`Releases: ${formatObservation(live.releases)}`);
    console.log("\nEndpoint reads:");
    for (const item of live.diagnostics) {
      console.log(`- ${item.state.toUpperCase()} HTTP ${item.status} ${item.endpoint}${item.kind ? ` [${item.kind}]` : ""}: ${item.message}`);
    }
    console.log("\nDesired vs observed:");
    for (const item of comparisons) {
      console.log(`- ${item.status.toUpperCase()} ${item.key}: ${item.detail}`);
    }
  }

  const blocked = comparisons.some(({ status }) => status === "inaccessible" || status === "unsupported");
  const mismatch = comparisons.some(({ status }) => status === "mismatch");
  process.exitCode = blocked ? 3 : mismatch ? 2 : 0;
}

await main();
