import type { ActionType } from "../battle/actions.ts";
import { burnAfterRound, burnDamage, poisonDamage, shockBonus } from "./balance.ts";
import type { Status } from "./effects.ts";
import { vocabularyExchange } from "./effectresolve.ts";
import type { ModProgram } from "./program.ts";

/** Status engine around the deterministic combat kernel. */
export interface ModState {
  readonly burn: number;
  readonly shock: number;
  readonly poison: number;
}

export type Pair<T> = readonly [T, T];

/** What a payoff waits for: its fighter's move to land, its guard to hold, or nothing. */
export type Needs = "landed" | "guard" | null;

export interface PendingPayoff {
  readonly kind: "status" | "cleanse";
  readonly status: Status;
  readonly amount: number;
  readonly needs: Needs;
}

export interface Prepared {
  readonly states: Pair<ModState>;
  /** Extra damage on every hit of each side's move; a parry passes it to its riposte. */
  readonly bonus: Pair<number>;
  /** Extra healing on each side's parry, if it parries. */
  readonly heal: Pair<number>;
  /** Each side's Shock as the kernel's exposure: the first damaging hit it takes adds all of it. */
  readonly exposure: Pair<number>;
  readonly pending: Pair<readonly PendingPayoff[]>;
}

export interface Outcome {
  /** Whether each side's move hurt the other. */
  readonly landed: Pair<boolean>;
  /** Whether each side was hurt. */
  readonly hurt: Pair<boolean>;
  /** The exposure the kernel consumed on each side: all of its Shock, or nothing. */
  readonly exposed: Pair<number>;
}

export interface RoundEnd {
  readonly states: Pair<ModState>;
  /** Health each side loses to its afflictions. */
  readonly afflictions: Pair<number>;
  readonly burn: Pair<number>;
  readonly poison: Pair<number>;
}

export function freshState(): ModState {
  return { burn: 0, shock: 0, poison: 0 };
}

/** Resolve every mod contribution for one exchange against the static status state. */
export function prepareExchange(
  states: Pair<ModState>,
  programs: Pair<ModProgram>,
  actions: Pair<ActionType>,
): Prepared {
  const resolved = programs.map((program, side) =>
    vocabularyExchange(program, states[1 - side], actions[side]));

  return {
    states,
    bonus: [resolved[0].bonus, resolved[1].bonus],
    heal: [resolved[0].heal, resolved[1].heal],
    exposure: [shockBonus(states[0].shock), shockBonus(states[1].shock)],
    pending: [resolved[0].pending, resolved[1].pending],
  };
}

/**
 * Once the kernel settles the exchange, a damaging hit consumes all Shock. Earned status payoffs
 * land on the opponent and earned cleanses remove the owner's stacks.
 */
export function settleExchange(prepared: Prepared, outcome: Outcome): Pair<ModState> {
  const next = prepared.states.map((state, side) => ({
    ...state,
    shock: outcome.exposed[side] > 0 ? 0 : state.shock,
  }));
  const earned = (side: number, needs: Needs) =>
    needs === null || (needs === "landed" ? outcome.landed[side] : !outcome.hurt[side]);

  for (const kind of ["status", "cleanse"] as const) {
    prepared.pending.forEach((list, side) => {
      for (const payoff of list) {
        if (payoff.kind !== kind || !earned(side, payoff.needs)) continue;
        if (kind === "status") next[1 - side][payoff.status] += payoff.amount;
        else next[side][payoff.status] = Math.max(0, next[side][payoff.status] - payoff.amount);
      }
    });
  }
  return [next[0], next[1]];
}

/** Burn deals its stacks and halves; Poison deals half its stacks and persists. */
export function endRound(states: Pair<ModState>): RoundEnd {
  const burn = states.map((state) => burnDamage(state.burn));
  const poison = states.map((state) => poisonDamage(state.poison));
  const next = states.map((state): ModState => ({
    ...state,
    burn: burnAfterRound(state.burn),
  }));
  return {
    states: [next[0], next[1]],
    afflictions: [burn[0] + poison[0], burn[1] + poison[1]],
    burn: [burn[0], burn[1]],
    poison: [poison[0], poison[1]],
  };
}
