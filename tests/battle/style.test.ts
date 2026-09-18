import { describe, expect, it } from "vitest";

import type { Winner } from "../../src/battle/director.ts";
import { FRESH_STYLE, STYLE_RANKS, TOP_RANK, applyOutcome, outcomeFor, styleOf } from "../../src/battle/style.ts";
import type { ExchangeOutcome, StyleEvidence, StyleMeter } from "../../src/battle/style.ts";

const OUTCOMES: readonly ExchangeOutcome[] = ["win", "loss", "trade", "even"];

/**
 * The rule as RUN_DESIGN.md §4 states it, written a second time and differently: a whole-sequence
 * scan over "wins since last hurt", rather than a fold over a meter.
 */
function oracle(sequence: readonly ExchangeOutcome[]): { rank: number; chain: number; peak: number; combos: number } {
  let rank = 0;
  let peak = 0;
  let combos = 0;
  let sinceHurt = 0;
  for (const outcome of sequence) {
    const hurt = outcome === "loss" || outcome === "trade";
    if (hurt) {
      sinceHurt = 0;
      if (rank > 0) rank -= 1;
    } else if (outcome === "win") {
      sinceHurt += 1;
      const isCombo = sinceHurt > 1;
      if (isCombo) {
        combos += 1;
        if (rank < 3) rank += 1;
        if (rank > peak) peak = rank;
      }
    }
  }
  return { rank, chain: sinceHurt, peak, combos };
}

function* sequences(length: number): Generator<ExchangeOutcome[]> {
  if (length === 0) {
    yield [];
    return;
  }
  for (const prefix of sequences(length - 1)) for (const outcome of OUTCOMES) yield [...prefix, outcome];
}

function meterOf(sequence: readonly ExchangeOutcome[]): StyleMeter {
  return sequence.reduce(applyOutcome, FRESH_STYLE);
}

/** An exchange record carrying `outcome` for the player, with any damage amounts. */
function evidence(outcome: ExchangeOutcome, amounts: readonly [number, number] = [12, 12]): StyleEvidence {
  const winner: Winner = outcome === "win" ? "player" : outcome === "loss" ? "opponent" : null;
  const damage: [number, number] = outcome === "win" ? [0, amounts[1]] : outcome === "loss" ? [amounts[0], 0]
    : outcome === "trade" ? [amounts[0], amounts[1]] : [0, 0];
  return { winner, damage };
}

describe("style", () => {
  it("reads each exchange from one side: win, loss, trade or even", () => {
    expect(outcomeFor({ winner: "player", damage: [0, 12] }, "player")).toBe("win");
    expect(outcomeFor({ winner: "player", damage: [0, 12] }, "opponent")).toBe("loss");
    expect(outcomeFor({ winner: "opponent", damage: [16, 0] }, "player")).toBe("loss");
    expect(outcomeFor({ winner: null, damage: [12, 12] }, "player")).toBe("trade");
    expect(outcomeFor({ winner: null, damage: [12, 12] }, "opponent")).toBe("trade");
    expect(outcomeFor({ winner: null, damage: [0, 0] }, "player")).toBe("even");
  });

  it("starts at C with no chain", () => {
    expect(FRESH_STYLE).toEqual({ rank: 0, chain: 0, peak: 0, combos: 0 });
    expect(STYLE_RANKS).toEqual(["C", "B", "A", "S"]);
  });

  it("never counts the first win of a chain as a combo, and counts every later one", () => {
    expect(meterOf(["win"])).toEqual({ rank: 0, chain: 1, peak: 0, combos: 0 });
    expect(meterOf(["win", "win"])).toEqual({ rank: 1, chain: 2, peak: 1, combos: 1 });
    expect(meterOf(["win", "win", "win"])).toEqual({ rank: 2, chain: 3, peak: 2, combos: 2 });
    expect(meterOf(["win", "win", "win", "win"])).toEqual({ rank: 3, chain: 4, peak: 3, combos: 3 });
  });

  it("caps at S while still counting combos", () => {
    expect(meterOf(["win", "win", "win", "win", "win", "win"])).toEqual({ rank: TOP_RANK, chain: 6, peak: TOP_RANK, combos: 5 });
  });

  it("drops a rank and breaks the chain on a loss or a trade, never below C", () => {
    expect(meterOf(["win", "win", "win", "loss"])).toEqual({ rank: 1, chain: 0, peak: 2, combos: 2 });
    expect(meterOf(["win", "win", "win", "trade"])).toEqual({ rank: 1, chain: 0, peak: 2, combos: 2 });
    expect(meterOf(["loss", "trade", "loss"])).toEqual(FRESH_STYLE);
    // After the break the next win starts a new chain and is not a combo.
    expect(meterOf(["win", "win", "loss", "win"])).toEqual({ rank: 0, chain: 1, peak: 1, combos: 1 });
  });

  it("lets a guard exchange neither extend nor break a chain", () => {
    expect(meterOf(["win", "even", "win"])).toEqual(meterOf(["win", "win"]));
    expect(meterOf(["even", "even"])).toEqual(FRESH_STYLE);
    expect(applyOutcome({ rank: 2, chain: 3, peak: 3, combos: 4 }, "even")).toEqual({ rank: 2, chain: 3, peak: 3, combos: 4 });
  });

  it("agrees with the rule as written for every sequence of outcomes up to length eight", () => {
    let checked = 0;
    for (let length = 0; length <= 8; length++) {
      for (const sequence of sequences(length)) {
        const meter = meterOf(sequence);
        const expected = oracle(sequence);
        if (meter.rank !== expected.rank || meter.chain !== expected.chain || meter.peak !== expected.peak || meter.combos !== expected.combos) {
          expect(meter, sequence.join(" ")).toEqual(expected);
        }
        checked++;
      }
    }
    expect(checked).toBe((4 ** 9 - 1) / 3);
  });

  it("moves at most one rank per exchange and keeps the peak as the highest rank reached", () => {
    for (const sequence of sequences(7)) {
      let meter = FRESH_STYLE;
      let highest = 0;
      for (const outcome of sequence) {
        const next = applyOutcome(meter, outcome);
        expect(Math.abs(next.rank - meter.rank)).toBeLessThanOrEqual(1);
        expect(next.rank).toBeGreaterThanOrEqual(0);
        expect(next.rank).toBeLessThanOrEqual(TOP_RANK);
        highest = Math.max(highest, next.rank);
        meter = next;
      }
      expect(meter.peak).toBe(highest);
    }
  });

  it("reads both sides of the same fight as mirror images", () => {
    for (const sequence of sequences(6)) {
      const history = sequence.map((outcome) => evidence(outcome));
      const mirrored = sequence.map((outcome) => evidence(outcome === "win" ? "loss" : outcome === "loss" ? "win" : outcome));
      expect(styleOf(history, "opponent")).toEqual(styleOf(mirrored, "player"));
    }
  });

  it("never reads how much damage anything did", () => {
    for (const sequence of sequences(5)) {
      const light = sequence.map((outcome) => evidence(outcome, [1, 1]));
      const heavy = sequence.map((outcome, index) => evidence(outcome, [40 + index, 99 - index]));
      expect(styleOf(heavy, "player")).toEqual(styleOf(light, "player"));
      expect(styleOf(heavy, "opponent")).toEqual(styleOf(light, "opponent"));
    }
  });

  it("carries a chain across a round boundary: rounds do not exist to it", () => {
    // Round 1 ends on a win, round 2 opens on one: that second win is a combo.
    const roundOne = [evidence("loss"), evidence("even"), evidence("win")];
    const roundTwo = [evidence("win"), evidence("win")];
    expect(styleOf([...roundOne, ...roundTwo], "player")).toEqual({ rank: 2, chain: 3, peak: 2, combos: 2 });
  });
});
