import { GROUND_Y, STAGE_MAX_X, STAGE_MIN_X } from "./constants.ts";
import { currentMove, isParrying } from "./state.ts";
import type { Aabb, Box, DebugBoxes, Facing, FighterDefinition, FighterState, HitboxDefinition, SimulationState } from "./types.ts";

/** Touching edges are not an overlap. This keeps flush boxes stable. */
export function overlaps(a: Aabb, b: Aabb): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

export function intersection(a: Aabb, b: Aabb): Aabb | null {
  if (!overlaps(a, b)) return null;
  return {
    x0: Math.max(a.x0, b.x0),
    y0: Math.max(a.y0, b.y0),
    x1: Math.min(a.x1, b.x1),
    y1: Math.min(a.y1, b.y1),
  };
}

/** The one place a forward-authored local box is mirrored into world space. */
export function boxToWorld(box: Box, originX: number, originY: number, facing: Facing): Aabb {
  const x0 = facing === 1 ? originX + box.x : originX - box.x - box.w;
  const y0 = originY + box.y;
  return { x0, y0, x1: x0 + box.w, y1: y0 + box.h };
}

export function pushboxOf(fighter: FighterState, definition: FighterDefinition): Aabb {
  return boxToWorld(definition.pushbox, fighter.x, GROUND_Y, fighter.facing);
}

export function hurtboxesOf(fighter: FighterState, definition: FighterDefinition): Aabb[] {
  if (fighter.mode === "defeated") return [];
  return definition.hurtboxes.map((box) => boxToWorld(box, fighter.x, GROUND_Y, fighter.facing));
}

export function activeHitboxesOf(
  fighter: FighterState,
  definition: FighterDefinition,
): Array<{ aabb: Aabb; definition: HitboxDefinition }> {
  const move = currentMove(fighter, definition);
  if (move === null) return [];
  return move.hitboxes
    .filter((hitbox) => fighter.moveFrame >= hitbox.startFrame && fighter.moveFrame <= hitbox.endFrame)
    .map((hitbox) => ({ aabb: boxToWorld(hitbox.box, fighter.x, GROUND_Y, fighter.facing), definition: hitbox }));
}

function clamp(fighter: FighterState, definition: FighterDefinition): void {
  const box = pushboxOf(fighter, definition);
  if (box.x0 < STAGE_MIN_X) fighter.x += STAGE_MIN_X - box.x0;
  else if (box.x1 > STAGE_MAX_X) fighter.x -= box.x1 - STAGE_MAX_X;
}

export function resolvePushboxes(state: SimulationState, definitions: readonly FighterDefinition[]): void {
  const [first, second] = state.fighters;
  const firstBox = pushboxOf(first, definitions[0]);
  const secondBox = pushboxOf(second, definitions[1]);
  if (overlaps(firstBox, secondBox)) {
    const overlap = Math.min(firstBox.x1, secondBox.x1) - Math.max(firstBox.x0, secondBox.x0);
    const firstIsLeft = first.x <= second.x;
    const left = firstIsLeft ? first : second;
    const right = firstIsLeft ? second : first;
    const half = Math.trunc(overlap / 2);
    left.x -= half;
    right.x += overlap - half;
  }
  clamp(first, definitions[0]);
  clamp(second, definitions[1]);
}

export function debugBoxes(state: SimulationState, definitions: readonly FighterDefinition[]): DebugBoxes {
  return {
    origins: state.fighters.map(({ x }) => ({ x, y: GROUND_Y })),
    pushboxes: state.fighters.map((fighter, index) => pushboxOf(fighter, definitions[index])),
    hurtboxes: state.fighters.map((fighter, index) => hurtboxesOf(fighter, definitions[index])),
    hitboxes: state.fighters.map((fighter, index) => activeHitboxesOf(fighter, definitions[index]).map(({ aabb }) => aabb)),
    parrying: state.fighters.map((fighter, index) => isParrying(fighter, definitions[index])),
  };
}
