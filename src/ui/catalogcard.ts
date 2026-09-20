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

export interface IconPlacementPoint {
  readonly x: number;
  readonly y: number;
}

export interface IconPlacements {
  readonly centre: IconPlacementPoint;
  readonly anchor: IconPlacementPoint;
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
  /** Temporary tasks-024 comparison; one placement survives after the visual review. */
  readonly iconPlacements: IconPlacements;
  /** The live card keeps the existing first-cell rule until the tasks-024 comparison is settled. */
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

/**
 * The two tasks-024 candidates in cell-space coordinates.
 *
 * Centre is the geometric centre of the footprint's bounding box. Anchor is the centre of the
 * occupied cell nearest the footprint centroid; equal distances read top-to-bottom, then left-to-right.
 */
export function iconPlacements(cells: readonly GridPoint[]): IconPlacements {
  if (cells.length === 0) throw new Error("Cannot place an icon on an empty footprint");
  const [width, height] = shapeSize(cells);
  const centroid = {
    x: cells.reduce((sum, { x }) => sum + x + 0.5, 0) / cells.length,
    y: cells.reduce((sum, { y }) => sum + y + 0.5, 0) / cells.length,
  };
  const anchor = [...cells].sort((first, second) => {
    const firstDistance = (first.x + 0.5 - centroid.x) ** 2 + (first.y + 0.5 - centroid.y) ** 2;
    const secondDistance = (second.x + 0.5 - centroid.x) ** 2 + (second.y + 0.5 - centroid.y) ** 2;
    return firstDistance - secondDistance || first.y - second.y || first.x - second.x;
  })[0];

  return Object.freeze({
    centre: Object.freeze({ x: width / 2, y: height / 2 }),
    anchor: Object.freeze({ x: anchor.x + 0.5, y: anchor.y + 0.5 }),
  });
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
    iconPlacements: iconPlacements(cells),
    iconCell: cells[0],
    name: definition.name,
    rarity: definition.rarity,
    label: modLabel(definition),
    pips: Object.freeze(pips),
  });
}
