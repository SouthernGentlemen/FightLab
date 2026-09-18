import { describe, expect, it } from "vitest";

import { depthProfileName } from "boneyard";
import { BONEYARD_ROOT } from "boneyard/paths";
import { visualPaintOrder } from "boneyard/render/depth";
import { assembleFigureBones, loadFigure } from "boneyard/render/sheet";

import { fighterArt } from "../../pipelines/figures.ts";
import type { FighterState } from "../../src/combat/kernel/index.ts";
import { FIGHTLAB_FIGHTER } from "../../src/combat/moves.ts";
import { FIGURES, PLAYER_FIGURE } from "../../src/game/roster.ts";
import { OPPONENT_FIGURES } from "../../src/run/opponents.ts";
import { STATE_CLIPS, animationFor } from "../../src/render/animation.ts";
import type { AnimationContext } from "../../src/render/animation.ts";
import { clipNamed, clipOrigin } from "../../src/render/clips.ts";
import { figureModel } from "../../src/render/figure.ts";

const IDLE: FighterState = {
  id: "player", x: 0, vx: 0, facing: 1, mode: "idle", stateFrame: 3, move: null, moveFrame: 0, bonus: 0, heal: 0, exposure: 0,
  health: 100, hitstop: 0, stun: 0, hitTargets: [],
};
const FIGHTING: AnimationContext = { idleFrame: null, finish: null };

describe("figures from Boneyard", () => {
  it("draws the authored fighter for the player and every opponent figure the run can meet", () => {
    expect(FIGURES).toEqual(["fighter", "barst", "kiran", "yuliya"]);
    expect(FIGURES).toEqual([PLAYER_FIGURE, ...OPPONENT_FIGURES]);
  });

  it.each([...FIGURES])("serves %s exactly as Boneyard's own loader assembled it", (id) => {
    const art = fighterArt(id);
    const figure = loadFigure(BONEYARD_ROOT, id);
    expect(art.rig).toEqual(figure.rig.contract);
    for (const [bone, assembled] of assembleFigureBones(figure)) expect(art.bones[bone]).toEqual(Object.fromEntries(assembled.layers));

    const model = figureModel(JSON.parse(JSON.stringify(art)));
    expect(model.rig.bones.map((bone) => bone.name)).toEqual(figure.rig.bones.map((bone) => bone.name));
    expect(model.name).toBe(figure.manifest.name);
  });

  it("serves figures by id and never by path", () => {
    expect(() => fighterArt("../package")).toThrow(/not a figure id/);
    expect(() => fighterArt("figures/barst")).toThrow(/not a figure id/);
    expect(() => fighterArt("nobody")).toThrow();
  });

  it("refuses art missing a bone's layers", () => {
    const art = fighterArt(OPPONENT_FIGURES[0]);
    const { head: _head, ...headless } = art.bones;
    expect(() => figureModel({ ...art, bones: headless })).toThrow(/'head'/);
  });
});

describe("choosing what presents a fighter", () => {
  it("covers every combat state with a clip Boneyard has and can paint from either side", () => {
    const rig = figureModel(fighterArt(PLAYER_FIGURE)).rig;
    const states: FighterState[] = [
      IDLE,
      { ...IDLE, mode: "walk" },
      { ...IDLE, mode: "hitstun" },
      { ...IDLE, mode: "defeated" },
      ...Object.keys(FIGHTLAB_FIGHTER.moves).map((move) => ({ ...IDLE, mode: "move" as const, move, moveFrame: 4 })),
    ];
    const contexts: AnimationContext[] = [
      FIGHTING,
      { idleFrame: 12, finish: null },
      { idleFrame: null, finish: { ticks: 30, won: true } },
      { idleFrame: null, finish: { ticks: 30, won: false } },
    ];
    for (const state of states) {
      for (const context of contexts) {
        const shown = animationFor(state, FIGHTLAB_FIGHTER, context);
        expect(() => clipNamed(shown.clip)).not.toThrow();
        const profile = depthProfileName(rig, shown.clip, clipOrigin(shown.clip));
        for (const facing of [1, -1] as const) expect(visualPaintOrder(rig, facing, profile)).toHaveLength(rig.bones.length);
      }
    }
  });

  it("samples a move at its own frame, idles on the presentation clock while planning, and waves the winner", () => {
    expect(animationFor({ ...IDLE, mode: "move", move: "jab", moveFrame: 6 }, FIGHTLAB_FIGHTER, FIGHTING))
      .toEqual({ clip: "bnrStrikeNormal", frame: 6 });
    expect(animationFor(IDLE, FIGHTLAB_FIGHTER, { idleFrame: 40, finish: null })).toEqual({ clip: STATE_CLIPS.idle, frame: 40 });
    expect(animationFor(IDLE, FIGHTLAB_FIGHTER, { idleFrame: null, finish: { ticks: 9, won: true } }))
      .toEqual({ clip: STATE_CLIPS.victory, frame: 9 });
    expect(animationFor({ ...IDLE, mode: "defeated", stateFrame: 20 }, FIGHTLAB_FIGHTER, { idleFrame: null, finish: { ticks: 5, won: false } }))
      .toEqual({ clip: STATE_CLIPS.defeated, frame: 25 });
  });
});
