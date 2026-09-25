import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { BONEYARD_ROOT } from "boneyard/paths";

const root = new URL("../", import.meta.url).pathname;
const dist = join(root, "dist");
const runner = JSON.parse(readFileSync(join(BONEYARD_ROOT, "figures/runner.json"), "utf8"));
assert.equal(runner.contract, 1);
assert.deepEqual(runner.cosmetics, []);
assert.ok(Object.values(runner.parts as Record<string, string>).every((part) => part.startsWith("characters/fighter/parts/") && part.endsWith(".svg")));

const fighterFiles = readdirSync(join(dist, "fighters"));
assert.deepEqual(fighterFiles, ["runner.json"]);
const art = JSON.parse(readFileSync(join(dist, "fighters/runner.json"), "utf8"));
assert.equal(art.figure, "runner");
assert.equal(Object.values(art.bones as Record<string, Record<string, string>>).flatMap(Object.values).filter(Boolean).length, 11);

const scriptFiles = readdirSync(join(dist, "assets")).filter((file) => file.endsWith(".js"));
assert.ok(scriptFiles.length > 0);
for (const file of scriptFiles) {
  const javascript = readFileSync(join(dist, "assets", file), "utf8");
  assert.doesNotMatch(javascript, /bnr(?:Idle|Walk|Crouch|Strike|Sword)|barst|kiran|yuliya|Bandai|Fire Emblem/i, file);
  for (const clip of ["labIdle", "labWalk", "labStagger", "labStrike", "labOverhead", "labGuard", "labWave"]) {
    assert.ok(javascript.includes(clip), `${file} lacks original clip ${clip}`);
  }
}

const version = JSON.parse(readFileSync(join(dist, "version.json"), "utf8"));
const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
assert.equal(version.product, "fightlab");
assert.equal(version.commit, commit);
assert.equal(version.release, process.env.FIGHTLAB_RELEASE || "development");
console.log(`Public build contains only the original runner and seven lab clips at ${commit}`);
