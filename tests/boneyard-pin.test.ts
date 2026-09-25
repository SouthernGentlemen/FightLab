import { appendFileSync, cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { BONEYARD_ROOT } from "boneyard/paths";

import { CONSUMED, checkPin, installedBoneyard, readPin } from "../pipelines/pin.ts";

function withCopy(run: (copy: string) => void): void {
  const copy = mkdtempSync(join(tmpdir(), "fightlab-pin-"));
  try {
    for (const entry of CONSUMED) cpSync(join(BONEYARD_ROOT, entry), join(copy, entry), { recursive: true });
    run(copy);
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
}

describe("the Boneyard pin", () => {
  it("matches the installed Boneyard", () => {
    const result = checkPin();
    expect(result.ok, result.fix).toBe(true);
    expect(result.installed.files).toBe(readPin().files);
  });

  it("notices a changed byte, an added file and a removed file in anything FightLab reads", () => {
    withCopy((copy) => {
      const pinned = readPin().digest;
      expect(installedBoneyard(copy).digest).toBe(pinned);

      appendFileSync(join(copy, "rigs", "fighter.rig.json"), " ");
      const edited = checkPin(copy);
      expect(edited.ok).toBe(false);
      expect(edited.fix).toMatch(/npm run pin:boneyard/);
    });
    withCopy((copy) => {
      writeFileSync(join(copy, "figures", "newcomer.json"), "{}\n");
      expect(checkPin(copy).ok).toBe(false);
    });
    withCopy((copy) => {
      rmSync(join(copy, "characters", "fighter", "parts", "head.svg"));
      expect(checkPin(copy).ok).toBe(false);
    });
  });

  it("ignores what FightLab never reads", () => {
    withCopy((copy) => {
      writeFileSync(join(copy, "characters", "fighter", "atlas.png"), "temporary");
      writeFileSync(join(copy, "figures", ".DS_Store"), "finder");
      expect(checkPin(copy).ok).toBe(true);
    });
  });
});
