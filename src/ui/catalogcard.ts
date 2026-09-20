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

export interface CatalogShapeModel {
  readonly type: ModType;
  readonly affinity: ActionType | null;
  readonly cells: readonly GridPoint[];
  readonly width: number;
  readonly height: number;
  readonly iconCell: GridPoint;
}

export interface CatalogCardModel extends CatalogShapeModel {
  readonly id: string;
  /** Logical card-grid units. Every catalogue card uses the same physical CSS cell size. */
  readonly cellSize: number;
  readonly name: string;
  readonly rarity: Rarity;
  readonly label: string;
  readonly pips: readonly CatalogPip[];
}

function flatCells(definition: ModDefinition): readonly GridPoint[] {
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
  return chosen.cells;
}

/** Chosen in tasks-024: nearest occupied cell to the centroid; equal distances read top-left first. */
export function iconAnchorCell(cells: readonly GridPoint[]): GridPoint {
  if (cells.length === 0) throw new Error("Cannot place an icon on an empty footprint");
  const centroid = {
    x: cells.reduce((sum, { x }) => sum + x, 0) / cells.length,
    y: cells.reduce((sum, { y }) => sum + y, 0) / cells.length,
  };
  return [...cells].sort((first, second) => {
    const firstDistance = (first.x - centroid.x) ** 2 + (first.y - centroid.y) ** 2;
    const secondDistance = (second.x - centroid.x) ** 2 + (second.y - centroid.y) ** 2;
    return firstDistance - secondDistance || first.y - second.y || first.x - second.x;
  })[0];
}

/** Shared shape model so cards and the selected detail use exactly the same piece renderer. */
export function catalogShape(definition: ModDefinition, cells: readonly GridPoint[]): CatalogShapeModel {
  const [width, height] = shapeSize(cells);
  return Object.freeze({
    type: definition.type,
    affinity: definition.affinity,
    cells,
    width,
    height,
    iconCell: iconAnchorCell(cells),
  });
}

/** Pure presentation model for one catalogue card; it never creates or reads DOM state. */
export function catalogCard(definition: ModDefinition, owned: number): CatalogCardModel {
  const shape = catalogShape(definition, flatCells(definition));
  const pips = STARS.map((stars) => Object.freeze({ stars, filled: owned >= copiesIn(stars) }));
  return Object.freeze({
    ...shape,
    id: definition.id,
    cellSize: CATALOG_CARD_BOX.cellSize,
    name: definition.name,
    rarity: definition.rarity,
    label: modLabel(definition),
    pips: Object.freeze(pips),
  });
}
