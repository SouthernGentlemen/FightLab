import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

interface PackageJson { readonly scripts?: Record<string, string> }
function scripts(): Record<string, string> {
  return (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as PackageJson).scripts ?? {};
}

describe("repository acceptance command", () => {
  it("keeps canonical acceptance credential-free while running pure settings and release contracts", () => {
    const commands = scripts();
    expect(commands["test:github-settings"]).toBe("node --test pipelines/github-repository-settings-cases.ts");
    expect(commands["test:release-identity"]).toBe("node --test pipelines/release-identity-cases.ts");
    expect(commands["test:distribution-boundary"]).toBe("node --test pipelines/distribution-boundary-cases.ts");
    expect(commands.check).toBe(
      "npm run check:boneyard && npm run test:github-settings && npm run test:release-identity && npm run test:distribution-boundary && npm run test:production-deployment && npm run typecheck && npm test && vite build && npm run check:public-build",
    );
    expect(commands.verify).toBe("npm run check");
    expect(commands["audit:dependencies"]).toBe("npm audit --audit-level=high");
    expect(commands.check).not.toContain("audit:dependencies");
    expect(commands["check:release-identity"]).toBe("node pipelines/release-identity.ts");
    expect(commands.check).toContain("npm run test:release-identity");
    expect(commands.check).toContain("npm run test:distribution-boundary");
    expect(commands.check).not.toContain("npm run check:release-identity");
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
