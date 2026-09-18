import { describe, expect, it } from "vitest";

import { compileBuild } from "../../src/mods/compile.ts";
import { fightFor, playFight, reportOf, resumeFight } from "../../src/game/fight.ts";
import { Match } from "../../src/game/match.ts";
import { combatSide } from "../../src/game/sides.ts";
import { opponentFor } from "../../src/run/opponents.ts";
import { beginFight, buy, newRun, setAction } from "../../src/run/run.ts";
import type { RunState } from "../../src/run/run.ts";

function armed(seed: number): RunState {
  const run = newRun(seed);
  run.money = 40;
  run.shop = { ...run.shop, offers: ["solar-flare", "null-reservoir", "thunderhead", "venom-tap", "void-tap"] };
  // Solar Flare along the top and down the middle, Null Reservoir in the bottom-left corner, Venom Tap upright on the right.
  for (const [offer, x, y, rotation] of [[0, 0, 0, 0], [1, 0, 1, 0], [3, 2, 1, 1]] as const) {
    if (buy(run, offer, { grid: { x, y, rotation } }) !== null) throw new Error(`offer ${offer} did not fit`);
  }
  setAction(run, "secondary", 0, "tech");
  beginFight(run);
  return run;
}

/** What the simulation decided, without the presentation counters. */
const state = (match: Match) => JSON.parse(JSON.stringify({ battle: match.battle, combat: match.arena.state, decisions: match.decisions }));

const everyOther = (match: Match) => match.battle.round % 2 === 1;

describe("the day's fight", () => {
  it("puts the player's bars and compiled grid against the opponent the seed made for the day", () => {
    const run = armed(8080);
    const { opponent, config } = fightFor(run);
    expect(opponent).toEqual(opponentFor(8080, 1));
    expect(config.player).toBe(run.loadout);
    expect(config.opponent).toBe(opponent.plan);
    expect(config.sides[0]).toEqual(combatSide(compileBuild(run.grid)));
    expect(config.sides[1]).toEqual(combatSide(compileBuild(opponent.grid)));
    // The compiled grid reaches the fight: lane damage on the side, every placed mod in the program.
    expect(config.sides[0].bonus.strike).toBeGreaterThan(0);
    expect(config.programs[0]).toEqual(compileBuild(run.grid).program);
    expect(config.programs[0].mods.map((mod) => mod.definition.id)).toEqual(["solar-flare", "null-reservoir", "venom-tap"]);
    expect(config.programs[1]).toEqual(compileBuild(opponent.grid).program);
  });

  it("plays to a result the run can pay out on", () => {
    const match = playFight(fightFor(armed(8080)).config, everyOther);
    const report = reportOf(match);
    expect(report.rounds).toBe(match.battle.round);
    expect(report.peakStyle).toBe(match.style()[0].peak);
    expect(["victory", "defeat", "draw"]).toContain(report.result);
    expect(() => reportOf(resumeFight(fightFor(armed(8080)).config, []))).toThrow(/not over/);
  });

  it("gives the same builds, bars and decisions the same fight", () => {
    const first = playFight(fightFor(armed(515)).config, everyOther);
    const second = playFight(fightFor(armed(515)).config, everyOther);
    expect(state(second)).toEqual(state(first));
  });

  it("resumes from recorded decisions at the start of the round after the last one, exactly where play left it", () => {
    const { config } = fightFor(armed(8080));
    // Watch a whole fight, keeping the state at the start of every round.
    const live = new Match(config);
    const starts = [state(live)];
    for (let guard = 0; !live.over && guard < 1_000_000; guard++) {
      if (live.paused) {
        if (everyOther(live)) live.mixup();
        live.nextRound();
        if (!live.over) starts.push(state(live));
      } else {
        live.step();
      }
    }
    expect(starts.length).toBeGreaterThan(1);
    for (let rounds = 0; rounds < starts.length; rounds++) {
      expect(state(resumeFight(config, live.decisions.slice(0, rounds))), `after ${rounds} decisions`).toEqual(starts[rounds]);
    }
  });
});
