import { OPPONENT_FIGURES } from "../run/opponents.ts";

/**
 * Which Boneyard figure each side wears. Presentation only: combat never reads it, and a figure is
 * swapped here without touching frame data. Every figure targets Boneyard's `fighter` rig.
 */
export const PLAYER_FIGURE = "fighter";

/** Every figure the game draws, so a build can serve each one. */
export const FIGURES: readonly string[] = Object.freeze([PLAYER_FIGURE, ...OPPONENT_FIGURES]);
