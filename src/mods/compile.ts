import { ACTION_TYPES } from "../battle/actions.ts";
import type { ActionType } from "../battle/actions.ts";
import type { Per } from "./effects.ts";
import { programOf } from "./program.ts";
import type { ActiveMod, ModProgram } from "./program.ts";
import type { ModDefinition, ModId } from "./registry.ts";
import { freshState, staticTotal } from "./resolve.ts";
import { scaled } from "./stars.ts";

type DefinitionOverrides = Readonly<Partial<Record<ModId, ModDefinition>>>;

/**
 * A grid as what the rest of the game needs: the program the mod engine runs, an action-bar damage
 * preview from unconditional new-vocabulary damage, and the run's perks.
 */
export interface Build {
  readonly program: ModProgram;
  readonly preview: Readonly<Record<ActionType, number>>;
  /** How much Charge the fighter can hold until the legacy resource model retires in tasks-040. */
  readonly capacity: number;
  readonly income: number;
  readonly freeRerolls: number;
  readonly styleMultiplier: number;
}

function staticScale(per: Per, mod: ActiveMod): number {
  switch (per) {
    case "flat": return 1;
    case "cell": return mod.cells;
    case "adjacent": return mod.adjacent.length;
    case "adjacent-same": return mod.adjacentSame;
    case "adjacent-other": return mod.adjacentOther;
    default: return 0;
  }
}

function staticCondition(mod: ActiveMod, program: ModProgram): boolean {
  const effect = mod.definition.effect;
  if (effect?.kind !== "exchange" || effect.when === undefined) return true;
  if (effect.when.kind === "opponent-has") return false;
  const byUid = new Map(program.mods.map((entry) => [entry.uid, entry] as const));
  return mod.adjacent.some((uid) => byUid.get(uid)?.definition.type === effect.when!.type);
}

function previewFor(program: ModProgram, action: ActionType): number {
  let total = 0;
  for (const mod of program.mods) {
    const effect = mod.definition.effect;
    if (effect?.kind !== "exchange") continue;
    if (mod.definition.affinity !== null && mod.definition.affinity !== action) continue;
    if (!staticCondition(mod, program)) continue;
    for (const payoff of effect.payoffs) {
      if (payoff.kind !== "damage") continue;
      const scale = staticScale(payoff.amount.per, mod);
      if (scale === 0) continue;
      total += (scaled(payoff.amount.value, mod.stars) + mod.boost[action]) * scale;
    }
  }
  return total;
}

export function compileBuild(
  grid: import("./grid.ts").Grid,
  definitions: DefinitionOverrides = {},
): Build {
  const program = programOf(grid, definitions);
  const preview = Object.fromEntries(
    ACTION_TYPES.map((action) => [action, previewFor(program, action)]),
  ) as Record<ActionType, number>;
  return {
    program,
    preview: Object.freeze(preview),
    capacity: freshState(program).capacity,
    income: staticTotal(program, "income"),
    freeRerolls: staticTotal(program, "free-reroll"),
    styleMultiplier: 1 + staticTotal(program, "style"),
  };
}
