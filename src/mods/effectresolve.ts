import type { ActionType } from "../battle/actions.ts";
import type { Payoff, Per, Status } from "./effects.ts";
import type { ActiveMod, ModProgram } from "./program.ts";
import type { ModState, Needs, PendingPayoff } from "./resolve.ts";
import { scaled } from "./stars.ts";
import type { ModType } from "./types.ts";

export interface VocabularyContribution {
  readonly bonus: number;
  readonly heal: number;
  readonly pending: readonly PendingPayoff[];
}

const STATUS_BY_TYPE: Readonly<Record<ModType, Status | null>> = {
  solar: "burn",
  arc: "shock",
  void: "poison",
  neutral: null,
};

function fires(mod: ActiveMod, action: ActionType): boolean {
  return mod.definition.affinity === null || mod.definition.affinity === action;
}

function needs(mod: ActiveMod): Needs {
  const affinity = mod.definition.affinity;
  return affinity === null ? null : affinity === "block" ? "guard" : "landed";
}

function scale(per: Per, mod: ActiveMod, opponent: ModState): number {
  switch (per) {
    case "flat": return 1;
    case "cell": return mod.cells;
    case "adjacent": return mod.adjacent.length;
    case "adjacent-same": return mod.adjacentSame;
    case "adjacent-other": return mod.adjacentOther;
    default: return opponent[per];
  }
}

function conditionPasses(mod: ActiveMod, program: ModProgram, opponent: ModState): boolean {
  const effect = mod.definition.effect;
  if (effect.kind !== "exchange" || effect.when === undefined) return true;
  const when = effect.when;
  if (when.kind === "opponent-has") return opponent[when.status] > 0;
  const byUid = new Map(program.mods.map((entry) => [entry.uid, entry] as const));
  return mod.adjacent.some((uid) => byUid.get(uid)?.definition.type === when.type);
}

function amountOf(payoff: Payoff, mod: ActiveMod, opponent: ModState, action: ActionType): number {
  return (scaled(payoff.amount.value, mod.stars) + mod.boost[action]) * scale(payoff.amount.per, mod, opponent);
}

export function vocabularyExchange(
  program: ModProgram,
  opponent: ModState,
  action: ActionType,
): VocabularyContribution {
  let bonus = 0;
  let heal = 0;
  const pending: PendingPayoff[] = [];

  for (const mod of program.mods) {
    const effect = mod.definition.effect;
    if (effect.kind !== "exchange" || !fires(mod, action) || !conditionPasses(mod, program, opponent)) continue;
    for (const payoff of effect.payoffs) {
      const amount = amountOf(payoff, mod, opponent, action);
      if (payoff.kind === "damage") bonus += amount;
      else if (payoff.kind === "heal") heal += amount;
      else if (payoff.kind === "cleanse") {
        pending.push({ kind: "cleanse", status: payoff.status, amount, needs: needs(mod) });
      } else {
        const status = STATUS_BY_TYPE[mod.definition.type];
        if (status !== null) pending.push({ kind: "status", status, amount, needs: needs(mod) });
      }
    }
  }
  return { bonus, heal, pending };
}

export function vocabularyPerkTotal(
  program: ModProgram,
  perk: "income" | "free-reroll" | "style",
): number {
  return program.mods.reduce((sum, mod) => {
    const effect = mod.definition.effect;
    return sum + (effect.kind === "perk" && effect.perk === perk ? scaled(effect.amount, mod.stars) : 0);
  }, 0);
}
