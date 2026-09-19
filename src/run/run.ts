import type { ActionType } from "../battle/actions.ts";
import { defaultLoadout, isBarId, isSlotIndex, setLoadoutSlot } from "../battle/bars.ts";
import type { ActionLoadout, BarId } from "../battle/bars.ts";
import type { MatchOutcome, OutcomeReason } from "../battle/director.ts";
import type { StyleRank } from "../battle/style.ts";
import { compileBuild } from "../mods/compile.ts";
import type { Build } from "../mods/compile.ts";
import { BANK_SIZE, canPlace, cellsOf, emptyBank, firstFreeBankSlot, place, removeFromGrid, rotateInPlace, setBankSlot, turnAbout } from "../mods/grid.ts";
import type { Bank, Grid, OwnedMod } from "../mods/grid.ts";
import { MOD_IDS, REGISTRY, priceOf } from "../mods/registry.ts";
import type { ModId } from "../mods/registry.ts";
import { SHAPES, normaliseRotation } from "../mods/shapes.ts";
import { RECIPES } from "../mods/stars.ts";
import type { Stars } from "../mods/stars.ts";
import type { GridPoint, Rotation } from "../mods/shapes.ts";
import { STARTING_MONEY, payday, sellValue, total } from "./economy.ts";
import type { PaydayLine } from "./economy.ts";
import { opponentFor } from "./opponents.ts";
import type { Opponent } from "./opponents.ts";
import { REROLL_PRICE, SHOP_SIZE, rollOffers } from "./shop.ts";

export const RUN_HEARTS = 5;
export const TROPHIES_TO_WIN = 10;

export type RunPhase = "prep" | "fight" | "payday" | "over";

export interface ShopState {
  /** Five offers; a sold one is null until the shop next rolls. */
  readonly offers: readonly (ModId | null)[];
  readonly locked: boolean;
  /** Rerolls taken today — which is also the roll today's offers came from. */
  readonly rerolls: number;
}

/** How a fight ended, as the game layer reports it. The run never runs a fight itself. */
export interface FightReport {
  readonly result: MatchOutcome;
  readonly reason: OutcomeReason;
  readonly peakStyle: StyleRank;
  readonly rounds: number;
}

export interface DaySummary extends FightReport {
  readonly day: number;
  readonly payday: readonly PaydayLine[];
  readonly earned: number;
}

export interface RunRecord {
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly bestStyle: StyleRank;
}

/** Everything a run is, as plain data: it is what the autosave writes. */
export interface RunState {
  readonly seed: number;
  day: number;
  phase: RunPhase;
  hearts: number;
  trophies: number;
  money: number;
  loadout: ActionLoadout;
  grid: Grid;
  bank: Bank;
  shop: ShopState;
  /** The uid the next mod bought will get. */
  nextUid: number;
  /** Money held when the fight in progress began: interest is paid on it. */
  stake: number | null;
  /** The last fight and its payday. */
  last: DaySummary | null;
  record: RunRecord;
  ending: "champion" | "knocked-out" | null;
}

/**
 * Why an action was refused. A refusal changes nothing; the UI shows it. Only a request the run
 * cannot understand at all — a slot that does not exist — throws.
 */
export type Refusal = "wrong-phase" | "sold-out" | "cannot-afford" | "no-room" | "blocked" | "missing";

/** Where a mod can go. */
export type Destination =
  | { readonly bank: number }
  | { readonly grid: { readonly x: number; readonly y: number; readonly rotation: Rotation } };

/** Where an owned mod is: a bank slot, or a piece on the grid by uid. */
export type Source = { readonly bank: number } | { readonly piece: number };

export function newRun(seed: number): RunState {
  return {
    seed,
    day: 1,
    phase: "prep",
    hearts: RUN_HEARTS,
    trophies: 0,
    money: STARTING_MONEY,
    loadout: defaultLoadout(),
    grid: Object.freeze([]),
    bank: emptyBank(),
    shop: { offers: Object.freeze(rollOffers(seed, 1, 0)), locked: false, rerolls: 0 },
    nextUid: 1,
    stake: null,
    last: null,
    record: { wins: 0, losses: 0, draws: 0, bestStyle: 0 },
    ending: null,
  };
}

export function buildOf(run: RunState): Build {
  return compileBuild(run.grid);
}

export function opponentOf(run: RunState): Opponent {
  return opponentFor(run.seed, run.day);
}

/** Nothing while the day's free rerolls — one per placed Coupon — last. */
export function rerollPrice(run: RunState): number {
  return run.shop.rerolls < buildOf(run).freeRerolls ? 0 : REROLL_PRICE;
}

export function ownedAt(run: RunState, source: Source): OwnedMod | null {
  if ("bank" in source) return run.bank[source.bank] ?? null;
  return run.grid.find((placed) => placed.uid === source.piece) ?? null;
}

function checkBankSlot(slot: number): void {
  if (!Number.isInteger(slot) || slot < 0 || slot >= BANK_SIZE) throw new RangeError(`bank slot ${slot} does not exist`);
}

/** Puts `owned` at `to`, or refuses. `except` is the piece's own uid when it is moving over itself. */
function put(run: RunState, owned: OwnedMod, to: Destination, except: number | null): Refusal | null {
  if ("bank" in to) {
    checkBankSlot(to.bank);
    if (run.bank[to.bank] !== null) return "blocked";
    run.bank = setBankSlot(run.bank, to.bank, owned);
    return null;
  }
  const placed = { uid: owned.uid, mod: owned.mod, stars: owned.stars, ...to.grid };
  if (!canPlace(run.grid, placed, except)) return "blocked";
  run.grid = place(run.grid, placed)!;
  return null;
}

function take(run: RunState, source: Source): void {
  if ("bank" in source) run.bank = setBankSlot(run.bank, source.bank, null);
  else run.grid = removeFromGrid(run.grid, source.piece);
}

/** Every owned copy of `mod` at `stars`, oldest first, and where it is. */
function copies(run: RunState, mod: ModId, stars: Stars): Array<{ owned: OwnedMod; source: Source }> {
  const found = [
    ...run.bank.flatMap((owned, slot) => (owned !== null && owned.mod === mod && owned.stars === stars ? [{ owned, source: { bank: slot } }] : [])),
    ...run.grid.filter((piece) => piece.mod === mod && piece.stars === stars).map((piece) => ({ owned: piece as OwnedMod, source: { piece: piece.uid } })),
  ];
  return found.sort((a, b) => a.owned.uid - b.owned.uid);
}

/** The oldest copy becomes the combined mod, where it stands and turned the way it was. */
function upgrade(run: RunState, source: Source, stars: Stars): void {
  if ("bank" in source) run.bank = setBankSlot(run.bank, source.bank, { ...run.bank[source.bank]!, stars });
  else run.grid = Object.freeze(run.grid.map((piece) => (piece.uid === source.piece ? Object.freeze({ ...piece, stars }) : piece)));
}

/**
 * Combines every set the run owns until nothing combines: three ★ copies of a mod into one ★★, two
 * ★★ into one ★★★. The oldest copy of a set survives, in its place; the others are gone. Returns
 * the uids of the mods it made, in the order it made them.
 */
export function combineCopies(run: RunState): number[] {
  const made: number[] = [];
  for (let again = true; again;) {
    again = false;
    for (const { from, count, to } of RECIPES) {
      for (const mod of MOD_IDS) {
        const set = copies(run, mod, from);
        if (set.length < count) continue;
        const [keep, ...rest] = set.slice(0, count);
        for (const { source } of rest) take(run, source);
        upgrade(run, keep.source, to);
        made.push(keep.owned.uid);
        again = true;
      }
    }
  }
  return made;
}

/**
 * Buys offer `offer` into `to`, or into the first free bank slot when no destination is given, then
 * combines whatever set it completed. A copy that completes a set needs no slot of its own.
 */
export function buy(run: RunState, offer: number, to?: Destination): Refusal | null {
  if (run.phase !== "prep") return "wrong-phase";
  if (!Number.isInteger(offer) || offer < 0 || offer >= SHOP_SIZE) throw new RangeError(`offer ${offer} does not exist`);
  const mod = run.shop.offers[offer];
  if (mod === null) return "sold-out";
  if (priceOf(mod) > run.money) return "cannot-afford";
  const copy: OwnedMod = { uid: run.nextUid, mod, stars: 1, rotation: 0 };
  const completes = copies(run, mod, 1).length >= RECIPES[0].count - 1;
  let destination = to;
  if (destination === undefined) {
    const slot = firstFreeBankSlot(run.bank);
    if (slot === null && !completes) return "no-room";
    if (slot !== null) destination = { bank: slot };
  }
  if (destination !== undefined) {
    const refused = put(run, copy, destination, null);
    if (refused) return refused;
  } else {
    // The bank is full, and this copy completes a set: it joins the set without ever being placed.
    const [keep, second] = copies(run, mod, 1);
    take(run, second.source);
    upgrade(run, keep.source, RECIPES[0].to);
  }
  run.nextUid++;
  run.money -= priceOf(mod);
  run.shop = { ...run.shop, offers: Object.freeze(run.shop.offers.map((candidate, index) => (index === offer ? null : candidate))) };
  combineCopies(run);
  return null;
}

export function sell(run: RunState, from: Source): Refusal | null {
  if (run.phase !== "prep") return "wrong-phase";
  if ("bank" in from) checkBankSlot(from.bank);
  const owned = ownedAt(run, from);
  if (owned === null) return "missing";
  take(run, from);
  run.money += sellValue(owned);
  return null;
}

/** Moves an owned mod between the bank and the grid, or within either. The rotation travels with it. */
export function move(run: RunState, from: Source, to: Destination): Refusal | null {
  if (run.phase !== "prep") return "wrong-phase";
  if ("bank" in from) checkBankSlot(from.bank);
  const owned = ownedAt(run, from);
  if (owned === null) return "missing";
  if ("bank" in from && "bank" in to && from.bank === to.bank) return null;
  const rotated = "grid" in to
    ? { ...owned, rotation: normaliseRotation(SHAPES[REGISTRY[owned.mod].shape], to.grid.rotation) }
    : owned;
  const before = { grid: run.grid, bank: run.bank };
  take(run, from);
  const refused = put(run, rotated, to, null);
  if (refused) {
    run.grid = before.grid;
    run.bank = before.bank;
  }
  return refused;
}

/**
 * Turns an owned mod a quarter clockwise. In the bank that always works; on the grid it works only
 * if the turned piece still fits where it stands, and otherwise nothing moves.
 */
export function rotate(run: RunState, source: Source, pivot?: GridPoint): Refusal | null {
  if (run.phase !== "prep") return "wrong-phase";
  if ("bank" in source) checkBankSlot(source.bank);
  const owned = ownedAt(run, source);
  if (owned === null) return "missing";
  if ("bank" in source) {
    const placement = { mod: owned.mod, rotation: owned.rotation, x: 0, y: 0 };
    const anchor = cellsOf(placement)[0];
    const turned = turnAbout(placement, anchor);
    if (turned === null) return "blocked";
    run.bank = setBankSlot(run.bank, source.bank, { ...owned, rotation: turned.rotation });
    return null;
  }
  const turned = rotateInPlace(run.grid, source.piece, pivot);
  if (turned === null) return "blocked";
  run.grid = turned;
  return null;
}

/** New offers from the next roll of the day. Rerolling also releases the lock. */
export function reroll(run: RunState): Refusal | null {
  if (run.phase !== "prep") return "wrong-phase";
  const price = rerollPrice(run);
  if (price > run.money) return "cannot-afford";
  const rerolls = run.shop.rerolls + 1;
  run.money -= price;
  run.shop = { offers: Object.freeze(rollOffers(run.seed, run.day, rerolls)), locked: false, rerolls };
  return null;
}

export function toggleLock(run: RunState): Refusal | null {
  if (run.phase !== "prep") return "wrong-phase";
  run.shop = { ...run.shop, locked: !run.shop.locked };
  return null;
}

export function setAction(run: RunState, bar: BarId, slot: number, action: ActionType): Refusal | null {
  if (run.phase !== "prep") return "wrong-phase";
  if (!isBarId(bar) || !isSlotIndex(slot)) throw new RangeError(`${String(bar)} slot ${slot} does not exist`);
  run.loadout = setLoadoutSlot(run.loadout, bar, slot, action);
  return null;
}

/** Locks the build and bars for the day's fight. Interest is paid on the money held now. */
export function beginFight(run: RunState): Refusal | null {
  if (run.phase !== "prep") return "wrong-phase";
  run.phase = "fight";
  run.stake = run.money;
  return null;
}

/** Records how the day's fight ended, pays out, and either ends the run or moves to payday. */
export function finishFight(run: RunState, report: FightReport): Refusal | null {
  if (run.phase !== "fight") return "wrong-phase";
  const lines = payday({ result: report.result, stake: run.stake ?? 0, peakStyle: report.peakStyle, build: buildOf(run) });
  const earned = total(lines);
  const { record } = run;
  run.record = {
    wins: record.wins + (report.result === "victory" ? 1 : 0),
    losses: record.losses + (report.result === "defeat" ? 1 : 0),
    draws: record.draws + (report.result === "draw" ? 1 : 0),
    bestStyle: Math.max(record.bestStyle, report.peakStyle) as StyleRank,
  };
  if (report.result === "victory") run.trophies++;
  if (report.result === "defeat") run.hearts--;
  run.last = { day: run.day, ...report, payday: Object.freeze(lines), earned };
  run.stake = null;
  if (run.trophies >= TROPHIES_TO_WIN) {
    run.phase = "over";
    run.ending = "champion";
  } else if (run.hearts <= 0) {
    run.phase = "over";
    run.ending = "knocked-out";
  } else {
    run.money += earned;
    run.phase = "payday";
  }
  return null;
}

/** The next morning: a fresh shop, keeping any locked offers that were not bought. */
export function nextDay(run: RunState): Refusal | null {
  if (run.phase !== "payday") return "wrong-phase";
  run.day++;
  const fresh = rollOffers(run.seed, run.day, 0);
  const offers = run.shop.locked ? run.shop.offers.map((offer, index) => offer ?? fresh[index]) : fresh;
  run.shop = { offers: Object.freeze(offers), locked: false, rerolls: 0 };
  run.phase = "prep";
  return null;
}
