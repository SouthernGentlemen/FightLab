import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

interface PackageJson { readonly scripts?: Record<string, string> }
function scripts(): Record<string, string> {
  return (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as PackageJson).scripts ?? {};
}

describe("repository acceptance command", () => {
  it("keeps canonical acceptance credential-free while running the pure settings contract", () => {
    const commands = scripts();
    expect(commands["test:github-settings"]).toBe("node --test pipelines/github-repository-settings-cases.ts");
    expect(commands.check).toBe(
      "npm run check:boneyard && npm run test:github-settings && npm run typecheck && npm test && vite build",
    );
    expect(commands.verify).toBe("npm run check");
    expect(commands.check).not.toContain("verify:github-settings");
    expect(commands.check).not.toContain("apply:github-settings");
    expect(commands.check?.match(/vite build/g)).toHaveLength(1);
  });

  it("exposes exactly one explicit settings mutation command", () => {
    const commands = scripts();
    expect(commands["verify:github-settings"]).toBe("node pipelines/verify-github-settings.ts");
    expect(commands["apply:github-settings"]).toBe("node pipelines/apply-github-settings.ts");
    const mutationScripts = Object.entries(commands)
      .filter(([, command]) => command.includes("apply-github-settings.ts"))
      .map(([name]) => name);
    expect(mutationScripts).toEqual(["apply:github-settings"]);
  });
});
