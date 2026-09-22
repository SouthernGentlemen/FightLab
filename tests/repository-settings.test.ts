import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

interface RepositorySettings {
  readonly schemaVersion: number;
  readonly policyKind: string;
  readonly defaultBranch: string;
  readonly branchProtection: {
    readonly branch: string;
    readonly protected: boolean;
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
  it("stays explicitly separate from observed provider state", () => {
    expect(SETTINGS.schemaVersion).toBe(1);
    expect(SETTINGS.policyKind).toBe("desired");
  });

  it("protects main as the default branch", () => {
    expect(SETTINGS.defaultBranch).toBe("main");
    expect(SETTINGS.branchProtection).toMatchObject({
      branch: "main",
      protected: true,
    });
  });

  it("requires canonical acceptance through the verify check", () => {
    expect(SETTINGS.branchProtection.requiredChecks).toEqual([
      {
        name: "verify",
        command: "npm run check",
      },
    ]);
  });

  it("keeps the intended single-commit merge policy", () => {
    expect(SETTINGS.merge).toEqual({
      allowedMethods: ["squash"],
      singleCommit: true,
    });
  });

  it("keeps published v-prefixed release tags immutable", () => {
    expect(SETTINGS.releaseTags).toEqual({
      pattern: "v*",
      immutable: true,
      appliesWhenReleasePublished: true,
    });
  });
});
