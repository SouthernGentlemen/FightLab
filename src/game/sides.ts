import { DEFAULT_ACTIONS } from "../battle/actions.ts";
import type { ActionTable, ActionType } from "../battle/actions.ts";
import type { CombatSide } from "../combat/adapter.ts";
import type { FighterDefinition } from "../combat/kernel/index.ts";
import { FIGHTLAB_FIGHTER } from "../combat/moves.ts";
import { compileBuild } from "../mods/compile.ts";
import type { Build } from "../mods/compile.ts";

/**
 * The static bridge from a build to combat now carries only authored fighter/action data. Mod damage,
 * healing and exposure reach the kernel per exchange through ModdedArena.
 */
export function combatSide(
  _build: Build,
  base: FighterDefinition = FIGHTLAB_FIGHTER,
  actions: ActionTable = DEFAULT_ACTIONS,
): CombatSide {
  return { fighter: base, actions };
}

/** A fighter with nothing on its grid. */
export const BARE_SIDE: CombatSide = combatSide(compileBuild([]));

/** One hit's authored damage plus the build preview shown on an action bar. */
export function hitDamage(side: CombatSide, action: ActionType, preview = 0): number {
  const move = side.fighter.moves[side.actions[action].move];
  const hitter = move.parry === null ? move : side.fighter.moves[move.parry.counter];
  return hitter.hitboxes[0].damage + preview;
}
