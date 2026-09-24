import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";

import { validateSourceReleaseIdentity } from "./release-identity.ts";

const ROOT_GITIGNORE = readFileSync(new URL("../.gitignore", import.meta.url), "utf8");

function git(cwd: string, args: readonly string[]): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(
    result.status,
    0,
    "git " + args.join(" ") + " failed\nstdout: " + (result.stdout ?? "") + "\nstderr: " + (result.stderr ?? ""),
  );
  return (result.stdout ?? "").trim();
}

function repository(t: TestContext, version = "1.2.3"): string {
  const cwd = mkdtempSync(join(tmpdir(), "fightlab-release-identity-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));

  git(cwd, ["init", "-q"]);
  git(cwd, ["config", "user.name", "FightLab Tests"]);
  git(cwd, ["config", "user.email", "fightlab-tests@example.invalid"]);
  writeFileSync(join(cwd, ".gitignore"), ROOT_GITIGNORE);
  writeFileSync(
    join(cwd, "package.json"),
    JSON.stringify({ name: "fightlab", version, private: true }, null, 2) + "\n",
  );
  writeFileSync(join(cwd, "source.txt"), "source\n");
  git(cwd, ["add", "."]);
  git(cwd, ["commit", "-q", "-m", "source"]);
  return cwd;
}

function annotate(cwd: string, release = "v1.2.3"): void {
  git(cwd, ["tag", "-a", release, "-m", release]);
}

test("accepts a correctly annotated semantic tag at exact HEAD", (t) => {
  const cwd = repository(t);
  annotate(cwd);

  assert.deepEqual(validateSourceReleaseIdentity({ cwd, release: "v1.2.3" }), []);
});

test("rejects a lightweight tag", (t) => {
  const cwd = repository(t);
  git(cwd, ["tag", "v1.2.3"]);

  assert.deepEqual(validateSourceReleaseIdentity({ cwd, release: "v1.2.3" }), [
    "source release tag must be annotated: v1.2.3",
  ]);
});

test("rejects malformed release semver", (t) => {
  const cwd = repository(t);

  assert.deepEqual(validateSourceReleaseIdentity({ cwd, release: "v1.2" }), [
    "source release must match semantic vX.Y.Z: v1.2",
  ]);
});

test("rejects a package version that does not match the tag", (t) => {
  const cwd = repository(t, "1.2.4");
  annotate(cwd);

  assert.deepEqual(validateSourceReleaseIdentity({ cwd, release: "v1.2.3" }), [
    "package.json version 1.2.4 does not match source release v1.2.3",
  ]);
});

test("rejects an annotated tag that points at a different commit", (t) => {
  const cwd = repository(t);
  annotate(cwd);
  writeFileSync(join(cwd, "source.txt"), "next\n");
  git(cwd, ["add", "source.txt"]);
  git(cwd, ["commit", "-q", "-m", "next"]);

  assert.deepEqual(validateSourceReleaseIdentity({ cwd, release: "v1.2.3" }), [
    "source release tag v1.2.3 does not point at checked-out HEAD",
  ]);
});

test("source release tree excludes local dist and copied Boneyard build assets", (t) => {
  const cwd = repository(t);
  annotate(cwd);

  mkdirSync(join(cwd, "dist", "fighters"), { recursive: true });
  writeFileSync(join(cwd, "dist", "fighters", "copied-boneyard-figure.json"), "{}\n");
  mkdirSync(join(cwd, "dist", "assets"), { recursive: true });
  writeFileSync(join(cwd, "dist", "assets", "copied-boneyard-clips.json"), "{}\n");

  assert.equal(
    git(cwd, ["check-ignore", "dist/fighters/copied-boneyard-figure.json"]),
    "dist/fighters/copied-boneyard-figure.json",
  );
  assert.equal(git(cwd, ["ls-files", "dist"]), "");

  const releaseTree = git(cwd, ["ls-tree", "-r", "--name-only", "v1.2.3"])
    .split("\n")
    .filter(Boolean);
  assert.equal(releaseTree.some((path) => path === "dist" || path.startsWith("dist/")), false);
  assert.equal(releaseTree.some((path) => path.includes("copied-boneyard")), false);
  assert.deepEqual(validateSourceReleaseIdentity({ cwd, release: "v1.2.3" }), []);
});
