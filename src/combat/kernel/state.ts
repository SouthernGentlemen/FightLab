import type { FighterDefinition, FighterMode, FighterState, MoveDefinition, MovePhase } from "./types.ts";

/** The frame data of the move a fighter is running, if it is running one. */
export function currentMove(fighter: FighterState, definition: FighterDefinition): MoveDefinition | null {
  return fighter.mode === "move" && fighter.move !== null ? definition.moves[fighter.move] : null;
}

export function isActionable(fighter: FighterState): boolean {
  return fighter.mode === "idle" || fighter.mode === "walk";
}

export function enterMode(fighter: FighterState, mode: FighterMode): FighterMode | null {
  if (fighter.mode === mode) return null;
  const previous = fighter.mode;
  fighter.mode = mode;
  fighter.stateFrame = 0;
  return previous;
}

export function movePhase(fighter: FighterState, move: MoveDefinition | null): MovePhase | null {
  if (move === null) return null;
  if (fighter.moveFrame < move.startup) return "startup";
  if (fighter.moveFrame < move.startup + move.active) return "active";
  return "recovery";
}

export function startMove(fighter: FighterState, move: string, bonus = 0, heal = 0): void {
  fighter.move = move;
  fighter.moveFrame = 0;
  fighter.bonus = bonus;
  fighter.heal = heal;
  fighter.hitTargets = [];
  fighter.vx = 0;
  enterMode(fighter, "move");
}

/** Returns true exactly when the move completes on this tick. */
export function advanceMove(fighter: FighterState, move: MoveDefinition): boolean {
  fighter.moveFrame++;
  if (fighter.moveFrame < move.duration) return false;
  leaveMove(fighter, "idle");
  return true;
}

/** Ends the running move, finished or interrupted. */
export function leaveMove(fighter: FighterState, mode: FighterMode): void {
  fighter.move = null;
  fighter.moveFrame = 0;
  fighter.bonus = 0;
  fighter.heal = 0;
  fighter.hitTargets = [];
  enterMode(fighter, mode);
}

/** Whether the fighter's running move is inside its parry window on this frame. */
export function isParrying(fighter: FighterState, definition: FighterDefinition): boolean {
  const parry = currentMove(fighter, definition)?.parry;
  return parry !== null && parry !== undefined && fighter.moveFrame >= parry.startFrame && fighter.moveFrame <= parry.endFrame;
}
