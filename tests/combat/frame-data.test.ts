import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { POSE_COUNT } from "boneyard";
import { BONEYARD_ROOT } from "boneyard/paths";

import { ACTION_TYPES, DEFAULT_ACTIONS } from "../../src/battle/actions.ts";
import { FIGHTLAB_FIGHTER } from "../../src/combat/moves.ts";
import { STATE_CLIPS } from "../../src/render/animation.ts";
import { clipNamed } from "../../src/render/clips.ts";

interface ManifestClip {
  readonly key: string;
  readonly contactTargetFrame?: number;
}

// Boneyard's record of how each capture was retargeted, including the tick its contact pose was
// warped onto. The binding has to hold across the repository line, so it is read from there.
const manifest = JSON.parse(readFileSync(join(BONEYARD_ROOT, "motions", "bandai-namco-motiondataset-1.json"), "utf8")) as {
  readonly clips: readonly ManifestClip[];
};

const MOVES = Object.values(FIGHTLAB_FIGHTER.moves);

describe("frame data and the clips that present it", () => {
  it("names only clips Boneyard's catalog has, each with the normalised pose count", () => {
    for (const clip of [...MOVES.map((move) => move.animation), ...Object.values(STATE_CLIPS)]) {
      expect(clipNamed(clip).poses).toHaveLength(POSE_COUNT);
    }
  });

  it("lands every retargeted contact pose inside its move's active window", () => {
    for (const move of MOVES.filter((candidate) => candidate.hitboxes.length > 0)) {
      const record = manifest.clips.find(({ key }) => key === move.animation);
      expect(record?.contactTargetFrame, `${move.id} plays ${move.animation}, which has no contact frame`).toEqual(expect.any(Number));
      for (const hitbox of move.hitboxes) {
        expect(record!.contactTargetFrame!, `${move.id}/${hitbox.id}`).toBeGreaterThanOrEqual(hitbox.startFrame);
        expect(record!.contactTargetFrame!, `${move.id}/${hitbox.id}`).toBeLessThanOrEqual(hitbox.endFrame);
      }
    }
  });

  it("plays a hitting move's clip over exactly the move's ticks", () => {
    for (const move of MOVES.filter((candidate) => candidate.hitboxes.length > 0)) {
      expect(clipNamed(move.animation).duration, move.id).toBe(move.duration);
    }
  });

  it("gives every action a move the fighter has", () => {
    for (const action of ACTION_TYPES) {
      expect(FIGHTLAB_FIGHTER.moves[DEFAULT_ACTIONS[action].move], action).toBeDefined();
    }
  });

  it("puts a jab out before an overhead leaves startup, which is what makes Strike beat Tech", () => {
    const { jab, overhead, parry } = FIGHTLAB_FIGHTER.moves;
    expect(jab.hitboxes[0].startFrame).toBeLessThan(overhead.hitboxes[0].startFrame);
    expect(overhead.hitboxes.every((hitbox) => hitbox.breaksGuard)).toBe(true);
    expect(jab.hitboxes.some((hitbox) => hitbox.breaksGuard)).toBe(false);
    expect(parry.hitboxes).toHaveLength(0);
    expect(parry.parry!.startFrame).toBeLessThan(jab.hitboxes[0].startFrame);
    expect(parry.parry!.endFrame).toBeGreaterThanOrEqual(jab.hitboxes[0].endFrame);
  });
});
