import { describe, expect, it } from "vitest";

import { pick } from "../mods/fixtures.ts";
import { beginFight, buy, finishFight, newRun, nextDay } from "../../src/run/run.ts";
import type { RunState } from "../../src/run/run.ts";
import { SAVE_KEY, SAVE_VERSION, clearSave, decodeSave, encodeSave, readSave, writeSave } from "../../src/run/save.ts";

const SINGLE = pick({ size: 1 });
const DOMINO = pick({ size: 2 });
const TRIOMINO = pick({ size: 3 });
const REROLL = pick({ type: "neutral", affinity: null, rarity: "uncommon", size: 1 });

/** A run with something in every field: mods on the grid and in the bank, a payday behind it. */
function lived(): RunState {
  const run = newRun(31337);
  run.money = 40;
  run.shop = { ...run.shop, offers: [DOMINO.id, SINGLE.id, TRIOMINO.id, null, REROLL.id] };
  buy(run, 0, { grid: { x: 0, y: 0, rotation: 0 } });
  buy(run, 1);
  buy(run, 2, { grid: { x: 0, y: 2, rotation: 0 } });
  beginFight(run);
  finishFight(run, { result: "victory", reason: "ko", peakStyle: 3, rounds: 4 });
  nextDay(run);
  return run;
}

/** Re-encodes a save after `edit` has had its way with the raw document. */
function tampered(run: RunState, edit: (document: { version: unknown; run: Record<string, unknown>; fight: unknown }) => void): string {
  const document = JSON.parse(encodeSave(run, null));
  edit(document);
  return JSON.stringify(document);
}

function memory() {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  };
}

describe("the autosave", () => {
  it("is versioned for the replacement 64-mod registry", () => {
    expect(SAVE_VERSION).toBe(4);
    expect(JSON.parse(encodeSave(newRun(1), null))).toMatchObject({ version: 4, fight: null });
  });

  it("discards versions 2 and 3 whole", () => {
    const current = JSON.parse(encodeSave(lived(), null));
    for (const version of [2, 3]) {
      expect(decodeSave(JSON.stringify({ ...current, version })), `version ${version}`).toBeNull();
    }
  });

  it("round-trips a run exactly", () => {
    const run = lived();
    expect(decodeSave(encodeSave(run, null))).toEqual({ version: 4, run, fight: null });
    const fresh = newRun(0);
    expect(decodeSave(encodeSave(fresh, null))!.run).toEqual(fresh);
  });

  it("keeps the player's Mixup decisions only while a fight is in progress", () => {
    const run = lived();
    beginFight(run);
    expect(decodeSave(encodeSave(run, { decisions: [true, false, true] }))!.fight).toEqual({ decisions: [true, false, true] });
    const prep = lived();
    expect(decodeSave(encodeSave(prep, { decisions: [true] }))!.fight).toBeNull();
    expect(decodeSave(tampered(prep, (document) => { document.fight = { decisions: [true] }; }))).toBeNull();
    beginFight(prep);
    expect(decodeSave(tampered(prep, (document) => { document.fight = { decisions: ["yes"] }; }))).toBeNull();
  });

  it("refuses any other version", () => {
    const run = lived();
    for (const version of [0, 1, 2, 3, 5, "4", null, undefined]) {
      expect(decodeSave(tampered(run, (document) => { document.version = version; })), String(version)).toBeNull();
    }
  });

  it("refuses a document that is not a run it could have written", () => {
    const run = lived();
    const edits: Record<string, (document: { run: Record<string, unknown> }) => void> = {
      "missing money": (document) => { delete document.run.money; },
      "fractional money": (document) => { document.run.money = 3.5; },
      "negative money": (document) => { document.run.money = -1; },
      "a bad seed": (document) => { document.run.seed = -4; },
      "a sixth heart": (document) => { document.run.hearts = 6; },
      "an eleventh trophy": (document) => { document.run.trophies = 11; },
      "an unknown phase": (document) => { document.run.phase = "shopping"; },
      "an unknown mod": (document) => { (document.run.grid as Array<Record<string, unknown>>)[0].mod = "laser"; },
      "overlapping mods": (document) => { (document.run.grid as Array<Record<string, unknown>>)[1].y = 0; },
      "a mod off the board": (document) => { (document.run.grid as Array<Record<string, unknown>>)[1].x = 2; },
      "a bad rotation": (document) => { (document.run.grid as Array<Record<string, unknown>>)[0].rotation = 45; },
      "four stars": (document) => { (document.run.grid as Array<Record<string, unknown>>)[0].stars = 4; },
      "no stars": (document) => { delete (document.run.bank as Array<Record<string, unknown> | null>)[0]!.stars; },
      "a short bank": (document) => { document.run.bank = [null, null, null]; },
      "a repeated uid": (document) => { (document.run.bank as Array<Record<string, unknown> | null>)[0]!.uid = 1; },
      "a uid from the future": (document) => { document.run.nextUid = 2; },
      "a four-slot bar": (document) => { (document.run.loadout as Record<string, unknown>).primary = ["strike", "tech", "block", "tech"]; },
      "a third bar": (document) => { (document.run.loadout as Record<string, unknown>).tertiary = ["strike", "tech", "block"]; },
      "six offers": (document) => { (document.run.shop as Record<string, unknown>).offers = [null, null, null, null, null, null]; },
      "an ending mid-run": (document) => { document.run.ending = "champion"; },
      "a stake outside a fight": (document) => { document.run.stake = 5; },
      "an unknown payday line": (document) => { ((document.run.last as Record<string, unknown>).payday as Array<Record<string, unknown>>)[0].label = "bonus"; },
    };
    expect(decodeSave(encodeSave(run, null))).not.toBeNull();
    for (const [name, edit] of Object.entries(edits)) expect(decodeSave(tampered(run, edit)), name).toBeNull();
  });

  it("refuses what is not JSON, or not there", () => {
    expect(decodeSave(null)).toBeNull();
    expect(decodeSave("")).toBeNull();
    expect(decodeSave("{not json")).toBeNull();
    expect(decodeSave("[]")).toBeNull();
    expect(decodeSave("null")).toBeNull();
  });

  it("reads, writes and clears storage, and shrugs when storage fails", () => {
    const storage = memory();
    const run = lived();
    writeSave(run, null, storage);
    expect(storage.store.has(SAVE_KEY)).toBe(true);
    expect(readSave(storage)!.run).toEqual(run);
    clearSave(storage);
    expect(readSave(storage)).toBeNull();
    const broken = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("quota"); }, removeItem: () => { throw new Error("denied"); } };
    expect(readSave(broken)).toBeNull();
    expect(() => writeSave(run, null, broken)).not.toThrow();
    expect(() => clearSave(broken)).not.toThrow();
    expect(readSave(null)).toBeNull();
  });
});
