import { SPEEDS } from "./clock.ts";
import type { BattleSpeed } from "./clock.ts";

/** Only what works. A setting is added here when something reads it. */
export interface Settings {
  readonly speed: BattleSpeed;
}

export const DEFAULT_SETTINGS: Settings = { speed: 1 };

const KEY = "fightlab.settings";

/** Storage can be missing or throw (private windows, blocked site data); the game works without it. */
export function loadSettings(storage: Pick<Storage, "getItem"> | null = localStorageOrNull()): Settings {
  try {
    const stored = JSON.parse(storage?.getItem(KEY) ?? "null") as Partial<Settings> | null;
    const speed = SPEEDS.find((candidate) => candidate === stored?.speed);
    return speed === undefined ? DEFAULT_SETTINGS : { speed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings, storage: Pick<Storage, "setItem"> | null = localStorageOrNull()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Unsaved is fine; the setting still applies for this session.
  }
}

function localStorageOrNull(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
