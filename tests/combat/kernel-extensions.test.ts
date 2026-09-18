import { describe, expect, it } from "vitest";

import { MARKS } from "../../src/combat/adapter.ts";
import { CombatSimulation } from "../../src/combat/kernel/index.ts";
import type { Command, FighterDefinition, FrameReport } from "../../src/combat/kernel/index.ts";
import { FIGHTLAB_FIGHTER, PARRY } from "../../src/combat/moves.ts";

/**
 * The kernel's generic hooks for whatever runs around it: a parry's committed heal, exposure that
 * the next landed hit consumes, and afflictions between ticks. It never learns what a mod is.
 */

const move = (id: string, extra: { bonus?: number; heal?: number } = {}): Command => ({ kind: "move", move: id, ...extra });

function simulation(definitions: readonly [FighterDefinition, FighterDefinition] = [FIGHTLAB_FIGHTER, FIGHTLAB_FIGHTER]): CombatSimulation {
  return new CombatSimulation({ definitions, startX: MARKS });
}

function run(sim: CombatSimulation, commands: readonly [Command, Command], idle: number): FrameReport[] {
  const reports = [sim.step(commands)];
  for (let tick = 0; tick < idle; tick++) reports.push(sim.step([null, null]));
  return reports;
}

const contacts = (reports: readonly FrameReport[]) => reports.flatMap((report) => report.contacts);

describe("a parry's committed heal", () => {
  it("adds to the parry's own heal, never past maximum health", () => {
    const healer: FighterDefinition = { ...FIGHTLAB_FIGHTER, moves: { ...FIGHTLAB_FIGHTER.moves, parry: { ...PARRY, parry: { ...PARRY.parry!, heal: 5 } } } };
    for (const [start, extra, healed] of [[80, 4, 9], [95, 4, 5], [80, 0, 5]]) {
      const sim = simulation([FIGHTLAB_FIGHTER, healer]);
      sim.getState().fighters[1].health = start;
      const reports = run(sim, [move("jab"), move("parry", { heal: extra })], 5);
      expect(contacts(reports)).toMatchObject([{ parried: true, heal: healed }]);
      expect(sim.getState().fighters[1].health).toBe(start + healed);
    }
  });

  it("belongs to the parry: nothing carries it once the move is over", () => {
    const sim = simulation();
    run(sim, [move("jab"), move("parry", { heal: 4 })], 80);
    expect(sim.getState().fighters.map((fighter) => fighter.heal)).toEqual([0, 0]);
  });
});

describe("exposure", () => {
  it("adds all of itself to the first hit that lands, and is gone after it", () => {
    const sim = simulation();
    sim.expose(1, 4);
    const first = run(sim, [move("jab"), null], 60);
    expect(contacts(first)).toMatchObject([{ target: "opponent", damage: 12 + 4, exposed: 4 }]);
    expect(sim.getState().fighters[1].exposure).toBe(0);
    // Knockback carried them apart; put them back on their marks for a second jab.
    sim.getState().fighters.forEach((fighter, index) => { fighter.x = MARKS[index]; });
    const second = run(sim, [move("jab"), null], 60);
    expect(contacts(second)).toMatchObject([{ damage: 12, exposed: 0 }]);
    expect(sim.getState().fighters[1].health).toBe(100 - 16 - 12);
  });

  it("survives a hit that a parry absorbs", () => {
    const sim = simulation();
    sim.expose(1, 4);
    run(sim, [move("jab"), move("parry")], 5);
    expect(sim.getState().fighters[1]).toMatchObject({ exposure: 4, health: 100 });
  });

  it("is consumed on each side of a trade by the hit that side takes", () => {
    const sim = simulation();
    sim.expose(0, 2);
    sim.expose(1, 5);
    run(sim, [move("jab"), move("jab")], 5);
    expect(sim.getState().fighters.map((fighter) => fighter.health)).toEqual([100 - 12 - 2, 100 - 12 - 5]);
  });
});

describe("afflictions", () => {
  it("take health outside contact, never below zero, and report it", () => {
    const sim = simulation();
    run(sim, [null, null], 3);
    // Four ticks have run, so it joins the last of them.
    expect(sim.afflict(1, 5)).toEqual([{ frame: 3, kind: "afflicted", fighter: "opponent", detail: "-5 health" }]);
    expect(sim.getState().fighters[1].health).toBe(95);
    expect(sim.afflict(0, 0)).toEqual([]);
  });

  it("knock a fighter out at zero, exactly as a hit would leave it", () => {
    const sim = simulation();
    const events = sim.afflict(0, 500);
    expect(events.map((event) => event.kind)).toEqual(["afflicted", "defeated"]);
    expect(sim.getState().fighters[0]).toMatchObject({ health: 0, mode: "defeated" });
    expect(sim.afflict(0, 5)).toEqual([]);
  });

  it("refuse a heal, an exposure or an affliction that is not a whole, non-negative number", () => {
    expect(() => simulation().step([move("parry", { heal: 1.5 }), null])).toThrow(/whole number/);
    expect(() => simulation().expose(0, -1)).toThrow(/whole number/);
    expect(() => simulation().afflict(1, 2.5)).toThrow(/whole number/);
  });
});
