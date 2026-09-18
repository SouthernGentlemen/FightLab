import type { MatchOutcome } from "../battle/director.ts";
import type { StyleRank } from "../battle/style.ts";
import { CATALOG } from "../mods/catalog.ts";
import type { ModId } from "../mods/catalog.ts";
import type { Build } from "../mods/compile.ts";

export const STARTING_MONEY = 10;
export const BASE_INCOME = 5;
export const RESULT_INCOME: Readonly<Record<MatchOutcome, number>> = { victory: 2, draw: 1, defeat: 0 };
/** One dollar of interest per this much held when the fight began… */
export const INTEREST_STEP = 5;
/** …up to this much: saving should be a choice, not the dominant strategy. */
export const INTEREST_CAP = 2;
/** What each peak style rank, C to S, pays. */
export const STYLE_INCOME: readonly [number, number, number, number] = [0, 1, 2, 3];

export function sellValue(mod: ModId): number {
  return Math.max(1, Math.floor(CATALOG[mod].price / 2));
}

export type PaydayLabel = "base" | "result" | "interest" | "style" | "perks";

export interface PaydayLine {
  readonly label: PaydayLabel;
  readonly amount: number;
}

export interface PaydayInput {
  readonly result: MatchOutcome;
  /** Money held when the fight began. */
  readonly stake: number;
  readonly peakStyle: StyleRank;
  /** The build the fight was fought with; its run perks pay here. */
  readonly build: Build;
}

export function interest(stake: number): number {
  return Math.min(INTEREST_CAP, Math.floor(Math.max(0, stake) / INTEREST_STEP));
}

export function payday({ result, stake, peakStyle, build }: PaydayInput): PaydayLine[] {
  return [
    { label: "base", amount: BASE_INCOME },
    { label: "result", amount: RESULT_INCOME[result] },
    { label: "interest", amount: interest(stake) },
    { label: "style", amount: STYLE_INCOME[peakStyle] * build.styleMultiplier },
    { label: "perks", amount: build.income },
  ];
}

export function total(lines: readonly PaydayLine[]): number {
  return lines.reduce((sum, line) => sum + line.amount, 0);
}
