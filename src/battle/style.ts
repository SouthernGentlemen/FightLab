import type { Winner } from "./director.ts";

/**
 * Style measures one thing: whether a fighter read its opponent. It is computed from which side
 * won each exchange — what resolved physically — and never from how much damage anything did, so no
 * mod can buy it. It pays at payday and touches no combat number.
 */

export const STYLE_RANKS = ["C", "B", "A", "S"] as const;
export type StyleRank = 0 | 1 | 2 | 3;
export const TOP_RANK: StyleRank = 3;

/** One exchange from one fighter's side. */
export type ExchangeOutcome = "win" | "loss" | "trade" | "even";

export interface StyleMeter {
  readonly rank: StyleRank;
  /** Wins since this fighter was last hurt. Guard exchanges neither extend nor break it. */
  readonly chain: number;
  readonly peak: StyleRank;
  readonly combos: number;
}

export const FRESH_STYLE: StyleMeter = Object.freeze({ rank: 0, chain: 0, peak: 0, combos: 0 });

/** What a settled exchange can tell style: who won it and whether anyone was hurt at all. */
export interface StyleEvidence {
  readonly winner: Winner;
  readonly damage: readonly [number, number];
}

export function outcomeFor(exchange: StyleEvidence, side: "player" | "opponent"): ExchangeOutcome {
  if (exchange.winner === side) return "win";
  if (exchange.winner !== null) return "loss";
  return exchange.damage[0] > 0 && exchange.damage[1] > 0 ? "trade" : "even";
}

/**
 * - win: the chain grows; from its second win on, each win is a combo and raises the rank a step.
 * - loss or trade: being hurt resets the chain and drops the rank a step.
 * - even: nothing changes.
 * C is the floor and S the cap. Rounds do not exist here: a chain carries across them.
 */
export function applyOutcome(meter: StyleMeter, outcome: ExchangeOutcome): StyleMeter {
  if (outcome === "even") return meter;
  if (outcome === "win") {
    const chain = meter.chain + 1;
    if (chain < 2) return { ...meter, chain };
    const rank = Math.min(TOP_RANK, meter.rank + 1) as StyleRank;
    return { rank, chain, peak: Math.max(meter.peak, rank) as StyleRank, combos: meter.combos + 1 };
  }
  return { ...meter, chain: 0, rank: Math.max(0, meter.rank - 1) as StyleRank };
}

export function styleOf(history: readonly StyleEvidence[], side: "player" | "opponent"): StyleMeter {
  return history.reduce((meter, exchange) => applyOutcome(meter, outcomeFor(exchange, side)), FRESH_STYLE);
}
