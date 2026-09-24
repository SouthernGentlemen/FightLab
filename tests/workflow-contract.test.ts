import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const WORKFLOW = readFileSync(new URL("../.github/workflows/verify.yml", import.meta.url), "utf8");
const RELEASE_WORKFLOW = readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");

describe("provider acceptance workflow", () => {
  it("runs the canonical gate on pull requests, main and manual dispatch", () => {
    expect(WORKFLOW).toContain("  pull_request:\n");
    expect(WORKFLOW).toContain("  push:\n    branches:\n      - main\n");
    expect(WORKFLOW).toContain("  workflow_dispatch:\n");
    expect(WORKFLOW.match(/run: npm run check/g) ?? []).toHaveLength(1);
    expect(WORKFLOW).toContain("name: Observe live GitHub settings");
    expect(WORKFLOW).toContain("continue-on-error: true");
    expect(WORKFLOW).toContain("GH_TOKEN: ${{ github.token }}");
    expect(WORKFLOW).toContain("run: npm run verify:github-settings");
    expect(WORKFLOW).not.toMatch(/^\s*run: npm run verify\s*$/m);
    expect(WORKFLOW).toContain("name: Check PR diff whitespace");
    expect(WORKFLOW).toContain('git diff --check "$BASE_SHA" "$HEAD_SHA"');
  });

  it("preserves locked install and the exact private Boneyard checkout", () => {
    expect(WORKFLOW).toContain("ref: ${{ steps.boneyard.outputs.commit }}");
    expect(WORKFLOW).toContain("token: ${{ secrets.BONEYARD_READ_TOKEN }}");
    expect(WORKFLOW).toContain("run: npm ci");
  });
});

describe("source-only release workflow", () => {
  it("releases only an exact validated semantic tag after canonical acceptance", () => {
    expect(RELEASE_WORKFLOW).toContain('      - "v[0-9]+.[0-9]+.[0-9]+"');
    expect(RELEASE_WORKFLOW).toContain("permissions:\n  contents: write");
    expect(RELEASE_WORKFLOW).toContain("ref: ${{ github.ref }}");
    expect(RELEASE_WORKFLOW).toContain("fetch-depth: 0");
    expect(RELEASE_WORKFLOW).toContain('git fetch --force --no-tags origin "$tag_ref:$tag_ref"');
    expect(RELEASE_WORKFLOW).toContain("node-version-file: FightLab/.node-version");
    expect(RELEASE_WORKFLOW).toContain("ref: ${{ steps.boneyard.outputs.commit }}");
    expect(RELEASE_WORKFLOW).toContain("token: ${{ secrets.BONEYARD_READ_TOKEN }}");
    expect(RELEASE_WORKFLOW).toContain("run: npm ci");
    expect(RELEASE_WORKFLOW).toContain("run: npm run check");
    expect(RELEASE_WORKFLOW).toContain("FIGHTLAB_RELEASE: ${{ github.ref_name }}");
    expect(RELEASE_WORKFLOW).toContain("run: npm run check:release-identity");
    expect(RELEASE_WORKFLOW).toContain(
      'run: gh release create "$GITHUB_REF_NAME" --verify-tag --generate-notes --title "$GITHUB_REF_NAME"',
    );

    const check = RELEASE_WORKFLOW.indexOf("run: npm run check\n");
    const identity = RELEASE_WORKFLOW.indexOf("run: npm run check:release-identity");
    const publish = RELEASE_WORKFLOW.indexOf('run: gh release create "$GITHUB_REF_NAME"');
    expect(check).toBeGreaterThan(-1);
    expect(identity).toBeGreaterThan(check);
    expect(publish).toBeGreaterThan(identity);
  });

  it("publishes source metadata only and has no deployment or package-publication path", () => {
    expect(RELEASE_WORKFLOW.match(/gh release create/g) ?? []).toHaveLength(1);
    expect(RELEASE_WORKFLOW).not.toMatch(/upload-artifact|download-artifact|npm publish|dist\//i);
    expect(RELEASE_WORKFLOW).not.toMatch(/^\s*(?:uses|run): .*deploy/im);
  });
});
