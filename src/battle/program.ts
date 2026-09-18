import { isActionType } from "./actions.ts";
import type { ActionType } from "./actions.ts";

export const PROGRAM_LENGTH = 5;

/** Five slots, compared slot for slot against the opponent's five, repeated until a knockout. */
export type ActionProgram = readonly [ActionType, ActionType, ActionType, ActionType, ActionType];

export function defaultProgram(): ActionProgram {
  return Object.freeze(["strike", "strike", "strike", "strike", "strike"] as const);
}

export function isActionProgram(value: unknown): value is ActionProgram {
  return Array.isArray(value) && value.length === PROGRAM_LENGTH && value.every(isActionType);
}

/** A new program that differs from `program` in `slot` alone. Programs are never edited in place. */
export function setSlot(program: ActionProgram, slot: number, action: ActionType): ActionProgram {
  if (!Number.isInteger(slot) || slot < 0 || slot >= PROGRAM_LENGTH) {
    throw new RangeError(`slot ${slot} is not one of 0–${PROGRAM_LENGTH - 1}`);
  }
  if (!isActionType(action)) throw new TypeError(`'${String(action)}' is not an action`);
  const next = [...program];
  next[slot] = action;
  return Object.freeze(next) as unknown as ActionProgram;
}

/** Where both programs are: the slot being resolved and how many times the loop has wrapped. */
export interface Cursor {
  readonly index: number;
  readonly cycle: number;
}

export function advanceCursor(cursor: Cursor): Cursor {
  const index = (cursor.index + 1) % PROGRAM_LENGTH;
  return { index, cycle: index === 0 ? cursor.cycle + 1 : cursor.cycle };
}
