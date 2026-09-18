import { DEFAULT_ACTIONS } from "../battle/actions.ts";
import type { ActionTable } from "../battle/actions.ts";
import type { CombatSide } from "../combat/adapter.ts";
import type { FighterDefinition } from "../combat/kernel/index.ts";
import { FIGHTLAB_FIGHTER } from "../combat/moves.ts";
import { compileBuild } from "../mods/compile.ts";
import type { Build } from "../mods/compile.ts";

/**
 * The one bridge from mods to combat. A compiled build becomes a side: the same frame data with more
 * maximum health, a parry that heals, and the damage each action adds — and nothing else. Every
 * timing field is copied untouched, which is what keeps a mod from ever deciding an exchange.
 */
export function combatSide(build: Build, base: FighterDefinition = FIGHTLAB_FIGHTER, actions: ActionTable = DEFAULT_ACTIONS): CombatSide {
  const guard = base.moves[actions.block.move];
  const moves = guard.parry === null || build.parryHeal === 0
    ? base.moves
    : { ...base.moves, [guard.id]: { ...guard, parry: { ...guard.parry, heal: guard.parry.heal + build.parryHeal } } };
  return {
    fighter: { ...base, maxHealth: base.maxHealth + build.health, moves },
    actions,
    bonus: { ...build.damage },
    surge: build.surge,
  };
}

/** A fighter with nothing on its grid. */
export const BARE_SIDE: CombatSide = combatSide(compileBuild([]));
