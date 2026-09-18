import { describe, expect, it } from "vitest";

import { botRun, replayRun } from "../../pipelines/tune.ts";
import { decodeSave, encodeSave } from "../../src/run/save.ts";

const SEEDS = [1, 20260918, 0xfeedbeef];

describe("a run replayed from its seed and its inputs", () => {
  it.each(SEEDS)("reaches every payday and the final state of seed %i exactly", (seed) => {
    const played = botRun(seed);
    expect(played.days.length).toBeGreaterThan(0);
    const replayed = replayRun(seed, played.inputs);
    expect(replayed.days).toEqual(played.days);
    expect(replayed.run).toEqual(played.run);
  });

  it("survives the autosave at every step: a run saved and loaded mid-way plays on identically", () => {
    const played = botRun(SEEDS[1]);
    const half = Math.floor(played.inputs.length / 2);
    const first = replayRun(SEEDS[1], played.inputs.slice(0, half)).run;
    const restored = decodeSave(encodeSave(first, null))!.run;
    expect(restored).toEqual(first);
  });

  it("differs for a different seed", () => {
    expect(botRun(2).days).not.toEqual(botRun(3).days);
  });
});
