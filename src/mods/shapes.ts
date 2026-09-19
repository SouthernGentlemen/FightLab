/**
 * Canonical polyomino footprints, authored flat with x increasing right and y increasing down.
 * Cell order is stable through rotation because existing port indices and drag anchors depend on it.
 */

export interface GridPoint {
  readonly x: number;
  readonly y: number;
}

export type ShapeId =
  | "tetromino-i"
  | "tetromino-o"
  | "tetromino-t"
  | "tetromino-s"
  | "tetromino-z"
  | "tetromino-j"
  | "tetromino-l"
  | "triomino-i"
  | "triomino-l"
  | "domino"
  | "single";

export interface ModShape {
  readonly id: ShapeId;
  readonly cells: readonly GridPoint[];
}

const point = (x: number, y: number): GridPoint => Object.freeze({ x, y });
const shape = (id: ShapeId, cells: readonly GridPoint[]): ModShape =>
  Object.freeze({ id, cells: Object.freeze(cells) });

export const SHAPES: Readonly<Record<ShapeId, ModShape>> = Object.freeze({
  "tetromino-i": shape("tetromino-i", [point(0, 0), point(1, 0), point(2, 0), point(3, 0)]),
  "tetromino-o": shape("tetromino-o", [point(0, 0), point(1, 0), point(0, 1), point(1, 1)]),
  "tetromino-t": shape("tetromino-t", [point(0, 0), point(1, 0), point(2, 0), point(1, 1)]),
  "tetromino-s": shape("tetromino-s", [point(1, 0), point(2, 0), point(0, 1), point(1, 1)]),
  "tetromino-z": shape("tetromino-z", [point(0, 0), point(1, 0), point(1, 1), point(2, 1)]),
  "tetromino-j": shape("tetromino-j", [point(0, 0), point(0, 1), point(1, 1), point(2, 1)]),
  "tetromino-l": shape("tetromino-l", [point(2, 0), point(0, 1), point(1, 1), point(2, 1)]),
  "triomino-i": shape("triomino-i", [point(0, 0), point(1, 0), point(2, 0)]),
  "triomino-l": shape("triomino-l", [point(0, 0), point(0, 1), point(1, 1)]),
  domino: shape("domino", [point(0, 0), point(1, 0)]),
  single: shape("single", [point(0, 0)]),
});

export const SHAPE_IDS = Object.freeze(Object.keys(SHAPES) as ShapeId[]);

export const SHAPE_LABEL: Readonly<Record<ShapeId, string>> = Object.freeze({
  "tetromino-i": "I tetromino",
  "tetromino-o": "O tetromino",
  "tetromino-t": "T tetromino",
  "tetromino-s": "S tetromino",
  "tetromino-z": "Z tetromino",
  "tetromino-j": "J tetromino",
  "tetromino-l": "L tetromino",
  "triomino-i": "straight triomino",
  "triomino-l": "L triomino",
  domino: "domino",
  single: "single",
});

export function sizeOf(shape: ModShape): number {
  return shape.cells.length;
}

/** Quarter turns clockwise. There is no flipping: an L and a J are different pieces. */
export type Rotation = 0 | 1 | 2 | 3;
export const ROTATIONS: readonly Rotation[] = [0, 1, 2, 3];

export function isRotation(value: unknown): value is Rotation {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

export function nextRotation(rotation: Rotation): Rotation {
  return ((rotation + 1) % 4) as Rotation;
}

function turned(shapeId: ShapeId, rotation: Rotation): readonly GridPoint[] {
  let cells: GridPoint[] = SHAPES[shapeId].cells.map(({ x, y }) => ({ x, y }));
  // On a grid whose y points down, a clockwise quarter turn takes (x, y) to (-y, x).
  for (let turn = 0; turn < rotation; turn++) cells = cells.map(({ x, y }) => ({ x: -y, y: x }));
  const minX = Math.min(...cells.map(({ x }) => x));
  const minY = Math.min(...cells.map(({ y }) => y));
  return Object.freeze(cells.map(({ x, y }) => Object.freeze({ x: x - minX, y: y - minY })));
}

/** Every shape in every rotation, worked out once: placement checks ask for these constantly. */
const TURNED = Object.fromEntries(
  SHAPE_IDS.map((shapeId) => [shapeId, ROTATIONS.map((rotation) => turned(shapeId, rotation))]),
) as unknown as Record<ShapeId, readonly (readonly GridPoint[])[]>;

/** The shape turned clockwise `rotation` times, shifted so its bounding box starts at (0, 0). */
export function shapeCells(shapeId: ShapeId, rotation: Rotation): readonly GridPoint[] {
  return TURNED[shapeId][rotation];
}

/** Bounding width and height of an oriented footprint. */
export function shapeSize(cells: readonly GridPoint[]): readonly [number, number] {
  return [Math.max(...cells.map(({ x }) => x)) + 1, Math.max(...cells.map(({ y }) => y)) + 1];
}
