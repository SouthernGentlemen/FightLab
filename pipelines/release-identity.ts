import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const RELEASE_PATTERN = /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;

interface GitResult {
  readonly status: number | null;
  readonly stdout: string;
}

function git(cwd: string, args: readonly string[]): GitResult {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  return {
    status: result.status,
    stdout: (result.stdout ?? "").trim(),
  };
}

export function validateSourceReleaseIdentity(
  { cwd, release }: { readonly cwd: string; readonly release?: string },
): string[] {
  const failures: string[] = [];
  const value = (release ?? "").trim();

  if (!RELEASE_PATTERN.test(value)) {
    return [`source release must match semantic vX.Y.Z: ${value || "(empty)"}`];
  }

  const ref = `refs/tags/${value}`;
  const type = git(cwd, ["cat-file", "-t", ref]);
  if (type.status !== 0) {
    failures.push(`source release tag does not exist: ${value}`);
  } else if (type.stdout !== "tag") {
    failures.push(`source release tag must be annotated: ${value}`);
  }

  if (type.status === 0) {
    const tagged = git(cwd, ["rev-parse", `${ref}^{commit}`]);
    const head = git(cwd, ["rev-parse", "HEAD"]);
    if (tagged.status !== 0) failures.push(`source release tag does not resolve to a commit: ${value}`);
    if (head.status !== 0) failures.push("unable to resolve checked-out HEAD");
    if (tagged.status === 0 && head.status === 0 && tagged.stdout !== head.stdout) {
      failures.push(`source release tag ${value} does not point at checked-out HEAD`);
    }
  }

  const content = git(cwd, ["diff", "--quiet", "HEAD", "--"]);
  if (content.status === 1) {
    failures.push("tracked repository content differs from checked-out HEAD");
  } else if (content.status !== 0) {
    failures.push("unable to compare tracked repository content with checked-out HEAD");
  }

  try {
    const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8")) as {
      readonly version?: unknown;
      readonly private?: unknown;
    };
    if (pkg.private !== true) failures.push("root package.json must remain private");
    if (typeof pkg.version !== "string") {
      failures.push("root package.json version must be a string");
    } else if (pkg.version !== value.slice(1)) {
      failures.push(`package.json version ${pkg.version} does not match source release ${value}`);
    }
  } catch {
    failures.push("unable to read root package.json release identity");
  }

  return failures;
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  const release = process.env.FIGHTLAB_RELEASE;
  const failures = validateSourceReleaseIdentity({ cwd: process.cwd(), release });
  if (failures.length) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exit(1);
  }
  console.log(`Source release identity verified: ${release}`);
}
