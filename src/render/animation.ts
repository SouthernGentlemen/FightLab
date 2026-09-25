import { currentMove } from "../combat/kernel/index.ts";
import type { FighterDefinition, FighterState } from "../combat/kernel/index.ts";
import type { ClipName } from "./clips.ts";

/**
 * The clip for every state that is not a move. A move names its own clip in its frame data.
 * Several of these are stand-ins; docs/RUN_PLAN.md lists the motion each one is missing.
 */
export const STATE_CLIPS = {
  idle: "labIdle",
  walk: "labWalk",
  hitstun: "labStagger",
  defeated: "labStagger",
  victory: "labWave",
} as const satisfies Record<string, ClipName>;

export interface ClipFrame {
  readonly clip: string;
  readonly frame: number;
}

export interface AnimationContext {
  /** While planning nothing is simulated, so the idle stance runs on the presentation clock. */
  readonly idleFrame: number | null;
  /** Once the match is over: ticks since it ended, and whether this fighter won. */
  readonly finish: { readonly ticks: number; readonly won: boolean } | null;
}

/**
 * Which clip, at which frame, presents a fighter. Combat state picks it; animation never feeds back.
 * A move is sampled at its own frame, so the clip is warped onto the move's ticks and never the
 * reverse. After the match ends the simulation stops, and the presentation clock carries the last
 * clip on.
 */
export function animationFor(fighter: FighterState, definition: FighterDefinition, context: AnimationContext): ClipFrame {
  if (context.finish?.won) return { clip: STATE_CLIPS.victory, frame: context.finish.ticks };
  const move = currentMove(fighter, definition);
  if (move !== null) return { clip: move.animation, frame: fighter.moveFrame };
  const after = context.finish?.ticks ?? 0;
  if (fighter.mode === "walk") return { clip: STATE_CLIPS.walk, frame: fighter.stateFrame };
  if (fighter.mode === "hitstun") return { clip: STATE_CLIPS.hitstun, frame: fighter.stateFrame };
  if (fighter.mode === "defeated") return { clip: STATE_CLIPS.defeated, frame: fighter.stateFrame + after };
  return { clip: STATE_CLIPS.idle, frame: context.idleFrame ?? fighter.stateFrame + after };
}
