import { links } from "./ports.ts";
import type { Resource } from "./ports.ts";
import { REGISTRY } from "./registry.ts";
import type { ModDefinition, ModId } from "./registry.ts";
import type { Rotation } from "./shapes.ts";
import type { Stars } from "./stars.ts";

/**
 * A fighter's placed mods as the engine runs them: each definition at its star level, with the
 * links its ports make where it stands. Worked out once per fight; nothing in it changes during one.
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
  /** Resources this mod's out-ports feed into a linked neighbour. */
  readonly feeds: readonly Resource[];
  /** Mods it shares a link with, in either direction. */
  readonly linked: readonly number[];
  /** How many links it is part of. */
  readonly links: number;
}

export interface ModProgram {
  /** In reading order of each piece's top-left cell, so the engine's order is the board's. */
  readonly mods: readonly ActiveMod[];
}

export const EMPTY_PROGRAM: ModProgram = Object.freeze({ mods: Object.freeze([]) });

export function programOf(pieces: readonly ProgramPiece[]): ModProgram {
  const ordered = [...pieces].sort((a, b) => a.y - b.y || a.x - b.x || a.uid - b.uid);
  const found = links(ordered.map((piece) => ({ ...piece, shape: REGISTRY[piece.mod].shape, ports: REGISTRY[piece.mod].ports })));
  const mods = ordered.map((piece): ActiveMod => {
    const touching = found.filter((link) => link.from === piece.uid || link.to === piece.uid);
    return Object.freeze({
      uid: piece.uid,
      definition: REGISTRY[piece.mod],
      stars: piece.stars,
      feeds: Object.freeze([...new Set(found.filter((link) => link.from === piece.uid).map((link) => link.resource))]),
      linked: Object.freeze([...new Set(touching.map((link) => (link.from === piece.uid ? link.to : link.from)))]),
      links: touching.length,
    });
  });
  return Object.freeze({ mods: Object.freeze(mods) });
}
