import { describe, expect, it } from "vitest";

import { POSE_COUNT } from "boneyard";

import { ACTION_TYPES, DEFAULT_ACTIONS } from "../../src/battle/actions.ts";
import { FIGHTLAB_FIGHTER } from "../../src/combat/moves.ts";
import { STATE_CLIPS } from "../../src/render/animation.ts";
import { clipNamed } from "../../src/render/clips.ts";

const MOVES = Object.values(FIGHTLAB_FIGHTER.moves);

describe("frame data and the clips that present it", () => {
  it("names only clips Boneyard's catalog has, each with the normalised pose count", () => {
    for (const clip of [...MOVES.map((move) => move.animation), ...Object.values(STATE_CLIPS)]) {
      expect(clipNamed(clip).poses).toHaveLength(POSE_COUNT);
    }
  });

  it("uses original authored clips with durations matched to the combat moves", () => {
    for (const move of MOVES.filter((candidate) => candidate.hitboxes.length > 0)) {
      expect(move.animation, move.id).toMatch(/^lab/);
      expect(clipNamed(move.animation).duration, move.id).toBe(move.duration);
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
