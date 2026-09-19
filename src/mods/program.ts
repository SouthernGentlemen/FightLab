import { adjacencyGraph } from "./adjacency.ts";
import { REGISTRY } from "./registry.ts";
import type { ModDefinition, ModId } from "./registry.ts";
import type { Rotation } from "./shapes.ts";
import type { Stars } from "./stars.ts";

/**
 * A fighter's placed mods as the engine runs them: each definition at its star level, with the
 * neighbouring mod ids worked out once per fight.
 */

/** A mod on the grid, as far as the engine is concerned. */
export interface ProgramPiece {
  readonly uid: number;
  readonly mod: ModId;
  readonly stars: Stars;
  readonly rotation: Rotation;
  readonly x: number;
  readonly y: number;
}

export interface ActiveMod {
  readonly uid: number;
  readonly definition: ModDefinition;
  readonly stars: Stars;
  readonly adjacent: readonly number[];
}

export interface ModProgram {
  /** In reading order of each piece's top-left cell, so the engine's order is the board's. */
  readonly mods: readonly ActiveMod[];
}

export const EMPTY_PROGRAM: ModProgram = Object.freeze({ mods: Object.freeze([]) });

export function programOf(pieces: readonly ProgramPiece[]): ModProgram {
  const ordered = [...pieces].sort((a, b) => a.y - b.y || a.x - b.x || a.uid - b.uid);
  const graph = adjacencyGraph(ordered);
  const mods = ordered.map((piece): ActiveMod => Object.freeze({
    uid: piece.uid,
    definition: REGISTRY[piece.mod],
    stars: piece.stars,
    adjacent: graph.neighbours(piece.uid),
  }));
  return Object.freeze({ mods: Object.freeze(mods) });
}
