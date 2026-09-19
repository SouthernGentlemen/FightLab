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

/** Rotation is stored in degrees; symmetrical shapes normalise to their first distinct orientation. */
export type Rotation = 0 | 90 | 180 | 270;
export const ROTATIONS: readonly Rotation[] = Object.freeze([0, 90, 180, 270]);

export interface ShapeOrientation {
  readonly rotation: Rotation;
  readonly cells: readonly GridPoint[];
}

/** Shift a footprint to min x = min y = 0 and give it a canonical reading-order cell order. */
export function normalise(cells: readonly GridPoint[]): readonly GridPoint[] {
  if (cells.length === 0) return Object.freeze([]);
  const minX = Math.min(...cells.map(({ x }) => x));
  const minY = Math.min(...cells.map(({ y }) => y));
  return Object.freeze(
    cells
      .map(({ x, y }) => ({ x: x - minX, y: y - minY }))
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map(({ x, y }) => Object.freeze({ x, y })),
  );
}

/** Turn a footprint one quarter clockwise, then canonicalise its position and cell order. */
export function turnClockwise(cells: readonly GridPoint[]): readonly GridPoint[] {
  return normalise(cells.map(({ x, y }) => ({ x: -y, y: x })));
}

function rawCellsAt(shape: ModShape, rotation: Rotation): readonly GridPoint[] {
  let cells = normalise(shape.cells);
  for (let turn = 0; turn < rotation / 90; turn++) cells = turnClockwise(cells);
  return cells;
}

function cellKey(cells: readonly GridPoint[]): string {
  return cells.map(({ x, y }) => `${x},${y}`).join(";");
}

interface OrientationData {
  readonly distinct: readonly ShapeOrientation[];
  readonly rotation: Readonly<Record<Rotation, Rotation>>;
  readonly cells: Readonly<Record<Rotation, readonly GridPoint[]>>;
}

function orientationData(shape: ModShape): OrientationData {
  const all = ROTATIONS.map((rotation) => ({ rotation, cells: rawCellsAt(shape, rotation) }));
  const seen = new Map<string, ShapeOrientation>();
  for (const entry of all) {
    const key = cellKey(entry.cells);
    if (!seen.has(key)) seen.set(key, Object.freeze(entry));
  }
  const distinct = Object.freeze([...seen.values()]);
  const rotation = Object.fromEntries(all.map((entry) => [entry.rotation, seen.get(cellKey(entry.cells))!.rotation])) as Record<Rotation, Rotation>;
  const cells = Object.fromEntries(all.map((entry) => [entry.rotation, seen.get(cellKey(entry.cells))!.cells])) as Record<Rotation, readonly GridPoint[]>;
  return Object.freeze({ distinct, rotation: Object.freeze(rotation), cells: Object.freeze(cells) });
}

const ORIENTATION_DATA: Readonly<Record<ShapeId, OrientationData>> = Object.freeze(
  Object.fromEntries(SHAPE_IDS.map((shapeId) => [shapeId, orientationData(SHAPES[shapeId])])) as Record<ShapeId, OrientationData>,
);

/** Distinct orientations in 0/90/180/270 order, keeping the first rotation that makes each cell set. */
export function orientations(shape: ModShape): readonly ShapeOrientation[] {
  return ORIENTATION_DATA[shape.id].distinct;
}

/** Collapse a degree rotation to the first rotation that produces the same canonical footprint. */
export function normaliseRotation(shape: ModShape, rotation: Rotation): Rotation {
  return ORIENTATION_DATA[shape.id].rotation[rotation];
}

/** Canonical cells for a degree rotation, with symmetrical duplicates collapsed to their first orientation. */
export function cellsAt(shape: ModShape, rotation: Rotation): readonly GridPoint[] {
  return ORIENTATION_DATA[shape.id].cells[rotation];
}

export function isRotation(value: unknown): value is Rotation {
  return value === 0 || value === 90 || value === 180 || value === 270;
}

export function nextRotation(rotation: Rotation): Rotation {
  return ((rotation + 90) % 360) as Rotation;
}

/** Order-preserving cells remain for Prep's anchor until tasks-012 moves rotation about the pointer cell. */
function turned(shapeId: ShapeId, rotation: Rotation): readonly GridPoint[] {
  let cells: GridPoint[] = SHAPES[shapeId].cells.map(({ x, y }) => ({ x, y }));
  // On a grid whose y points down, a clockwise quarter turn takes (x, y) to (-y, x).
  for (let turn = 0; turn < rotation / 90; turn++) cells = cells.map(({ x, y }) => ({ x: -y, y: x }));
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
  return TURNED[shapeId][rotation / 90];
}

/** Bounding width and height of an oriented footprint. */
export function shapeSize(cells: readonly GridPoint[]): readonly [number, number] {
  return [Math.max(...cells.map(({ x }) => x)) + 1, Math.max(...cells.map(({ y }) => y)) + 1];
}
