import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

interface Snapshot {
  readonly trackedPaths: readonly string[];
  readonly files: Readonly<Record<string, string>>;
}

const RELEASE_PATH = ".github/workflows/release.yml";
const RELEASE_COMMAND =
  'gh release create "$GITHUB_REF_NAME" --verify-tag --generate-notes --title "$GITHUB_REF_NAME"';

const DEPLOY_CONFIG = /(^|\/)(?:wrangler\.(?:toml|jsonc?|ya?ml)|vercel\.json|netlify\.toml|firebase\.json|fly\.toml|app\.ya?ml|serverless\.ya?ml|staticwebapp\.config\.json)$/i;
const DEPLOY_WORKFLOW_PATH = /^\.github\/workflows\/[^/]*(?:deploy|publish|pages)[^/]*\.ya?ml$/i;
const FORBIDDEN_WORKFLOW = [
  /\b(?:npm|pnpm|yarn)\s+publish\b/i,
  /\bgh\s+release\s+upload\b/i,
  /\b(?:wrangler(?:\s+pages)?|vercel|netlify|firebase|fly)\s+deploy\b/i,
  /\bkubectl\s+(?:apply|set\s+image)\b/i,
  /\bhelm\s+upgrade\b/i,
  /\bdocker\s+push\b/i,
  /actions\/deploy-pages@/i,
  /cloudflare\/wrangler-action@/i,
  /azure\/static-web-apps-deploy@/i,
  /peaceiris\/actions-gh-pages@/i,
  /\benvironment:\s*(?:\n\s*name:\s*)?production\b/i,
];

function validate(snapshot: Snapshot): string[] {
  const problems: string[] = [];
  const packageJson = JSON.parse(snapshot.files["package.json"] ?? "{}") as {
    readonly private?: boolean;
    readonly scripts?: Record<string, string>;
  };

  if (packageJson.private !== true) {
    problems.push("package.json must remain private");
  }

  for (const [name, command] of Object.entries(packageJson.scripts ?? {})) {
    if (/(^|:)(?:deploy|publish)(:|$)/i.test(name)) {
      problems.push(`package script must not expose deploy/publish: ${name}`);
    }
    if (/\b(?:npm|pnpm|yarn)\s+publish\b|\bgh\s+release\s+upload\b/i.test(command)) {
      problems.push(`package script must not publish packages or release attachments: ${name}`);
    }
  }

  if (!snapshot.files[".gitignore"]?.split(/\r?\n/).includes("dist/")) {
    problems.push("dist/ must remain ignored");
  }

  for (const path of snapshot.trackedPaths) {
    if (path === "dist" || path.startsWith("dist/")) {
      problems.push(`built output must not be tracked: ${path}`);
    }
    if (DEPLOY_CONFIG.test(path)) {
      problems.push(`production deployment config is forbidden: ${path}`);
    }
    if (DEPLOY_WORKFLOW_PATH.test(path)) {
      problems.push(`production deployment workflow path is forbidden: ${path}`);
    }
  }

  const workflows = snapshot.trackedPaths.filter((path) => /^\.github\/workflows\/.*\.ya?ml$/i.test(path));
  for (const path of workflows) {
    const content = snapshot.files[path] ?? "";
    if (/dist\//i.test(content)) {
      problems.push(`workflow must not publish built dist output: ${path}`);
    }
    if (FORBIDDEN_WORKFLOW.some((pattern) => pattern.test(content))) {
      problems.push(`workflow contains a deployment/publication path: ${path}`);
    }
    if (path !== RELEASE_PATH && /\bgh\s+release\s+create\b/i.test(content)) {
      problems.push(`GitHub Release creation is restricted to ${RELEASE_PATH}: ${path}`);
    }
  }

  const release = snapshot.files[RELEASE_PATH] ?? "";
  const releaseCommands = release
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("run: gh release create "))
    .map((line) => line.slice("run: ".length));
  if (releaseCommands.length !== 1 || releaseCommands[0] !== RELEASE_COMMAND) {
    problems.push("release workflow must create exactly one source-only GitHub Release with no attachments");
  }
  if (/actions\/upload-artifact@|\bgh\s+release\s+upload\b/i.test(release)) {
    problems.push("release workflow must not upload release/build artifacts");
  }

  return problems;
}

function snapshot(cwd: string): Snapshot {
  const listed = spawnSync("git", ["ls-files", "-z"], { cwd, encoding: "utf8" });
  assert.equal(listed.status, 0, listed.stderr || "git ls-files failed");
  const trackedPaths = listed.stdout.split("\0").filter(Boolean);
  const relevant = trackedPaths.filter(
    (path) =>
      path === "package.json" ||
      path === ".gitignore" ||
      /^\.github\/workflows\/.*\.ya?ml$/i.test(path),
  );
  return {
    trackedPaths,
    files: Object.fromEntries(relevant.map((path) => [path, readFileSync(resolve(cwd, path), "utf8")])),
  };
}

const clean: Snapshot = {
  trackedPaths: ["package.json", ".gitignore", RELEASE_PATH, ".github/workflows/verify.yml"],
  files: {
    "package.json": JSON.stringify({ private: true, scripts: { check: "vitest run && vite build" } }),
    ".gitignore": "node_modules/\ndist/\n",
    [RELEASE_PATH]: `name: release
jobs:
  release:
    steps:
      - name: Publish source-only GitHub Release
        run: ${RELEASE_COMMAND}
`,
    ".github/workflows/verify.yml": "jobs:\n  verify:\n    steps:\n      - run: npm run check\n",
  },
};

test("accepts a private source-only release repository with no deployment path", () => {
  assert.deepEqual(validate(clean), []);
});

test("rejects production deployment workflow and provider configuration", () => {
  const candidate: Snapshot = {
    trackedPaths: [...clean.trackedPaths, ".github/workflows/deploy-production.yml", "wrangler.toml"],
    files: {
      ...clean.files,
      ".github/workflows/deploy-production.yml":
        "jobs:\n  deploy:\n    environment: production\n    steps:\n      - run: wrangler deploy\n",
      "wrangler.toml": 'name = "fightlab"\n',
    },
  };
  assert.ok(validate(candidate).some((problem) => problem.includes("deployment")));
});

test("rejects npm publication and public package identity", () => {
  const candidate: Snapshot = {
    ...clean,
    files: {
      ...clean.files,
      "package.json": JSON.stringify({ private: false, scripts: { publish: "npm publish" } }),
    },
  };
  const problems = validate(candidate);
  assert.ok(problems.includes("package.json must remain private"));
  assert.ok(problems.some((problem) => problem.includes("deploy/publish")));
  assert.ok(problems.some((problem) => problem.includes("publish packages")));
});

test("rejects tracked dist output and release attachments", () => {
  const candidate: Snapshot = {
    trackedPaths: [...clean.trackedPaths, "dist/fighters/copied-boneyard-figure.json"],
    files: {
      ...clean.files,
      [RELEASE_PATH]: `name: release
jobs:
  release:
    steps:
      - run: gh release create "$GITHUB_REF_NAME" --verify-tag --generate-notes --title "$GITHUB_REF_NAME" dist/
`,
    },
  };
  const problems = validate(candidate);
  assert.ok(problems.some((problem) => problem.includes("built output")));
  assert.ok(problems.some((problem) => problem.includes("built dist output")));
  assert.ok(problems.some((problem) => problem.includes("source-only GitHub Release")));
});

test("current tracked repository satisfies the no-production-deploy boundary", () => {
  assert.deepEqual(validate(snapshot(process.cwd())), []);
});
