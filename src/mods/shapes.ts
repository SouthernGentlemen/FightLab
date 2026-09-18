/**
 * Polyominoes that fit a 3×3 board. Cells are `[x, y]` with y pointing down the grid. A shape keeps
 * its cell order through every rotation, so the cell a player grabbed stays the one under the
 * pointer as the piece turns.
 */

export type Cell = readonly [number, number];

export const SHAPES = {
  mono: [[0, 0]],
  duo: [[0, 0], [1, 0]],
  i3: [[0, 0], [1, 0], [2, 0]],
  l3: [[0, 0], [0, 1], [1, 1]],
  o4: [[0, 0], [1, 0], [0, 1], [1, 1]],
  t4: [[0, 0], [1, 0], [2, 0], [1, 1]],
  l4: [[0, 0], [0, 1], [1, 1], [2, 1]],
} as const satisfies Record<string, readonly Cell[]>;

export type ShapeId = keyof typeof SHAPES;
export const SHAPE_IDS = Object.keys(SHAPES) as ShapeId[];

/** Quarter turns clockwise. There is no flipping: an L and a J are different pieces. */
export type Rotation = 0 | 1 | 2 | 3;
export const ROTATIONS: readonly Rotation[] = [0, 1, 2, 3];

export function isRotation(value: unknown): value is Rotation {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

export function nextRotation(rotation: Rotation): Rotation {
  return ((rotation + 1) % 4) as Rotation;
}

function turned(shape: ShapeId, rotation: Rotation): readonly Cell[] {
  let cells: Cell[] = SHAPES[shape].map(([x, y]) => [x, y]);
  // On a grid whose y points down, a clockwise quarter turn takes (x, y) to (-y, x).
  for (let turn = 0; turn < rotation; turn++) cells = cells.map(([x, y]) => [-y, x]);
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  return Object.freeze(cells.map(([x, y]) => Object.freeze([x - minX, y - minY] as const)));
}

/** Every shape in every rotation, worked out once: placement checks ask for these constantly. */
const TURNED = Object.fromEntries(SHAPE_IDS.map((shape) => [shape, ROTATIONS.map((rotation) => turned(shape, rotation))])) as unknown as Record<ShapeId, readonly (readonly Cell[])[]>;

/** The shape turned clockwise `rotation` times, shifted so its bounding box starts at `[0, 0]`. */
export function shapeCells(shape: ShapeId, rotation: Rotation): readonly Cell[] {
  return TURNED[shape][rotation];
}

export function shapeSize(cells: readonly Cell[]): readonly [number, number] {
  return [Math.max(...cells.map(([x]) => x)) + 1, Math.max(...cells.map(([, y]) => y)) + 1];
}
