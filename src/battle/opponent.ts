import type { ActionProgram } from "./program.ts";

/**
 * The first slice's opponent: a fixed program, so every match against it reproduces without a
 * seed. It has the player's type and nothing more. A seeded generator replaces this constant
 * through the match configuration, never through the director.
 */
export const OPPONENT_PROGRAM: ActionProgram = Object.freeze(["tech", "block", "strike", "tech", "strike"] as const);
