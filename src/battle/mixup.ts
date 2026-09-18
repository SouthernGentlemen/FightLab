import { actionLoadout, isActionLoadout } from "./bars.ts";
import type { ActionLoadout } from "./bars.ts";

/**
 * How an opponent decides whether to switch bars between rounds.
 *
 * Every kind is a pure function of the rounds already fought. Whatever randomness an opponent has
 * was spent when the run generated its plan — `scripted` carries its switch rounds as data — so
 * replaying a fight replays every decision, and nothing here can see what the player chose in the
 * same pause.
 */
export type MixupPlan =
  | { readonly kind: "steady" }
  | { readonly kind: "alternate" }
  | { readonly kind: "reactive" }
  | { readonly kind: "scripted"; readonly rounds: readonly number[] };

/** An opponent fights on exactly the player's two-bar contract, plus the plan that switches it. */
export interface OpponentPlan extends ActionLoadout {
  readonly mixup: MixupPlan;
}

/** What a decision may read about a finished round: its number and the exchanges each side won. */
export interface FinishedRound {
  readonly round: number;
  readonly wins: readonly [number, number];
}

export function isMixupPlan(value: unknown): value is MixupPlan {
  if (typeof value !== "object" || value === null) return false;
  const plan = value as { kind?: unknown; rounds?: unknown };
  if (plan.kind === "steady" || plan.kind === "alternate" || plan.kind === "reactive") return true;
  return plan.kind === "scripted" && Array.isArray(plan.rounds)
    && plan.rounds.every((round) => Number.isInteger(round) && round >= 2);
}

export function opponentPlan(loadout: ActionLoadout, mixup: MixupPlan): OpponentPlan {
  if (!isActionLoadout({ primary: loadout.primary, secondary: loadout.secondary })) throw new TypeError("the opponent loadout is not two bars of three");
  if (!isMixupPlan(mixup)) throw new TypeError("the opponent has no valid mixup plan");
  const frozen = mixup.kind === "scripted" ? Object.freeze({ kind: "scripted" as const, rounds: Object.freeze([...mixup.rounds]) }) : Object.freeze({ ...mixup });
  return Object.freeze({ ...actionLoadout(loadout.primary, loadout.secondary), mixup: frozen });
}

/**
 * Whether the opponent switches bars for the round after the last of `finished`.
 * `reactive` reads the round from the opponent's side: it switches after losing more exchanges than
 * it won.
 */
export function decideMixup(plan: MixupPlan, finished: readonly FinishedRound[]): boolean {
  const last = finished.at(-1);
  if (last === undefined) return false;
  switch (plan.kind) {
    case "steady": return false;
    case "alternate": return true;
    case "reactive": return last.wins[1] < last.wins[0];
    case "scripted": return plan.rounds.includes(last.round + 1);
  }
}

/**
 * The opponent the combat and determinism tests measure against. It alternates, so both of its bars
 * are fought, and its first bar is the first slice's opening three.
 */
export const REFERENCE_OPPONENT: OpponentPlan = opponentPlan(
  { primary: ["tech", "block", "strike"], secondary: ["tech", "strike", "strike"] },
  { kind: "alternate" },
);
