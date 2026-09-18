import { DEFAULT_ACTIONS } from "../battle/actions.ts";
import type { ActionTable, ActionType } from "../battle/actions.ts";
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

/**
 * What one hit of `action` does for this side, bonus included: the move's own hitbox, or for an
 * action that parries, the counter it answers with. `surged` adds the round-after-a-Mixup bonus.
 */
export function hitDamage(side: CombatSide, action: ActionType, surged = false): number {
  const move = side.fighter.moves[side.actions[action].move];
  const hitter = move.parry === null ? move : side.fighter.moves[move.parry.counter];
  return hitter.hitboxes[0].damage + side.bonus[action] + (surged ? side.surge : 0);
}
