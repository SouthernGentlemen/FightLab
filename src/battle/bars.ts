import { isActionType } from "./actions.ts";
import type { ActionType } from "./actions.ts";

export const BAR_LENGTH = 3;
export const BAR_IDS = ["primary", "secondary"] as const;
export type BarId = (typeof BAR_IDS)[number];
export type SlotIndex = 0 | 1 | 2;

/** Three slots, played once per round against the opponent's three, slot for slot. */
export type ActionBar = readonly [ActionType, ActionType, ActionType];

/** Both plans a fighter takes into a fight. Every round 1 opens on `primary`. */
export interface ActionLoadout {
  readonly primary: ActionBar;
  readonly secondary: ActionBar;
}

export function isSlotIndex(value: unknown): value is SlotIndex {
  return value === 0 || value === 1 || value === 2;
}

export function isBarId(value: unknown): value is BarId {
  return value === "primary" || value === "secondary";
}

export function isActionBar(value: unknown): value is ActionBar {
  return Array.isArray(value) && value.length === BAR_LENGTH && value.every(isActionType);
}

/** Exactly two bars, named, and nothing else: a third plan is not a thing a fighter can own. */
export function isActionLoadout(value: unknown): value is ActionLoadout {
  if (typeof value !== "object" || value === null) return false;
  const keys = Object.keys(value).sort();
  if (keys.length !== 2 || keys[0] !== "primary" || keys[1] !== "secondary") return false;
  const { primary, secondary } = value as Record<string, unknown>;
  return isActionBar(primary) && isActionBar(secondary);
}

export function actionBar(first: ActionType, second: ActionType, third: ActionType): ActionBar {
  const bar = [first, second, third];
  if (!isActionBar(bar)) throw new TypeError(`[${bar.join(", ")}] is not three actions`);
  return Object.freeze(bar) as unknown as ActionBar;
}

/** A frozen copy, so a loadout handed to a fight cannot be edited through any reference to it. */
export function actionLoadout(primary: ActionBar, secondary: ActionBar): ActionLoadout {
  if (!isActionBar(primary)) throw new TypeError("the primary bar is not three actions");
  if (!isActionBar(secondary)) throw new TypeError("the secondary bar is not three actions");
  return Object.freeze({ primary: actionBar(...primary), secondary: actionBar(...secondary) });
}

export function defaultLoadout(): ActionLoadout {
  return actionLoadout(["strike", "tech", "block"], ["block", "block", "strike"]);
}

/** A new bar that differs from `bar` in `slot` alone. Bars are never edited in place. */
export function setBarSlot(bar: ActionBar, slot: number, action: ActionType): ActionBar {
  if (!isSlotIndex(slot)) throw new RangeError(`slot ${slot} is not one of 0–${BAR_LENGTH - 1}`);
  if (!isActionType(action)) throw new TypeError(`'${String(action)}' is not an action`);
  const next = [...bar] as [ActionType, ActionType, ActionType];
  next[slot] = action;
  return actionBar(...next);
}

export function setLoadoutSlot(loadout: ActionLoadout, bar: BarId, slot: number, action: ActionType): ActionLoadout {
  if (!isBarId(bar)) throw new TypeError(`'${String(bar)}' is not a bar`);
  const changed = setBarSlot(loadout[bar], slot, action);
  return bar === "primary" ? actionLoadout(changed, loadout.secondary) : actionLoadout(loadout.primary, changed);
}

export function otherBar(bar: BarId): BarId {
  return bar === "primary" ? "secondary" : "primary";
}

export function sameBar(a: ActionBar, b: ActionBar): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}
