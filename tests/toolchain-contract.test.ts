import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

interface PackageJson {
  readonly packageManager?: string;
  readonly engines?: {
    readonly node?: string;
    readonly npm?: string;
  };
}

interface LockJson {
  readonly packages?: Record<string, {
    readonly engines?: {
      readonly node?: string;
      readonly npm?: string;
    };
  }>;
}

function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const pkg = JSON.parse(read("package.json")) as PackageJson;
const lock = JSON.parse(read("package-lock.json")) as LockJson;
const nodeVersion = read(".node-version").trim();
const npmrc = read(".npmrc").trim().split(/\r?\n/);

describe("repository toolchain contract", () => {
  it("keeps exact Node/npm authorities consistent with engine policy and lock metadata", () => {
    expect(nodeVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.packageManager).toMatch(/^npm@\d+\.\d+\.\d+$/);

    const nodeMajor = nodeVersion.split(".")[0];
    const npmVersion = pkg.packageManager!.slice(4);
    const npmMajor = npmVersion.split(".")[0];

    expect(pkg.engines).toEqual({ node: `${nodeMajor}.x`, npm: `${npmMajor}.x` });
    expect(lock.packages?.[""]?.engines).toEqual(pkg.engines);
  });

  it("enforces engines and keeps provider workflows on repository authority", () => {
    expect(npmrc).toContain("engine-strict=true");

    for (const path of [".github/workflows/verify.yml", ".github/workflows/visual.yml"]) {
      const workflow = read(path);
      expect(workflow).toContain("node-version-file: FightLab/.node-version");
      expect(workflow).not.toMatch(/\bnode-version:\s*\d/);
      expect(workflow).toContain('expected_node="$(cat .node-version)"');
      expect(workflow).toContain("packageManager.replace(/^npm@/, '')");
      expect(workflow).toContain('test "$(node --version)" = "v${expected_node}"');
      expect(workflow).toContain('test "$(npm --version)" = "${expected_npm}"');
      expect(workflow).toContain("run: npm ci");
    }
  });
});
