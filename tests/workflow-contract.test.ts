import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const WORKFLOW = readFileSync(new URL("../.github/workflows/verify.yml", import.meta.url), "utf8");

describe("provider acceptance workflow", () => {
  it("runs the canonical gate on pull requests, main and manual dispatch", () => {
    expect(WORKFLOW).toContain("  pull_request:\n");
    expect(WORKFLOW).toContain("  push:\n    branches:\n      - main\n");
    expect(WORKFLOW).toContain("  workflow_dispatch:\n");
    expect(WORKFLOW.match(/run: npm run check/g) ?? []).toHaveLength(1);
    expect(WORKFLOW).not.toContain("run: npm run verify");
  });

  it("preserves locked install and the exact private Boneyard checkout", () => {
    expect(WORKFLOW).toContain("ref: ${{ steps.boneyard.outputs.commit }}");
    expect(WORKFLOW).toContain("token: ${{ secrets.BONEYARD_READ_TOKEN }}");
    expect(WORKFLOW).toContain("run: npm ci");
  });
});
