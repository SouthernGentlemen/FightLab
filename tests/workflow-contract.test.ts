import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const WORKFLOW = readFileSync(new URL("../.github/workflows/verify.yml", import.meta.url), "utf8");
const RELEASE_WORKFLOW = readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");
const VISUAL_WORKFLOW = readFileSync(new URL("../.github/workflows/visual.yml", import.meta.url), "utf8");
const CHECKOUT_ACTION = "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1";
const SETUP_NODE_ACTION = "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020";

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
    expect(WORKFLOW).toContain('ref: ${{ github.event.pull_request.head.sha || github.sha }}');
    expect(WORKFLOW).toContain("fetch-depth: 0");
    expect(WORKFLOW).toContain("persist-credentials: false");
    expect(WORKFLOW).toContain(`uses: ${CHECKOUT_ACTION}`);
    expect(WORKFLOW).toContain(`uses: ${SETUP_NODE_ACTION}`);
    expect(WORKFLOW).toContain('git diff --check "$BASE_SHA...$HEAD_SHA"');
    expect(WORKFLOW).toContain("name: Network dependency advisories");
    expect(WORKFLOW).toContain("run: npm run audit:dependencies");
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
    expect(RELEASE_WORKFLOW).toContain(`uses: ${CHECKOUT_ACTION}`);
    expect(RELEASE_WORKFLOW).toContain(`uses: ${SETUP_NODE_ACTION}`);
    expect(RELEASE_WORKFLOW).toContain("persist-credentials: false");
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

  it("publishes source metadata only, then hands the same tag to the protected deploy workflow", () => {
    expect(RELEASE_WORKFLOW.match(/gh release create/g) ?? []).toHaveLength(1);
    expect(RELEASE_WORKFLOW).not.toMatch(/upload-artifact|download-artifact|npm publish|dist\//i);
    expect(RELEASE_WORKFLOW).toContain("needs: release");
    expect(RELEASE_WORKFLOW).toContain("uses: ./.github/workflows/deploy.yml");
    expect(RELEASE_WORKFLOW).toContain("tag: ${{ github.ref_name }}");
    expect(RELEASE_WORKFLOW).not.toMatch(/\bwrangler deploy\b/);
  });
});

describe("visual evidence workflow", () => {
  it("uses exact source revisions and the shared immutable checkout/toolchain actions", () => {
    expect(VISUAL_WORKFLOW).toContain('ref: ${{ github.event.pull_request.head.sha || github.sha }}');
    expect(VISUAL_WORKFLOW).toContain("fetch-depth: 0");
    expect(VISUAL_WORKFLOW).toContain("persist-credentials: false");
    expect(VISUAL_WORKFLOW).toContain(`uses: ${CHECKOUT_ACTION}`);
    expect(VISUAL_WORKFLOW).toContain(`uses: ${SETUP_NODE_ACTION}`);
    expect(VISUAL_WORKFLOW).toContain("run: npm ci");
  });
});
