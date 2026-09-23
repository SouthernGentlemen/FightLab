import {
  MAIN_RULESET_NAME,
  RELEASE_TAG_RULESET_NAME,
  branchApiSnapshot,
  buildApplyPlan,
  classifyProviderFailure,
  compareRepositorySettings,
  observed,
  protectionApiSnapshot,
  releasesApiSnapshot,
  repositoryApiSnapshot,
  rulesetsApiSnapshot,
  unavailable,
  type BranchProtectionSnapshot,
  type DesiredRepositorySettings,
  type EndpointDiagnostic,
  type LiveRepositorySettings,
  type MergeMethod,
  type Observation,
  type ProviderFailure,
  type SettingsComparison,
} from "./github-repository-settings.ts";

export const GITHUB_API_VERSION = "2026-03-10";

type FetchLike = typeof fetch;
type JsonRecord = Record<string, unknown>;

interface EndpointResult {
  readonly path: string;
  readonly endpoint: string;
  readonly status: number;
  readonly ok: boolean;
  readonly data: unknown;
  readonly message: string;
}

function record(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : {};
}

function rootFor(repository: string): string {
  const [owner, name, extra] = repository.split("/");
  if (!owner || !name || extra !== undefined) throw new Error(`expected repository owner/name, received ${repository}`);
  return `/repos/${owner}/${name}`;
}

function providerMessage(data: unknown, fallback: string): string {
  const message = record(data).message;
  return typeof message === "string" ? message : fallback;
}

async function request(
  path: string,
  {
    token,
    method = "GET",
    body,
    fetchImpl = fetch,
  }: {
    readonly token?: string;
    readonly method?: "GET" | "PATCH" | "POST" | "PUT";
    readonly body?: unknown;
    readonly fetchImpl?: FetchLike;
  } = {},
): Promise<EndpointResult> {
  const endpoint = `https://api.github.com${path}`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "User-Agent": "FightLab-repository-settings",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetchImpl(endpoint, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let data: unknown = null;
    if (text.length > 0) {
      try { data = JSON.parse(text) as unknown; } catch { data = text; }
    }
    return {
      path,
      endpoint,
      status: response.status,
      ok: response.ok,
      data,
      message: providerMessage(data, response.statusText),
    };
  } catch (error) {
    return {
      path,
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
  if (result.ok || (result.status === 404 && /branch not protected/i.test(result.message))) {
    return {
      endpoint: result.endpoint,
      status: result.status,
      state: "observed",
      message: result.ok ? "provider read succeeded" : result.message,
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

async function detailedRulesets(
  root: string,
  summaries: EndpointResult,
  token: string | undefined,
  fetchImpl: FetchLike,
): Promise<{ readonly observation: LiveRepositorySettings["rulesets"]; readonly diagnostics: EndpointDiagnostic[] }> {
  if (!summaries.ok) return { observation: unavailable(failure(summaries)), diagnostics: [] };
  const values = Array.isArray(summaries.data) ? summaries.data : [];
  const results = await Promise.all(values.map((summary) => {
    const id = record(summary).id;
    if (typeof id !== "number" && typeof id !== "string") {
      return Promise.resolve<EndpointResult>({
        path: `${root}/rulesets`, endpoint: `https://api.github.com${root}/rulesets`, status: 0, ok: false,
        data: null, message: "ruleset summary omitted id",
      });
    }
    return request(`${root}/rulesets/${id}`, { token, fetchImpl });
  }));
  const failed = results.find((result) => !result.ok);
  if (failed) return { observation: unavailable(failure(failed)), diagnostics: results.map(diagnostic) };
  return {
    observation: observed(rulesetsApiSnapshot(results.map((result) => result.data))),
    diagnostics: results.map(diagnostic),
  };
}

export async function readLiveRepositorySettings(
  desired: DesiredRepositorySettings,
  { token, fetchImpl = fetch }: { readonly token?: string; readonly fetchImpl?: FetchLike } = {},
): Promise<LiveRepositorySettings> {
  const root = rootFor(desired.repository);
  const branch = encodeURIComponent(desired.branchProtection.branch);
  const [repoResult, branchResult, protectionResult, rulesetSummaries, releasesResult] = await Promise.all([
    request(root, { token, fetchImpl }),
    request(`${root}/branches/${branch}`, { token, fetchImpl }),
    request(`${root}/branches/${branch}/protection`, { token, fetchImpl }),
    request(`${root}/rulesets`, { token, fetchImpl }),
    request(`${root}/releases?per_page=100`, { token, fetchImpl }),
  ]);
  const detailed = await detailedRulesets(root, rulesetSummaries, token, fetchImpl);
  const repo = repoResult.ok ? repositoryApiSnapshot(repoResult.data) : null;

  let branchProtection: LiveRepositorySettings["branchProtection"];
  if (branchResult.ok) {
    branchProtection = observed(branchApiSnapshot(branchResult.data));
  } else if (protectionResult.ok) {
    branchProtection = observed(protectionApiSnapshot(protectionResult.data));
  } else if (protectionResult.status === 404 && /branch not protected/i.test(protectionResult.message)) {
    branchProtection = observed({ protected: false, requiredChecks: [] });
  } else {
    branchProtection = unavailable<BranchProtectionSnapshot>(failure(branchResult));
  }

  const mergeMethods = repo === null
    ? unavailable<readonly MergeMethod[]>(failure(repoResult))
    : repo.mergeMethods === null
      ? unavailable<readonly MergeMethod[]>({
          state: "inaccessible", kind: "field-unavailable", endpoint: repoResult.endpoint,
          status: repoResult.status, message: "repository response omitted merge-method policy fields for this credential",
        })
      : observed(repo.mergeMethods);
  const deleteBranchOnMerge = repo === null
    ? unavailable<boolean>(failure(repoResult))
    : repo.deleteBranchOnMerge === null
      ? unavailable<boolean>({
          state: "inaccessible", kind: "field-unavailable", endpoint: repoResult.endpoint,
          status: repoResult.status, message: "repository response omitted delete_branch_on_merge for this credential",
        })
      : observed(repo.deleteBranchOnMerge);

  return {
    visibility: repo === null ? unavailable<string>(failure(repoResult)) : observed(repo.visibility),
    defaultBranch: repo === null ? unavailable<string>(failure(repoResult)) : observed(repo.defaultBranch),
    branchProtection,
    mergeMethods,
    deleteBranchOnMerge,
    rulesets: detailed.observation,
    releases: observation(releasesResult, releasesApiSnapshot),
    diagnostics: [repoResult, branchResult, protectionResult, rulesetSummaries, releasesResult]
      .map(diagnostic).concat(detailed.diagnostics),
  };
}

function requireToken(token: string | undefined): string {
  if (token) return token;
  const error = new Error("GH_ADMIN_TOKEN, GITHUB_TOKEN or GH_TOKEN is required for apply");
  Object.assign(error, { code: "GITHUB_AUTH_REQUIRED" });
  throw error;
}

function requirePreflight(live: LiveRepositorySettings): void {
  const required: readonly Observation<unknown>[] = [
    live.defaultBranch,
    live.mergeMethods,
    live.deleteBranchOnMerge,
    live.rulesets,
  ];
  const blocked = required.find((value) => value.state !== "observed");
  if (blocked) {
    const reason = blocked.reason;
    const error = new Error(
      `cannot apply GitHub settings: ${reason.state} (${reason.kind}, HTTP ${reason.status}): ${reason.message}`,
    );
    Object.assign(error, { code: reason.kind, providerFailure: reason });
    throw error;
  }
}

async function mutate(
  path: string,
  method: "PATCH" | "POST" | "PUT",
  body: unknown,
  token: string,
  fetchImpl: FetchLike,
): Promise<void> {
  const result = await request(path, { token, method, body, fetchImpl });
  if (result.ok) return;
  const reason = failure(result);
  const error = new Error(`${reason.state} (${reason.kind}, HTTP ${reason.status}): ${reason.message}`);
  Object.assign(error, { code: reason.kind, providerFailure: reason });
  throw error;
}

export async function applyDesiredRepositorySettings(
  desired: DesiredRepositorySettings,
  { token: rawToken, fetchImpl = fetch }: { readonly token?: string; readonly fetchImpl?: FetchLike } = {},
): Promise<{ readonly live: LiveRepositorySettings; readonly comparisons: readonly SettingsComparison[] }> {
  const token = requireToken(rawToken);
  const before = await readLiveRepositorySettings(desired, { token, fetchImpl });
  requirePreflight(before);

  const root = rootFor(desired.repository);
  const summaries = await request(`${root}/rulesets`, { token, fetchImpl });
  if (!summaries.ok) {
    const reason = failure(summaries);
    const error = new Error(`cannot apply GitHub settings: ${reason.state} (${reason.kind}, HTTP ${reason.status}): ${reason.message}`);
    Object.assign(error, { code: reason.kind, providerFailure: reason });
    throw error;
  }
  const existing = Array.isArray(summaries.data) ? summaries.data : [];
  const plan = buildApplyPlan(desired);
  for (const payload of plan.rulesets) {
    const name = record(payload).name;
    const current = existing.find((item) => record(item).name === name);
    const id = record(current).id;
    if (typeof id === "number" || typeof id === "string") {
      await mutate(`${root}/rulesets/${id}`, "PUT", payload, token, fetchImpl);
    } else {
      await mutate(`${root}/rulesets`, "POST", payload, token, fetchImpl);
    }
  }
  await mutate(root, "PATCH", plan.repositoryPatch, token, fetchImpl);

  const live = await readLiveRepositorySettings(desired, { token, fetchImpl });
  const comparisons = compareRepositorySettings(desired, live);
  if (comparisons.some(({ status }) => status !== "match")) {
    const error = new Error("GitHub settings were mutated but independent read-only verification did not match");
    Object.assign(error, { code: "GITHUB_POST_APPLY_VERIFY_FAILED", comparisons });
    throw error;
  }
  return { live, comparisons };
}

export const managedRulesetNames = [MAIN_RULESET_NAME, RELEASE_TAG_RULESET_NAME] as const;
