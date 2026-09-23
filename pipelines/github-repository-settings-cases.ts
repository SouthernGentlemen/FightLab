import assert from "node:assert/strict";
import test from "node:test";

import {
  MAIN_RULESET_NAME,
  RELEASE_TAG_RULESET_NAME,
  buildApplyPlan,
  classifyProviderFailure,
  compareRepositorySettings,
  mainRulesetPayload,
  observed,
  releaseTagRulesetPayload,
  repositoryApiSnapshot,
  rulesetsApiSnapshot,
  unavailable,
  type DesiredRepositorySettings,
  type LiveRepositorySettings,
} from "./github-repository-settings.ts";
import { applyDesiredRepositorySettings, readLiveRepositorySettings } from "./github-settings-provider.ts";

const DESIRED: DesiredRepositorySettings = {
  schemaVersion: 1,
  policyKind: "desired",
  repository: "SouthernGentlemen/FightLab",
  defaultBranch: "main",
  deleteBranchOnMerge: true,
  branchProtection: {
    branch: "main",
    protected: true,
    requireBranchUpToDate: true,
    requiredChecks: [{ name: "verify", command: "npm run check" }],
  },
  merge: { allowedMethods: ["squash"], singleCommit: true },
  releaseTags: { pattern: "v*", immutable: true, appliesWhenReleasePublished: true },
};

function live(): LiveRepositorySettings {
  return {
    visibility: observed("public"),
    defaultBranch: observed("main"),
    branchProtection: observed({ protected: true, requiredChecks: ["verify"] }),
    mergeMethods: observed(["squash"] as const),
    deleteBranchOnMerge: observed(true),
    rulesets: observed(rulesetsApiSnapshot([
      { id: 1, ...mainRulesetPayload(DESIRED) },
      { id: 2, ...releaseTagRulesetPayload(DESIRED) },
    ])),
    releases: observed({ count: 0, tags: [] }),
    diagnostics: [],
  };
}

function response(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

type Call = { method: string; url: string; body: unknown };
function fakeProvider({ rulesets403 = false, stubborn = false } = {}): { fetchImpl: typeof fetch; calls: Call[] } {
  let repository = {
    visibility: "public", default_branch: "main", allow_merge_commit: true, allow_rebase_merge: true,
    allow_squash_merge: true, delete_branch_on_merge: false,
  };
  let rulesets: Record<string, unknown>[] = [];
  let nextId = 1;
  const calls: Call[] = [];
  const fetchImpl = (async (input: URL | RequestInfo, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) as unknown : null;
    calls.push({ method, url, body });
    if (url.endsWith("/branches/main/protection")) return response({ message: "Resource not accessible by integration" }, 403);
    if (url.endsWith("/branches/main")) {
      const main = rulesets.find((item) => item.name === MAIN_RULESET_NAME);
      const checks = main && Array.isArray(main.rules)
        ? (main.rules as Record<string, unknown>[]).find((item) => item.type === "required_status_checks")
        : undefined;
      const contexts = checks
        ? ((checks.parameters as { required_status_checks?: { context: string }[] })?.required_status_checks ?? []).map(({ context }) => context)
        : [];
      return response({ protected: Boolean(main), protection: { required_status_checks: { contexts, checks: [] } } });
    }
    if (url.endsWith("/releases?per_page=100")) return response([]);
    if (url.endsWith("/rulesets") && method === "GET") {
      if (rulesets403) return response({ message: "Resource not accessible by integration" }, 403);
      if (stubborn && calls.some((call) => call.method !== "GET")) return response([]);
      return response(rulesets.map(({ id, name, target, enforcement }) => ({ id, name, target, enforcement })));
    }
    const detail = url.match(/\/rulesets\/(\d+)$/);
    if (detail && method === "GET") {
      const id = Number(detail[1]);
      const found = rulesets.find((item) => item.id === id);
      return found ? response(found) : response({ message: "Not Found" }, 404);
    }
    if (url.endsWith("/rulesets") && method === "POST") {
      const created = { id: nextId++, ...(body as Record<string, unknown>) };
      rulesets.push(created);
      return response(created, 201);
    }
    if (detail && method === "PUT") {
      const id = Number(detail[1]);
      rulesets = rulesets.map((item) => item.id === id ? { id, ...(body as Record<string, unknown>) } : item);
      return response(rulesets.find((item) => item.id === id));
    }
    if (url.endsWith("/repos/SouthernGentlemen/FightLab") && method === "PATCH") {
      repository = { ...repository, ...(body as Record<string, unknown>) } as typeof repository;
      return response(repository);
    }
    if (url.endsWith("/repos/SouthernGentlemen/FightLab") && method === "GET") return response(repository);
    return response({ message: `unexpected ${method} ${url}` }, 500);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

test("repository normalization is deterministic", () => {
  assert.deepEqual(repositoryApiSnapshot({
    visibility: "public", default_branch: "main", allow_merge_commit: false,
    allow_rebase_merge: false, allow_squash_merge: true, delete_branch_on_merge: true,
  }), { visibility: "public", defaultBranch: "main", mergeMethods: ["squash"], deleteBranchOnMerge: true });
});

test("comparison separates mismatch, inaccessible and unsupported", () => {
  assert.equal(compareRepositorySettings(DESIRED, { ...live(), mergeMethods: observed(["merge"] as const) })
    .find(({ key }) => key === "mergeMethods")?.status, "mismatch");
  assert.equal(compareRepositorySettings(DESIRED, {
    ...live(), branchProtection: unavailable(classifyProviderFailure("protection", 403, "Resource not accessible by integration")),
  }).find(({ key }) => key === "mainProtected")?.status, "inaccessible");
  assert.equal(classifyProviderFailure("rulesets", 403,
    "Upgrade to GitHub Pro or make this repository public to enable this feature.").state, "unsupported");
});

test("main and release ruleset drift fails closed", () => {
  const failuresFor = (mutate: (rulesets: Record<string, unknown>[]) => void): string => {
    const base = live().rulesets;
    if (base.state !== "observed") throw new Error("expected observed fixture");
    const details = structuredClone(base.value.details) as Record<string, unknown>[];
    mutate(details);
    return compareRepositorySettings(DESIRED, {
      ...live(), rulesets: observed(rulesetsApiSnapshot(details)),
    }).filter(({ status }) => status !== "match").map(({ detail }) => detail).join("; ");
  };
  assert.match(failuresFor((rulesets) => { rulesets.splice(0, 1); }), /main ruleset missing/);
  assert.match(failuresFor((rulesets) => { rulesets[0].bypass_actors = [{ actor_id: 1 }]; }), /bypass actors differ/);
  assert.match(failuresFor((rulesets) => {
    const pull = (rulesets[0].rules as Record<string, unknown>[]).find(({ type }) => type === "pull_request")!;
    (pull.parameters as Record<string, unknown>).allowed_merge_methods = ["merge"];
  }), /allowed merge methods differ/);
  assert.match(failuresFor((rulesets) => {
    const checks = (rulesets[0].rules as Record<string, unknown>[]).find(({ type }) => type === "required_status_checks")!;
    (checks.parameters as Record<string, unknown>).required_status_checks = [];
  }), /required status checks differ/);
  assert.match(failuresFor((rulesets) => {
    const checks = (rulesets[0].rules as Record<string, unknown>[]).find(({ type }) => type === "required_status_checks")!;
    (checks.parameters as Record<string, unknown>).strict_required_status_checks_policy = false;
  }), /strict current-main checks disabled/);
  assert.match(failuresFor((rulesets) => { rulesets[1].rules = [{ type: "deletion" }]; }), /rule types differ/);
});

test("ruleset checks remain authoritative when branch summary omits them", () => {
  const actual = { ...live(), branchProtection: observed({ protected: true, requiredChecks: [] }) };
  assert.equal(compareRepositorySettings(DESIRED, actual)
    .find(({ key }) => key === "requiredChecks")?.status, "match");
});

test("apply plan is bounded to committed repository policy", () => {
  const plan = buildApplyPlan(DESIRED);
  assert.deepEqual(plan.repositoryPatch, {
    default_branch: "main", allow_merge_commit: false, allow_squash_merge: true,
    allow_rebase_merge: false, delete_branch_on_merge: true,
  });
  assert.equal("visibility" in plan.repositoryPatch, false);
  assert.deepEqual(plan.rulesets.map((item) => item.name), [MAIN_RULESET_NAME, RELEASE_TAG_RULESET_NAME]);
  const main = plan.rulesets[0] as { rules: { type: string; parameters?: Record<string, unknown> }[] };
  assert.deepEqual(main.rules.find(({ type }) => type === "pull_request")?.parameters?.allowed_merge_methods, ["squash"]);
  assert.deepEqual(main.rules.find(({ type }) => type === "required_status_checks")?.parameters?.required_status_checks,
    [{ context: "verify" }]);
  assert.equal(main.rules.find(({ type }) => type === "required_status_checks")?.parameters?.strict_required_status_checks_policy, true);
});

test("read-only verification issues GET requests only", async () => {
  const { fetchImpl, calls } = fakeProvider();
  await readLiveRepositorySettings(DESIRED, { fetchImpl });
  assert.ok(calls.length > 0);
  assert.ok(calls.every(({ method }) => method === "GET"));
});

test("apply fails closed without credentials", async () => {
  const { fetchImpl, calls } = fakeProvider();
  await assert.rejects(applyDesiredRepositorySettings(DESIRED, { fetchImpl }),
    (error: unknown) => (error as { code?: string }).code === "GITHUB_AUTH_REQUIRED");
  assert.deepEqual(calls, []);
});

test("apply preflight blocks inaccessible provider capabilities before mutation", async () => {
  const { fetchImpl, calls } = fakeProvider({ rulesets403: true });
  await assert.rejects(applyDesiredRepositorySettings(DESIRED, { token: "redacted", fetchImpl }),
    /cannot apply GitHub settings: inaccessible \(integration-permission/);
  assert.equal(calls.some(({ method }) => method !== "GET"), false);
});

test("apply is the only bounded mutation path and independently re-reads state", async () => {
  const { fetchImpl, calls } = fakeProvider();
  const result = await applyDesiredRepositorySettings(DESIRED, { token: "redacted", fetchImpl });
  assert.ok(result.comparisons.every(({ status }) => status === "match"));
  const mutations = calls.filter(({ method }) => method !== "GET");
  assert.deepEqual(mutations.map(({ method }) => method), ["POST", "POST", "PATCH"]);
  const lastMutation = calls.map(({ method }) => method).lastIndexOf("PATCH");
  assert.ok(calls.slice(lastMutation + 1).some(({ method }) => method === "GET"));
});

test("apply rejects successful writes when independent re-verification still drifts", async () => {
  const { fetchImpl } = fakeProvider({ stubborn: true });
  await assert.rejects(applyDesiredRepositorySettings(DESIRED, { token: "redacted", fetchImpl }),
    (error: unknown) => (error as { code?: string }).code === "GITHUB_POST_APPLY_VERIFY_FAILED");
});
