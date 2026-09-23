import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

interface RepositorySettings {
  readonly schemaVersion: number;
  readonly policyKind: string;
  readonly repository: string;
  readonly defaultBranch: string;
  readonly deleteBranchOnMerge: boolean;
  readonly branchProtection: {
    readonly branch: string;
    readonly protected: boolean;
    readonly requireBranchUpToDate: boolean;
    readonly requiredChecks: readonly {
      readonly name: string;
      readonly command: string;
    }[];
  };
  readonly merge: {
    readonly allowedMethods: readonly string[];
    readonly singleCommit: boolean;
  };
  readonly releaseTags: {
    readonly pattern: string;
    readonly immutable: boolean;
    readonly appliesWhenReleasePublished: boolean;
  };
}

const SETTINGS = JSON.parse(
  readFileSync(new URL("../config/github-repository-settings.json", import.meta.url), "utf8"),
) as RepositorySettings;

describe("desired repository settings", () => {
  it("stays explicitly separate from observed provider state and bound to FightLab", () => {
    expect(SETTINGS.schemaVersion).toBe(1);
    expect(SETTINGS.policyKind).toBe("desired");
    expect(SETTINGS.repository).toBe("SouthernGentlemen/FightLab");
  });

  it("protects main as the default branch", () => {
    expect(SETTINGS.defaultBranch).toBe("main");
    expect(SETTINGS.branchProtection).toMatchObject({
      branch: "main",
      protected: true,
      requireBranchUpToDate: true,
    });
  });

  it("requires canonical acceptance through the current verify check", () => {
    expect(SETTINGS.branchProtection.requiredChecks).toEqual([
      {
        name: "verify",
        command: "npm run check",
      },
    ]);
  });

  it("keeps the intended single-commit merge and branch-cleanup policy", () => {
    expect(SETTINGS.merge).toEqual({
      allowedMethods: ["squash"],
      singleCommit: true,
    });
    expect(SETTINGS.deleteBranchOnMerge).toBe(true);
  });

  it("keeps published v-prefixed release tags immutable", () => {
    expect(SETTINGS.releaseTags).toEqual({
      pattern: "v*",
      immutable: true,
      appliesWhenReleasePublished: true,
    });
  });
});
