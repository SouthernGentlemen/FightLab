import { DEFAULT_ACTIONS } from "../battle/actions.ts";
import type { ActionTable, ActionType } from "../battle/actions.ts";
import type { CombatSide } from "../combat/adapter.ts";
import type { FighterDefinition } from "../combat/kernel/index.ts";
import { FIGHTLAB_FIGHTER } from "../combat/moves.ts";
import { compileBuild } from "../mods/compile.ts";
import type { Build } from "../mods/compile.ts";

/**
 * The static bridge from mods to combat: the authored frame data, untouched, and the damage each
 * action's lane adds. Everything a mod does exchange by exchange runs in the engine around the
 * arena (`ModdedArena`) and reaches the kernel as damage, healing and exposure — never as timing.
 */
export function combatSide(build: Build, base: FighterDefinition = FIGHTLAB_FIGHTER, actions: ActionTable = DEFAULT_ACTIONS): CombatSide {
  return { fighter: base, actions, bonus: { ...build.lanes } };
}

/** A fighter with nothing on its grid. */
export const BARE_SIDE: CombatSide = combatSide(compileBuild([]));

/**
 * What one hit of `action` does for this side before its mods fire: the move's own hitbox, or for
 * an action that parries, the counter it answers with, plus the lane.
 */
export function hitDamage(side: CombatSide, action: ActionType): number {
  const move = side.fighter.moves[side.actions[action].move];
  const hitter = move.parry === null ? move : side.fighter.moves[move.parry.counter];
  return hitter.hitboxes[0].damage + side.bonus[action];
}
