import {
  accrue, burn, capacity, cleanse, damage, generate, heal, leech, poison, refund, shock, sink, spend,
} from "../../src/mods/effects.ts";
import { place } from "../../src/mods/grid.ts";
import type { Grid } from "../../src/mods/grid.ts";
import { programOf } from "../../src/mods/program.ts";
import type { ModProgram } from "../../src/mods/program.ts";
import type { ModDefinition, ModId } from "../../src/mods/registry.ts";
import type { Rotation } from "../../src/mods/shapes.ts";
import type { Stars } from "../../src/mods/stars.ts";
import type { ActionType } from "../../src/battle/actions.ts";
import type { ModType } from "../../src/mods/tags.ts";
import { pick } from "./fixtures.ts";
import type { PickedMod } from "./fixtures.ts";

export type LegacyDefinition = ModDefinition & { readonly id: ModId };

function legacy(
  base: PickedMod,
  type: ModType,
  affinity: ActionType | null,
  effects: ModDefinition["effects"],
): LegacyDefinition {
  return { ...base, type, affinity, effects, effect: undefined };
}

export const LEGACY_HEAT = legacy(
  pick({ type: "solar", affinity: null, size: 1 }), "solar", null, [generate("heat", [1, 2, 3])],
);
export const LEGACY_CINDER = legacy(
  pick({ type: "solar", affinity: "strike", rarity: "common", size: 2 }), "solar", "strike",
  [spend("heat", [1, 1, 1], damage([2, 3, 4]), burn([2, 3, 5]))],
);
export const LEGACY_SINK = legacy(
  pick({ type: "solar", affinity: "block", rarity: "rare", size: 2 }), "solar", "block",
  [sink("heat", [2, 3, 5], heal([1, 1, 1]))],
);
export const LEGACY_DYNAMO = legacy(
  pick({ type: "arc", affinity: null, size: 1 }), "arc", null, [generate("charge", [1, 2, 3])],
);
export const LEGACY_BATTERY = legacy(
  pick({ type: "arc", affinity: "strike", rarity: "rare", size: 1 }), "arc", null, [capacity([2, 3, 5])],
);
export const LEGACY_WIRE = legacy(
  pick({ type: "arc", affinity: "strike", rarity: "uncommon", size: 2 }), "arc", "strike",
  [spend("charge", [1, 1, 1], damage([1, 2, 3]), shock([2, 3, 4]))],
);
export const LEGACY_VOID_TAP = legacy(
  pick({ type: "void", affinity: null, size: 1 }), "void", null, [leech("either", [1, 2, 3])],
);
export const LEGACY_VENOM = legacy(
  pick({ type: "void", affinity: "strike", rarity: "common", size: 2 }), "void", "strike",
  [spend("void", [1, 1, 1], poison([1, 2, 3]))],
);
export const LEGACY_COOLING = legacy(
  pick({ type: "solar", affinity: "block", rarity: "uncommon", size: 4 }), "solar", "block",
  [sink("heat", [3, 4, 6], heal([1, 1, 1]), cleanse("burn", [1, 1, 2]))],
);
export const LEGACY_RESERVOIR = legacy(
  pick({ type: "void", affinity: null, rarity: "rare", size: 3 }), "void", null,
  [leech("either", [1, 2, 3]), accrue([1, 2, 3])],
);
export const LEGACY_STORM = legacy(
  pick({ type: "arc", affinity: "strike", rarity: "common", size: 2 }), "arc", "strike",
  [spend("charge", [2, 2, 2], shock([4, 6, 9]))],
);
export const LEGACY_CHAIN = legacy(
  pick({ type: "arc", affinity: "tech", rarity: "common", size: 3 }), "arc", "tech",
  [generate("charge", [1, 1, 2], [1, 2, 3])],
);
export const LEGACY_FEEDBACK = legacy(
  pick({ type: "neutral", affinity: "strike", rarity: "rare", size: 1 }), "arc", null, [refund([1, 2, 3])],
);
export const LEGACY_GUARD = legacy(
  pick({ type: "neutral", affinity: null, rarity: "uncommon", size: 1 }), "arc", "block",
  [spend("charge", [2, 2, 2], heal([3, 5, 8]), damage([2, 3, 5]))],
);
export const LEGACY_FLARE = legacy(
  pick({ type: "solar", affinity: "strike", rarity: "legendary", size: 4 }), "solar", "strike",
  [generate("heat", [2, 3, 4]), spend("heat", [4, 4, 4], damage([6, 9, 14]), burn([6, 9, 14]))],
);

export type LegacyPiece = readonly [LegacyDefinition, number, number, Stars?, Rotation?];

function overrides(pieces: readonly LegacyPiece[]): Readonly<Partial<Record<ModId, ModDefinition>>> {
  return Object.fromEntries(pieces.map(([definition]) => [definition.id, definition]));
}

export function legacyProgram(...pieces: readonly LegacyPiece[]): ModProgram {
  let uid = 0;
  return programOf(
    pieces.map(([definition, x, y, stars = 1, rotation = 0]) =>
      ({ uid: ++uid, mod: definition.id, x, y, stars, rotation })),
    overrides(pieces),
  );
}

export function legacyGrid(...pieces: readonly LegacyPiece[]): {
  readonly grid: Grid;
  readonly definitions: Readonly<Partial<Record<ModId, ModDefinition>>>;
} {
  let grid: Grid = [];
  let uid = 0;
  for (const [definition, x, y, stars = 1, rotation = 0] of pieces) {
    grid = place(grid, { uid: ++uid, mod: definition.id, x, y, stars, rotation }) ?? grid;
  }
  return { grid, definitions: overrides(pieces) };
}
