#!/usr/bin/env node
/**
 * The Boneyard pin: `check:boneyard` and `pin:boneyard`.
 *
 * FightLab links Boneyard from the sibling checkout, which on its own means any edit over there
 * reaches the game on the next reload. The pin turns that into a decision. It records the commit
 * FightLab was verified against and a digest of every file FightLab reads out of Boneyard, and
 * the check fails the moment the installed copy differs. Boneyard has no remote, so neither a git
 * URL nor a submodule can hold the pin; a digest of the consumed bytes can, and unlike a commit
 * hash it also catches an uncommitted edit.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { BONEYARD_ROOT } from "boneyard/paths";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const PIN_PATH = join(ROOT, "boneyard.pin.json");

/**
 * Everything FightLab reads out of Boneyard — at runtime, at build time or in a test. A change
 * anywhere else in Boneyard cannot reach this game, so it does not disturb the pin. A new
 * import from Boneyard is added here in the same change.
 */
export const CONSUMED = [
  "package.json",
  "src",
  "pipelines/render/sheet.ts",
  "pipelines/render/depth.ts",
  "pipelines/render/manifest.ts",
  "rigs",
  "figures",
  "characters",
  "cosmetics",
  "catalog",
  "motions/bandai-namco-motiondataset-1.json",
] as const;

/**
 * Boneyard keeps working files beside its assets that nothing downstream reads: the atlases its
 * tracer reads, the schemas an author validates against, its own byte ratchet. Dotfiles are
 * whatever the host dropped there.
 */
function isConsumed(path: string): boolean {
  const name = path.slice(path.lastIndexOf("/") + 1);
  return !name.startsWith(".") && !/(?:atlas\.(?:png|json)|\.schema\.json|footprint\.baseline\.json)$/.test(name);
}

function filesUnder(root: string, entry: string): string[] {
  const path = join(root, entry);
  if (!existsSync(path)) throw new Error(`boneyard has no '${entry}'; FightLab reads it`);
  if (!statSync(path).isDirectory()) return [entry];
  return readdirSync(path).sort().flatMap((name) => filesUnder(root, `${entry}/${name}`));
}

export interface Pin {
  readonly commit: string;
  readonly digest: string;
  readonly files: number;
}

export interface Installed {
  readonly commit: string | null;
  readonly digest: string;
  readonly files: number;
  readonly dirty: readonly string[];
}

export function installedBoneyard(root = BONEYARD_ROOT): Installed {
  const files = CONSUMED.flatMap((entry) => filesUnder(root, entry)).filter(isConsumed).sort();
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(`${file}\0`);
    hash.update(readFileSync(join(root, file)));
    hash.update("\0");
  }
  return { commit: git(root, ["rev-parse", "HEAD"]), digest: `sha256:${hash.digest("hex")}`, files: files.length, dirty: dirtyPaths(root) };
}

function git(root: string, args: readonly string[]): string | null {
  try {
    return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function dirtyPaths(root: string): string[] {
  const status = git(root, ["status", "--porcelain", "--untracked-files=all", "--", ...CONSUMED]);
  if (!status) return [];
  return status.split("\n").map((line) => line.slice(3)).filter(isConsumed);
}

export function readPin(path = PIN_PATH): Pin {
  const pin = JSON.parse(readFileSync(path, "utf8")) as Partial<Pin>;
  if (typeof pin.commit !== "string" || typeof pin.digest !== "string" || typeof pin.files !== "number") {
    throw new Error(`${path} is not a Boneyard pin; run npm run pin:boneyard`);
  }
  return pin as Pin;
}

export interface PinCheck {
  readonly ok: boolean;
  readonly pinned: Pin;
  readonly installed: Installed;
  readonly fix?: string;
}

export function checkPin(root = BONEYARD_ROOT, path = PIN_PATH): PinCheck {
  const pinned = readPin(path);
  const installed = installedBoneyard(root);
  if (installed.digest === pinned.digest) return { ok: true, pinned, installed };
  const short = pinned.commit.slice(0, 7);
  return {
    ok: false,
    pinned,
    installed,
    fix: `the Boneyard that FightLab reads has changed since ${short}. Either check out ${short} in ${root}, or `
      + `review the change (git -C ${root} diff ${short} -- ${CONSUMED.join(" ")}), run npm run verify against it `
      + "and accept it with npm run pin:boneyard",
  };
}

function short(value: string | null): string {
  return value === null ? "(no git)" : value.slice(0, 7);
}

function main(argv: readonly string[]): number {
  const json = argv.includes("--json");
  try {
    if (argv.includes("--update")) {
      const installed = installedBoneyard();
      if (installed.commit === null) throw new Error("Boneyard is not a git checkout, so there is no commit to pin");
      if (installed.dirty.length > 0) {
        throw new Error(`commit Boneyard first; a pin names a commit and these consumed files are not in one: ${installed.dirty.join(", ")}`);
      }
      const pin: Pin = { commit: installed.commit, digest: installed.digest, files: installed.files };
      writeFileSync(PIN_PATH, `${JSON.stringify(pin, null, 2)}\n`);
      if (json) console.log(JSON.stringify({ ok: true, updated: true, ...pin }, null, 2));
      else console.log(`pin:boneyard: pinned ${installed.files} Boneyard files at ${short(installed.commit)} (${installed.digest.slice(0, 19)}…)`);
      return 0;
    }

    const result = checkPin();
    if (json) console.log(JSON.stringify(result, null, 2));
    else if (result.ok) {
      console.log(`check:boneyard: ${result.installed.files} Boneyard files match the pin at ${short(result.pinned.commit)}`);
    } else {
      const dirty = result.installed.dirty.length > 0 ? `; uncommitted: ${result.installed.dirty.join(", ")}` : "";
      console.error(`check:boneyard: installed Boneyard ${short(result.installed.commit)} (${result.installed.files} files${dirty}) `
        + `does not match the pin ${short(result.pinned.commit)} (${result.pinned.files} files) — ${result.fix}`);
    }
    return result.ok ? 0 : 1;
  } catch (error) {
    const message = (error as Error).message;
    if (json) console.log(JSON.stringify({ ok: false, error: message }, null, 2));
    else console.error(`boneyard pin: ${message}`);
    return 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
