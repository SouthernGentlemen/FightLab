import { actionLoadout, isActionLoadout } from "../battle/bars.ts";
import type { ActionLoadout } from "../battle/bars.ts";
import type { MatchOutcome, OutcomeReason } from "../battle/director.ts";
import type { StyleRank } from "../battle/style.ts";
import { BANK_SIZE, place } from "../mods/grid.ts";
import type { Bank, Grid, OwnedMod } from "../mods/grid.ts";
import { REGISTRY, isModId } from "../mods/registry.ts";
import type { ModId } from "../mods/registry.ts";
import { SHAPES, isRotation, normaliseRotation } from "../mods/shapes.ts";
import type { Rotation } from "../mods/shapes.ts";
import { isStars } from "../mods/stars.ts";
import type { PaydayLabel, PaydayLine } from "./economy.ts";
import { isSeed } from "./random.ts";
import { RUN_HEARTS, TROPHIES_TO_WIN } from "./run.ts";
import type { DaySummary, RunPhase, RunRecord, RunState, ShopState } from "./run.ts";
import { SHOP_SIZE } from "./shop.ts";

/**
 * The autosave. Versioned from the first release: a document this build cannot read — another
 * version, a missing field, an impossible value — is discarded whole, never half-loaded. Changing
 * the saved shape means a new version and, if old saves are to survive, a migration with a test.
 */
/** Version 3 stores canonical degree rotations; version 2 quarter turns migrate on read. */
export const SAVE_VERSION = 3;
export const SAVE_KEY = "fightlab.run";

/** The player's Mixup decisions in the fight in progress, one per pause left so far. */
export interface FightProgress {
  readonly decisions: readonly boolean[];
}

export interface SaveDocument {
  readonly version: typeof SAVE_VERSION;
  readonly run: RunState;
  readonly fight: FightProgress | null;
}

export function encodeSave(run: RunState, fight: FightProgress | null): string {
  const document: SaveDocument = { version: SAVE_VERSION, run, fight: run.phase === "fight" ? fight : null };
  return JSON.stringify(document);
}

export function decodeSave(text: string | null): SaveDocument | null {
  if (text === null) return null;
  try {
    return readDocument(JSON.parse(text));
  } catch {
    return null;
  }
}

/** Storage can be missing or throw (private windows, blocked site data); the game works without it. */
function localStorageOrNull(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readSave(storage: Pick<Storage, "getItem"> | null = localStorageOrNull()): SaveDocument | null {
  try {
    return decodeSave(storage?.getItem(SAVE_KEY) ?? null);
  } catch {
    return null;
  }
}

export function writeSave(run: RunState, fight: FightProgress | null, storage: Pick<Storage, "setItem"> | null = localStorageOrNull()): void {
  try {
    storage?.setItem(SAVE_KEY, encodeSave(run, fight));
  } catch {
    // Unsaved is fine; the run goes on in memory.
  }
}

export function clearSave(storage: Pick<Storage, "removeItem"> | null = localStorageOrNull()): void {
  try {
    storage?.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear is the same as cleared.
  }
}

class Invalid extends Error {}

function fail(what: string): never {
  throw new Invalid(what);
}

function record(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(what);
  return value as Record<string, unknown>;
}

function integer(value: unknown, what: string, min: number, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) fail(what);
  return value as number;
}

function oneOf<T extends string>(value: unknown, options: readonly T[], what: string): T {
  if (!options.includes(value as T)) fail(what);
  return value as T;
}

function modId(value: unknown, what: string): ModId {
  if (!isModId(value)) fail(what);
  return value;
}

function owned(value: unknown, what: string, v2 = false): OwnedMod {
  const data = record(value, what);
  const mod = modId(data.mod, `${what}: mod`);
  const raw = v2 ? integer(data.rotation, `${what}: rotation`, 0, 3) * 90 : data.rotation;
  if (!isRotation(raw) || !isStars(data.stars)) fail(`${what}: rotation or stars`);
  const rotation = normaliseRotation(SHAPES[REGISTRY[mod].shape], raw as Rotation);
  return Object.freeze({ uid: integer(data.uid, `${what}: uid`, 1), mod, stars: data.stars, rotation });
}

function readGrid(value: unknown, v2 = false): Grid {
  if (!Array.isArray(value)) fail("grid");
  let grid: Grid = Object.freeze([]);
  for (const [index, entry] of value.entries()) {
    const piece = owned(entry, `grid ${index}`, v2);
    const data = record(entry, `grid ${index}`);
    const next = place(grid, { ...piece, x: integer(data.x, `grid ${index}: x`, 0), y: integer(data.y, `grid ${index}: y`, 0) });
    if (next === null) fail(`grid ${index}: not a legal placement`);
    grid = next;
  }
  return grid;
}

function readBank(value: unknown, v2 = false): Bank {
  if (!Array.isArray(value) || value.length !== BANK_SIZE) fail("bank");
  return Object.freeze(value.map((entry, index) => (entry === null ? null : owned(entry, `bank ${index}`, v2))));
}

function readShop(value: unknown): ShopState {
  const data = record(value, "shop");
  if (!Array.isArray(data.offers) || data.offers.length !== SHOP_SIZE) fail("shop offers");
  if (typeof data.locked !== "boolean") fail("shop lock");
  return {
    offers: Object.freeze(data.offers.map((offer, index) => (offer === null ? null : modId(offer, `offer ${index}`)))),
    locked: data.locked,
    rerolls: integer(data.rerolls, "rerolls", 0),
  };
}

function readLoadout(value: unknown): ActionLoadout {
  if (!isActionLoadout(value)) fail("loadout");
  return actionLoadout(value.primary, value.secondary);
}

function style(value: unknown, what: string): StyleRank {
  return integer(value, what, 0, 3) as StyleRank;
}

const OUTCOMES: readonly MatchOutcome[] = ["victory", "defeat", "draw"];
const REASONS: readonly OutcomeReason[] = ["ko", "double-ko", "stalemate", "limit"];
const LABELS: readonly PaydayLabel[] = ["base", "result", "interest", "style", "perks"];
const PHASES: readonly RunPhase[] = ["prep", "fight", "payday", "over"];

function readSummary(value: unknown): DaySummary | null {
  if (value === null) return null;
  const data = record(value, "last fight");
  if (!Array.isArray(data.payday)) fail("payday");
  const payday: PaydayLine[] = data.payday.map((line, index) => {
    const entry = record(line, `payday ${index}`);
    return { label: oneOf(entry.label, LABELS, `payday ${index}: label`), amount: integer(entry.amount, `payday ${index}: amount`, 0) };
  });
  return {
    day: integer(data.day, "last fight: day", 1),
    result: oneOf(data.result, OUTCOMES, "last fight: result"),
    reason: oneOf(data.reason, REASONS, "last fight: reason"),
    peakStyle: style(data.peakStyle, "last fight: style"),
    rounds: integer(data.rounds, "last fight: rounds", 1),
    payday: Object.freeze(payday),
    earned: integer(data.earned, "last fight: earned", 0),
  };
}

function readRecord(value: unknown): RunRecord {
  const data = record(value, "record");
  return {
    wins: integer(data.wins, "wins", 0),
    losses: integer(data.losses, "losses", 0),
    draws: integer(data.draws, "draws", 0),
    bestStyle: style(data.bestStyle, "best style"),
  };
}

function readRun(value: unknown, v2 = false): RunState {
  const data = record(value, "run");
  if (!isSeed(data.seed)) fail("seed");
  const phase = oneOf(data.phase, PHASES, "phase");
  const grid = readGrid(data.grid, v2);
  const bank = readBank(data.bank, v2);
  const nextUid = integer(data.nextUid, "next uid", 1);
  const uids = [...grid.map((piece) => piece.uid), ...bank.flatMap((slot) => (slot ? [slot.uid] : []))];
  if (new Set(uids).size !== uids.length || uids.some((uid) => uid >= nextUid)) fail("mod uids");
  const ending = data.ending === null ? null : oneOf(data.ending, ["champion", "knocked-out"] as const, "ending");
  if ((phase === "over") !== (ending !== null)) fail("ending");
  const stake = data.stake === null ? null : integer(data.stake, "stake", 0);
  if ((phase === "fight") !== (stake !== null)) fail("stake");
  return {
    seed: data.seed,
    day: integer(data.day, "day", 1),
    phase,
    hearts: integer(data.hearts, "hearts", 0, RUN_HEARTS),
    trophies: integer(data.trophies, "trophies", 0, TROPHIES_TO_WIN),
    money: integer(data.money, "money", 0),
    loadout: readLoadout(data.loadout),
    grid,
    bank,
    shop: readShop(data.shop),
    nextUid,
    stake,
    last: readSummary(data.last),
    record: readRecord(data.record),
    ending,
  };
}

function readDocument(value: unknown): SaveDocument | null {
  try {
    const data = record(value, "document");
    if (data.version !== 2 && data.version !== SAVE_VERSION) return null;
    const run = readRun(data.run, data.version === 2);
    let fight: FightProgress | null = null;
    if (data.fight !== null) {
      const progress = record(data.fight, "fight");
      if (run.phase !== "fight" || !Array.isArray(progress.decisions) || !progress.decisions.every((decision) => typeof decision === "boolean")) {
        fail("fight");
      }
      fight = { decisions: Object.freeze([...progress.decisions]) };
    }
    return { version: SAVE_VERSION, run, fight };
  } catch (error) {
    if (error instanceof Invalid) return null;
    throw error;
  }
}
