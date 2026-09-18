import { describe, expect, it } from "vitest";

import type { ActionProgram } from "../../src/battle/program.ts";
import { MARKS } from "../../src/combat/adapter.ts";
import { FixedClock, MAX_FRAME_MS } from "../../src/game/clock.ts";
import { Match } from "../../src/game/match.ts";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "../../src/game/settings.ts";

function finish(match: Match): void {
  for (let guard = 0; !match.over && guard < 200_000; guard++) match.step();
  expect(match.over).toBe(true);
}

describe("a match", () => {
  it("defaults the player to five strikes and simulates nothing while planning", () => {
    const match = new Match();
    expect(match.battle.playerProgram).toEqual(["strike", "strike", "strike", "strike", "strike"]);
    for (let tick = 0; tick < 300; tick++) match.step();
    expect(match.arena.state.tick).toBe(0);
    expect(match.presentationTick).toBe(300);
    expect(match.arena.state.fighters.map((fighter) => fighter.x)).toEqual([...MARKS]);
  });

  it("locks the program when the fight starts", () => {
    const match = new Match();
    match.setSlot(4, "block");
    match.fight();
    expect(() => match.setSlot(0, "tech")).toThrow(/locked/);
    expect(match.battle.playerProgram[4]).toBe("block");
  });

  it("stops the simulation at the knockout", () => {
    const match = new Match();
    match.fight();
    finish(match);
    const combat = JSON.stringify(match.arena.state);
    const events = match.events.length;
    for (let tick = 0; tick < 600; tick++) match.step();
    expect(JSON.stringify(match.arena.state)).toBe(combat);
    expect(match.events).toHaveLength(events);
    expect(match.endedAt).not.toBeNull();
  });

  it("rematches from a clean simulation with the player's program intact", () => {
    const program: ActionProgram = ["tech", "block", "strike", "block", "tech"];
    const match = new Match(undefined, program);
    const firstArena = match.arena;
    match.fight();
    finish(match);
    match.rematch();
    expect(match.arena).not.toBe(firstArena);
    expect(match.battle).toMatchObject({ phase: "planning", actionIndex: 0, cycle: 0, history: [], outcome: null, tick: 0, exchange: null });
    expect(match.battle.playerProgram).toEqual(program);
    expect(match.events).toEqual([]);
    expect(match.presentationTick).toBe(0);
    expect(match.endedAt).toBeNull();
    const [player, opponent] = match.arena.state.fighters;
    expect([player.health, opponent.health, player.x, opponent.x]).toEqual([100, 100, ...MARKS]);
    expect(match.arena.state.tick).toBe(0);

    match.fight();
    finish(match);
    expect(match.battle.history.length).toBeGreaterThan(0);
  });
});

describe("the fixed-step clock", () => {
  it("turns elapsed time into whole ticks, carrying the remainder", () => {
    const clock = new FixedClock();
    expect(clock.advance(10, 1)).toBe(0);
    expect(clock.advance(10, 1)).toBe(1);
    expect(clock.advance(1000, 1)).toBe(Math.floor((MAX_FRAME_MS + 20 - 1000 / 60) / (1000 / 60)));
  });

  it("owes more ticks per frame at a higher speed and none for a negative interval", () => {
    const at = (speed: 1 | 2 | 4) => new FixedClock().advance(50, speed);
    expect([at(1), at(2), at(4)]).toEqual([3, 6, 12]);
    expect(new FixedClock().advance(-30, 4)).toBe(0);
  });
});

describe("settings", () => {
  it("round-trips a speed and falls back to defaults for anything else", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value) };
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
    saveSettings({ speed: 4 }, storage);
    expect(loadSettings(storage)).toEqual({ speed: 4 });
    store.set("fightlab.settings", JSON.stringify({ speed: 3 }));
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
    store.set("fightlab.settings", "{not json");
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
  });

  it("works with no storage at all", () => {
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings({ speed: 2 }, null)).not.toThrow();
    expect(() => saveSettings({ speed: 2 }, { setItem: () => { throw new Error("quota"); } })).not.toThrow();
  });
});
