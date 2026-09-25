import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = new URL("../", import.meta.url).pathname;
const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
const read = (path: string) => readFileSync(join(root, path), "utf8");

export function distributionProblems(paths: readonly string[], files: Readonly<Record<string, string>>): string[] {
  const problems: string[] = [];
  const pkg = JSON.parse(files["package.json"] ?? "{}") as { private?: boolean; scripts?: Record<string, string> };
  if (pkg.private !== true) problems.push("package must remain private");
  if (!files[".gitignore"]?.split(/\r?\n/).includes("dist/")) problems.push("dist must remain ignored");
  for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
    if (/(^|:)(?:publish|deploy:production)(:|$)/.test(name) && name !== "deploy:production:dry-run") problems.push(`unsafe package script ${name}`);
    if (/\b(?:npm|pnpm|yarn)\s+publish\b|\bgh\s+release\s+upload\b/i.test(command)) problems.push(`package publication in ${name}`);
  }
  for (const path of paths) {
    if (path === "dist" || path.startsWith("dist/")) problems.push(`tracked built output ${path}`);
    if (/^\.github\/workflows\/.*(?:deploy|publish|pages).*\.ya?ml$/i.test(path) && path !== ".github/workflows/deploy.yml") problems.push(`unauthorized deploy workflow ${path}`);
    if (/(?:wrangler\.(?:toml|jsonc?)|vercel\.json|netlify\.toml)$/.test(path) && path !== "wrangler.jsonc") problems.push(`unauthorized deploy config ${path}`);
  }
  for (const path of paths.filter((path) => /^\.github\/workflows\/.*\.ya?ml$/.test(path))) {
    if (path !== ".github/workflows/deploy.yml" && /\bwrangler deploy\b/.test(files[path] ?? "")) problems.push(`deployment outside protected workflow ${path}`);
    if (/\bgh\s+release\s+upload\b|\b(?:npm|pnpm|yarn)\s+publish\b/.test(files[path] ?? "")) problems.push(`public artifact publication in ${path}`);
  }
  const release = files[".github/workflows/release.yml"] ?? "";
  const deploy = files[".github/workflows/deploy.yml"] ?? "";
  const config = files["wrangler.jsonc"] ?? "";
  if (!/tags:\s*\n\s*- "v\[0-9\]/.test(release) || !/needs: release/.test(release)
      || !/uses: \.\/\.github\/workflows\/deploy\.yml/.test(release)
      || (release.match(/gh release create/g) ?? []).length !== 1) problems.push("release handoff must be tag-driven after source release");
  if (!/on:\s*\n\s*workflow_call:/.test(deploy) || !/environment: production/.test(deploy)
      || !/production-deployment\.mjs context/.test(deploy) || !/check:release-identity/.test(deploy)
      || !/npm run check/.test(deploy) || !/gh release view/.test(deploy)
      || !/WRANGLER_OUTPUT_FILE_PATH:/.test(deploy) || !/deployments list --env production --json/.test(deploy)
      || (deploy.match(/wrangler deploy --env production/g) ?? []).length !== 1) problems.push("protected production deploy verification is incomplete");
  if (!/"fightlab\.wizardgang\.ai"/.test(config) || !/"custom_domain": true/.test(config)
      || !/"run_worker_first": true/.test(config) || !/"not_found_handling": "none"/.test(config)) problems.push("Worker routing config is incomplete");
  return problems;
}

test("current tracked source keeps deployment behind the release and protected environment", () => {
  const paths = [...tracked, ".github/workflows/deploy.yml", "wrangler.jsonc"];
  const files = Object.fromEntries(paths.filter((path) => path === "package.json" || path === ".gitignore" || path === "wrangler.jsonc" || /^\.github\/workflows\/.*\.ya?ml$/.test(path)).map((path) => [path, read(path)]));
  assert.deepEqual(distributionProblems(paths, files), []);
});

test("rejects package publication, tracked output and unprotected deploy paths", () => {
  const fixturePaths = ["package.json", ".gitignore", ".github/workflows/release.yml", ".github/workflows/deploy.yml", "wrangler.jsonc"];
  const fixture = Object.fromEntries(fixturePaths.map((path) => [path, read(path)]));
  assert.ok(distributionProblems([...fixturePaths, "dist/index.html"], { ...fixture, "package.json": JSON.stringify({ private: false, scripts: { publish: "npm publish" } }) }).length >= 3);
  assert.ok(distributionProblems([...fixturePaths, ".github/workflows/unsafe-deploy.yml"], { ...fixture, ".github/workflows/unsafe-deploy.yml": "run: wrangler deploy" }).length >= 1);
  assert.ok(distributionProblems(fixturePaths, { ...fixture, ".github/workflows/release.yml": fixture[".github/workflows/release.yml"] + "\nrun: gh release upload v0.1.0 dist.zip\n" }).length >= 1);
});
