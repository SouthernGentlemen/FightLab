import { EMPTY_PROGRAM, programOf } from "../../src/mods/program.ts";
import type { ModProgram } from "../../src/mods/program.ts";
import type { ModId } from "../../src/mods/registry.ts";
import { freshState } from "../../src/mods/resolve.ts";
import type { ModState, Outcome } from "../../src/mods/resolve.ts";
import type { Rotation } from "../../src/mods/shapes.ts";
import type { Stars } from "../../src/mods/stars.ts";

/** Test helpers for the engine: programs from `[mod, x, y, stars?, rotation?]`, states and outcomes. */

let uid = 0;

export function program(...pieces: ReadonlyArray<readonly [ModId, number, number, Stars?, Rotation?]>): ModProgram {
  return programOf(pieces.map(([mod, x, y, stars = 1, rotation = 0]) => ({ uid: ++uid, mod, x, y, stars, rotation })));
}

export const NOTHING = EMPTY_PROGRAM;

export function state(patch: Partial<ModState> = {}): ModState {
  return { ...freshState(), ...patch };
}

/** Nobody hurt: guards against guards, or a parry. */
export const QUIET: Outcome = { landed: [false, false], hurt: [false, false], exposed: [0, 0] };
/** The player's move hurt the opponent and nothing hurt the player. */
export const PLAYER_LANDS: Outcome = { landed: [true, false], hurt: [false, true], exposed: [0, 0] };
export const OPPONENT_LANDS: Outcome = { landed: [false, true], hurt: [true, false], exposed: [0, 0] };
