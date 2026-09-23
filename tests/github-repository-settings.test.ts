import { describe, expect, it } from "vitest";

import {
  MAIN_RULESET_NAME,
  RELEASE_TAG_RULESET_NAME,
  branchApiSnapshot,
  buildApplyPlan,
  classifyProviderFailure,
  compareRepositorySettings,
  mainRulesetPayload,
  observed,
  releaseTagRulesetPayload,
  repositoryApiSnapshot,
  rulesetsApiSnapshot,
  unavailable,
  type BranchProtectionSnapshot,
  type DesiredRepositorySettings,
  type LiveRepositorySettings,
} from "../pipelines/github-repository-settings.ts";

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
  merge: {
    allowedMethods: ["squash"],
    singleCommit: true,
  },
  releaseTags: {
    pattern: "v*",
    immutable: true,
    appliesWhenReleasePublished: true,
  },
};

function matchingLive(): LiveRepositorySettings {
  return {
    visibility: observed("public"),
    defaultBranch: observed("main"),
    branchProtection: observed({ protected: true, requiredChecks: [] }),
    mergeMethods: observed(["squash"] as const),
    deleteBranchOnMerge: observed(true),
    rulesets: observed({
      count: 2,
      immutableVTags: true,
      matchingRuleIds: [27],
      details: [mainRulesetPayload(DESIRED), releaseTagRulesetPayload(DESIRED)],
    }),
    releases: observed({ count: 0, tags: [] }),
    diagnostics: [],
  };
}

describe("GitHub repository settings policy", () => {
  it("normalizes repository metadata without treating visibility as desired policy", () => {
    expect(repositoryApiSnapshot({
      visibility: "public",
      default_branch: "main",
      allow_merge_commit: true,
      allow_rebase_merge: true,
      allow_squash_merge: true,
      delete_branch_on_merge: false,
    })).toEqual({
      visibility: "public",
      defaultBranch: "main",
      mergeMethods: ["merge", "rebase", "squash"],
      deleteBranchOnMerge: false,
    });
  });

  it("does not invent omitted repository policy fields", () => {
    const snapshot = repositoryApiSnapshot({
      visibility: "public",
      default_branch: "main",
    });
    expect(snapshot.mergeMethods).toBeNull();
    expect(snapshot.deleteBranchOnMerge).toBeNull();
  });

  it("normalizes branch protection and required checks from the branch summary", () => {
    expect(branchApiSnapshot({
      protected: true,
      protection: {
        required_status_checks: {
          contexts: ["verify"],
          checks: [{ context: "verify" }, { context: "lint" }],
        },
      },
    })).toEqual({
      protected: true,
      requiredChecks: ["lint", "verify"],
    });
  });

  it("recognizes an active immutable v-tag ruleset", () => {
    expect(rulesetsApiSnapshot([{
      id: 27,
      target: "tag",
      enforcement: "active",
      conditions: { ref_name: { include: ["refs/tags/v*"], exclude: [] } },
      rules: [{ type: "deletion" }, { type: "update" }],
    }])).toEqual({
      count: 1,
      immutableVTags: true,
      matchingRuleIds: [27],
      details: [{
        id: 27,
        target: "tag",
        enforcement: "active",
        conditions: { ref_name: { include: ["refs/tags/v*"], exclude: [] } },
        rules: [{ type: "deletion" }, { type: "update" }],
      }],
    });
  });

  it("treats readable provider drift as mismatch rather than unavailable", () => {
    const live: LiveRepositorySettings = {
      visibility: observed("public"),
      defaultBranch: observed("main"),
      branchProtection: observed({ protected: false, requiredChecks: [] }),
      mergeMethods: observed(["merge", "rebase", "squash"] as const),
      deleteBranchOnMerge: observed(false),
      rulesets: observed(rulesetsApiSnapshot([])),
      releases: observed({ count: 0, tags: [] }),
      diagnostics: [],
    };
    const byKey = Object.fromEntries(compareRepositorySettings(DESIRED, live).map((item) => [item.key, item.status]));
    expect(byKey).toEqual({
      defaultBranch: "match",
      mainProtected: "mismatch",
      requiredChecks: "mismatch",
      mergeMethods: "mismatch",
      singleCommit: "mismatch",
      deleteBranchOnMerge: "mismatch",
      mainRuleset: "mismatch",
      releaseTags: "mismatch",
    });
  });

  it("keeps inaccessible provider state distinct from a live mismatch", () => {
    const reason = classifyProviderFailure(
      "https://api.github.com/repos/example/repo/branches/main/protection",
      403,
      "Resource not accessible by integration",
    );
    const live: LiveRepositorySettings = {
      ...matchingLive(),
      branchProtection: unavailable<BranchProtectionSnapshot>(reason),
    };
    const protection = compareRepositorySettings(DESIRED, live).filter(
      ({ key }) => key === "mainProtected" || key === "requiredChecks",
    );
    expect(protection.map(({ status }) => status)).toEqual(["inaccessible", "inaccessible"]);
  });

  it("distinguishes an integration permission failure from a provider-tier failure", () => {
    expect(classifyProviderFailure(
      "protection",
      403,
      "Resource not accessible by integration",
    )).toMatchObject({
      state: "inaccessible",
      kind: "integration-permission",
    });
    expect(classifyProviderFailure(
      "rulesets",
      403,
      "Upgrade to GitHub Pro or make this repository public to enable this feature.",
    )).toMatchObject({
      state: "unsupported",
      kind: "provider-tier",
    });
  });

  it("maps only committed desired policy into the bounded apply plan", () => {
    const plan = buildApplyPlan(DESIRED);
    expect(plan.repositoryPatch).toEqual({
      default_branch: "main",
      allow_merge_commit: false,
      allow_squash_merge: true,
      allow_rebase_merge: false,
      delete_branch_on_merge: true,
    });
    expect(plan.repositoryPatch).not.toHaveProperty("visibility");
    expect(plan.rulesets.map((item) => item.name)).toEqual([
      MAIN_RULESET_NAME,
      RELEASE_TAG_RULESET_NAME,
    ]);

    const main = plan.rulesets[0] as {
      readonly rules: readonly {
        readonly type: string;
        readonly parameters?: Record<string, unknown>;
      }[];
    };
    expect(main.rules.find(({ type }) => type === "pull_request")?.parameters?.allowed_merge_methods)
      .toEqual(["squash"]);
    expect(main.rules.find(({ type }) => type === "required_status_checks")?.parameters).toMatchObject({
      required_status_checks: [{ context: "verify" }],
      strict_required_status_checks_policy: true,
    });
  });

  it("reports a fully matching normalized state as all matches", () => {
    expect(compareRepositorySettings(DESIRED, matchingLive()).every(({ status }) => status === "match"))
      .toBe(true);
  });
});
