import { describe, expect, it } from "vitest";

import { defaultLoadout } from "../../src/battle/bars.ts";
import { MARKS } from "../../src/combat/adapter.ts";
import { FixedClock, MAX_FRAME_MS } from "../../src/game/clock.ts";
import { Match } from "../../src/game/match.ts";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "../../src/game/settings.ts";

function untilPaused(match: Match): void {
  for (let guard = 0; !match.paused && !match.over && guard < 200_000; guard++) match.step();
  expect(match.paused || match.over).toBe(true);
}

function finish(match: Match): void {
  for (let guard = 0; !match.over && guard < 200_000; guard++) {
    if (match.paused) match.nextRound();
    else match.step();
  }
  expect(match.over).toBe(true);
}

describe("a match", () => {
  it("begins at tick 0 in round 1's intro, both fighters on their marks, with nothing to edit", () => {
    const match = new Match();
    expect(match.battle).toMatchObject({ phase: "round-intro", round: 1, tick: 0, bars: ["primary", "primary"] });
    expect(match.battle.playerLoadout).toEqual(defaultLoadout());
    expect(match.arena.state.tick).toBe(0);
    expect(match.arena.state.fighters.map((fighter) => fighter.x)).toEqual([...MARKS]);
    expect("setSlot" in match).toBe(false);
  });

  it("simulates nothing while paused, and keeps the idle stance moving on the presentation clock", () => {
    const match = new Match();
    untilPaused(match);
    expect(match.paused).toBe(true);
    const combat = JSON.stringify(match.arena.state);
    const tick = match.presentationTick;
    for (let step = 0; step < 300; step++) match.step();
    expect(JSON.stringify(match.arena.state)).toBe(combat);
    expect(match.presentationTick).toBe(tick + 300);
  });

  it("records every decision the player makes at a pause", () => {
    const match = new Match();
    untilPaused(match);
    match.mixup();
    match.nextRound();
    untilPaused(match);
    match.mixup();
    match.mixup();
    match.nextRound();
    expect(match.decisions).toEqual([true, false]);
    expect(() => match.mixup()).toThrow(/while round-intro/);
  });

  it("stops the simulation at the knockout", () => {
    const match = new Match();
    finish(match);
    const combat = JSON.stringify(match.arena.state);
    const events = match.events.length;
    for (let tick = 0; tick < 600; tick++) match.step();
    expect(JSON.stringify(match.arena.state)).toBe(combat);
    expect(match.events).toHaveLength(events);
    expect(match.endedAt).not.toBeNull();
  });

  it("reads both style meters from the fight so far", () => {
    const match = new Match();
    finish(match);
    const [player, opponent] = match.style();
    expect(player.peak).toBeGreaterThanOrEqual(player.rank);
    expect(opponent.peak).toBeGreaterThanOrEqual(opponent.rank);
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
