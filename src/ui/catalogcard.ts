import type { ActionType } from "../battle/actions.ts";
import type { Rarity } from "../mods/rarity.ts";
import type { ModDefinition } from "../mods/registry.ts";
import { SHAPES, orientations, shapeSize } from "../mods/shapes.ts";
import type { GridPoint } from "../mods/shapes.ts";
import { STARS, copiesIn } from "../mods/stars.ts";
import type { Stars } from "../mods/stars.ts";
import type { ModType } from "../mods/tags.ts";
import { modLabel } from "./modlabel.ts";

export const CATALOG_CARD_BOX = Object.freeze({ width: 4, height: 2, cellSize: 1 });

export interface CatalogPip {
  readonly stars: Stars;
  readonly filled: boolean;
}

export interface CatalogCardModel {
  readonly id: string;
  readonly type: ModType;
  readonly affinity: ActionType | null;
  readonly cells: readonly GridPoint[];
  readonly width: number;
  readonly height: number;
  /** Logical card-grid units. Every catalogue card uses the same physical CSS cell size. */
  readonly cellSize: number;
  /** The affinity icon sits here until tasks-024 chooses its final cell. */
  readonly iconCell: GridPoint;
  readonly name: string;
  readonly rarity: Rarity;
  readonly label: string;
  readonly pips: readonly CatalogPip[];
}

function flatCells(definition: ModDefinition): {
  readonly cells: readonly GridPoint[];
  readonly width: number;
  readonly height: number;
} {
  const candidates = orientations(SHAPES[definition.shape])
    .map(({ rotation, cells }) => {
      const [width, height] = shapeSize(cells);
      return { rotation, cells, width, height };
    })
    .filter(({ width, height }) =>
      width >= height && width <= CATALOG_CARD_BOX.width && height <= CATALOG_CARD_BOX.height)
    .sort((a, b) => b.width - a.width || a.height - b.height || a.rotation - b.rotation);

  const chosen = candidates[0];
  if (chosen === undefined) throw new Error(`${definition.id}: shape does not fit the 4 x 2 catalogue box`);
  return chosen;
}

/** Pure presentation model for one catalogue card; it never creates or reads DOM state. */
export function catalogCard(definition: ModDefinition, owned: number): CatalogCardModel {
  const { cells, width, height } = flatCells(definition);
  const pips = STARS.map((stars) => Object.freeze({ stars, filled: owned >= copiesIn(stars) }));
  return Object.freeze({
    id: definition.id,
    type: definition.type,
    affinity: definition.affinity,
    cells,
    width,
    height,
    cellSize: CATALOG_CARD_BOX.cellSize,
    iconCell: cells[0],
    name: definition.name,
    rarity: definition.rarity,
    label: modLabel(definition),
    pips: Object.freeze(pips),
  });
}
