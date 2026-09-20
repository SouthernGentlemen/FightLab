import { ACTION_TYPES } from "../battle/actions.ts";
import type { ActionType } from "../battle/actions.ts";
import { adjacencyGraph } from "./adjacency.ts";
import { REGISTRY } from "./registry.ts";
import type { ModDefinition, ModId } from "./registry.ts";
import { SHAPES } from "./shapes.ts";
import type { Rotation } from "./shapes.ts";
import { scaled } from "./stars.ts";
import type { Stars } from "./stars.ts";

/** A fighter's placed mods as the engine runs them. */

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
  readonly cells: number;
  readonly adjacent: readonly number[];
  readonly adjacentSame: number;
  readonly adjacentOther: number;
  /** Boost added to this mod's new-vocabulary amounts for each exchange action. */
  readonly boost: Readonly<Record<ActionType, number>>;
}

export interface ModProgram {
  /** In reading order of each piece's top-left cell, so the engine's order is the board's. */
  readonly mods: readonly ActiveMod[];
}

export const EMPTY_PROGRAM: ModProgram = Object.freeze({ mods: Object.freeze([]) });

type DefinitionOverrides = Readonly<Partial<Record<ModId, ModDefinition>>>;

function zeroBoost(): Record<ActionType, number> {
  return { strike: 0, tech: 0, block: 0 };
}

/**
 * The optional definition map is a test seam for fixture-built definitions. Production callers use
 * the registry; geometry still comes from the placed mod ids, so fixture shapes must match them.
 */
export function programOf(
  pieces: readonly ProgramPiece[],
  definitions: DefinitionOverrides = {},
): ModProgram {
  const ordered = [...pieces].sort((a, b) => a.y - b.y || a.x - b.x || a.uid - b.uid);
  const graph = adjacencyGraph(ordered);
  const definitionOf = (piece: ProgramPiece): ModDefinition => definitions[piece.mod] ?? REGISTRY[piece.mod];
  const byUid = new Map(ordered.map((piece) => [piece.uid, { piece, definition: definitionOf(piece) }] as const));

  const base = ordered.map((piece) => {
    const definition = definitionOf(piece);
    const adjacent = graph.neighbours(piece.uid);
    const adjacentDefinitions = adjacent
      .map((uid) => byUid.get(uid)?.definition)
      .filter((value): value is ModDefinition => value !== undefined);
    return {
      uid: piece.uid,
      definition,
      stars: piece.stars,
      cells: SHAPES[definition.shape].cells.length,
      adjacent,
      adjacentSame: adjacentDefinitions.filter((other) => other.type === definition.type).length,
      adjacentOther: adjacentDefinitions.filter((other) => other.type !== definition.type).length,
      boost: zeroBoost(),
    };
  });

  const activeByUid = new Map(base.map((mod) => [mod.uid, mod] as const));
  for (const target of base) {
    for (const uid of target.adjacent) {
      const booster = activeByUid.get(uid);
      const effect = booster?.definition.effect;
      if (!booster || effect?.kind !== "boost") continue;
      if (effect.to === "adjacent-same" && booster.definition.type !== target.definition.type) continue;
      for (const action of ACTION_TYPES) {
        if (booster.definition.affinity !== null && booster.definition.affinity !== action) continue;
        target.boost[action] += scaled(effect.amount, booster.stars);
      }
    }
  }

  const mods = base.map((mod): ActiveMod => Object.freeze({
    ...mod,
    adjacent: Object.freeze([...mod.adjacent]),
    boost: Object.freeze({ ...mod.boost }),
  }));
  return Object.freeze({ mods: Object.freeze(mods) });
}
