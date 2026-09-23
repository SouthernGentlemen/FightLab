import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

interface PackageJson {
  readonly scripts?: Record<string, string>;
}

function scripts(): Record<string, string> {
  const parsed = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as PackageJson;
  return parsed.scripts ?? {};
}

describe("repository acceptance command", () => {
  it("keeps one canonical credential-free gate and a compatibility alias", () => {
    const commands = scripts();
    expect(commands.check).toBe("npm run check:boneyard && npm run typecheck && npm test && vite build");
    expect(commands.verify).toBe("npm run check");
    expect(commands["verify:github-settings"]).toBe("node pipelines/verify-github-settings.ts");
    expect(commands.check).not.toContain("verify:github-settings");
    expect(commands.test).toBe("vitest run");
  });
});
