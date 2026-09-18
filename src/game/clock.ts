import { TICK_MS } from "../combat/kernel/index.ts";

export const SPEEDS = [1, 2, 4] as const;
export type BattleSpeed = (typeof SPEEDS)[number];

/** A frame longer than this is a stall — a background tab, a breakpoint — not time to catch up on. */
export const MAX_FRAME_MS = 250;

/**
 * Wall-clock time in, whole simulation ticks out.
 *
 * Speed multiplies elapsed time and so decides how many 60 Hz ticks a frame owes. It never
 * changes what a tick does, which is why a match ends identically at every speed.
 */
export class FixedClock {
  private carry = 0;

  advance(elapsedMs: number, speed: BattleSpeed): number {
    this.carry += Math.min(Math.max(elapsedMs, 0), MAX_FRAME_MS) * speed;
    const ticks = Math.floor(this.carry / TICK_MS);
    this.carry -= ticks * TICK_MS;
    return ticks;
  }

  reset(): void {
    this.carry = 0;
  }
}
