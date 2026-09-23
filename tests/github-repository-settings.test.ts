import { describe, expect, it } from "vitest";

import {
  branchApiSnapshot,
  classifyProviderFailure,
  compareRepositorySettings,
  observed,
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
  defaultBranch: "main",
  branchProtection: {
    branch: "main",
    protected: true,
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

describe("live GitHub repository settings comparison", () => {
  it("normalizes repository metadata without treating visibility as desired policy", () => {
    expect(repositoryApiSnapshot({
      visibility: "public",
      default_branch: "main",
      allow_merge_commit: true,
      allow_rebase_merge: true,
      allow_squash_merge: true,
    })).toEqual({
      visibility: "public",
      defaultBranch: "main",
      mergeMethods: ["merge", "rebase", "squash"],
    });
  });

  it("does not invent an empty merge policy when the provider omits those fields", () => {
    expect(repositoryApiSnapshot({
      visibility: "public",
      default_branch: "main",
    }).mergeMethods).toBeNull();
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
      rules: [{ type: "deletion" }, { type: "non_fast_forward" }],
    }])).toEqual({
      count: 1,
      immutableVTags: true,
      matchingRuleIds: [27],
    });
  });

  it("treats an empty readable ruleset collection as an observed mismatch, not N/A", () => {
    const live: LiveRepositorySettings = {
      visibility: observed("public"),
      defaultBranch: observed("main"),
      branchProtection: observed({ protected: false, requiredChecks: [] }),
      mergeMethods: observed(["merge", "rebase", "squash"] as const),
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
      visibility: observed("public"),
      defaultBranch: observed("main"),
      branchProtection: unavailable<BranchProtectionSnapshot>(reason),
      mergeMethods: observed(["squash"] as const),
      rulesets: observed(rulesetsApiSnapshot([])),
      releases: observed({ count: 0, tags: [] }),
      diagnostics: [],
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
});
