import { shapeCells } from "./shapes.ts";
import type { GridPoint, Rotation, ShapeId } from "./shapes.ts";

/**
 * Directional connections between mods. A port sits on one cell of a mod, on one side of that
 * cell, and either feeds a resource out or takes it in. Ports are authored at rotation 0 and turn
 * with the piece, so rotating a mod on the grid is what points its ports at a neighbour or away.
 */

/** Clockwise from north, so a quarter turn is one step along this list. */
export const SIDES = ["n", "e", "s", "w"] as const;
export type Side = (typeof SIDES)[number];

export const RESOURCES = ["heat", "charge", "void"] as const;
export type Resource = (typeof RESOURCES)[number];

export type Flow = "in" | "out";

export interface Port {
  /** Index into the mod's shape cells, which keep their order through every rotation. */
  readonly cell: number;
  /** The side it faces at rotation 0. */
  readonly side: Side;
  readonly flow: Flow;
  readonly resource: Resource;
}

/** On a grid whose y points down. */
export const STEP: Readonly<Record<Side, GridPoint>> = { n: { x: 0, y: -1 }, e: { x: 1, y: 0 }, s: { x: 0, y: 1 }, w: { x: -1, y: 0 } };

export function turnSide(side: Side, rotation: Rotation): Side {
  return SIDES[(SIDES.indexOf(side) + rotation / 90) % SIDES.length];
}

export function opposite(side: Side): Side {
  return turnSide(side, 180);
}

/** What `links` needs to know about a placed piece. */
export interface PortedPiece {
  readonly uid: number;
  readonly shape: ShapeId;
  readonly rotation: Rotation;
  readonly x: number;
  readonly y: number;
  readonly ports: readonly Port[];
}

/** A port as it stands on the board: the cell it is on and the way it faces now. */
export interface BoardPort {
  readonly uid: number;
  readonly at: GridPoint;
  readonly side: Side;
  readonly flow: Flow;
  readonly resource: Resource;
}

export function boardPorts(piece: PortedPiece): BoardPort[] {
  const cells = shapeCells(piece.shape, piece.rotation);
  return piece.ports.map((port) => ({
    uid: piece.uid,
    at: { x: piece.x + cells[port.cell].x, y: piece.y + cells[port.cell].y },
    side: turnSide(port.side, piece.rotation),
    flow: port.flow,
    resource: port.resource,
  }));
}

/** One out-port facing a matching in-port of another mod across a shared edge. */
export interface Link {
  readonly from: number;
  readonly to: number;
  readonly resource: Resource;
}

const at = ({ x, y }: GridPoint, side: Side): string => `${x},${y},${side}`;

/** Every link on a board, in the order the pieces and their ports are listed. */
export function links(pieces: readonly PortedPiece[]): Link[] {
  const ports = pieces.flatMap(boardPorts);
  const inputs = new Map<string, BoardPort[]>();
  for (const port of ports) {
    if (port.flow !== "in") continue;
    const key = at(port.at, port.side);
    inputs.set(key, [...(inputs.get(key) ?? []), port]);
  }
  const found: Link[] = [];
  for (const out of ports) {
    if (out.flow !== "out") continue;
    const { x: dx, y: dy } = STEP[out.side];
    for (const input of inputs.get(at({ x: out.at.x + dx, y: out.at.y + dy }, opposite(out.side))) ?? []) {
      if (input.uid !== out.uid && input.resource === out.resource) found.push({ from: out.uid, to: input.uid, resource: out.resource });
    }
  }
  return found;
}
