import labGuard from "boneyard/motions/authored/labGuard.json" with { type: "json" };
import labIdle from "boneyard/motions/authored/labIdle.json" with { type: "json" };
import labOverhead from "boneyard/motions/authored/labOverhead.json" with { type: "json" };
import labStagger from "boneyard/motions/authored/labStagger.json" with { type: "json" };
import labStrike from "boneyard/motions/authored/labStrike.json" with { type: "json" };
import labWalk from "boneyard/motions/authored/labWalk.json" with { type: "json" };
import labWave from "boneyard/motions/authored/labWave.json" with { type: "json" };
import type { Clip } from "boneyard";

const AUTHORED = { labGuard, labIdle, labOverhead, labStagger, labStrike, labWalk, labWave };
export type ClipName = keyof typeof AUTHORED;

/** Only original Boneyard motions enter the public bundle. */
export const CLIPS = Object.fromEntries(Object.entries(AUTHORED).map(([name, authored]) => {
  if (authored.key !== name || authored.derivedFrom !== null) throw new Error(`'${name}' is not an original authored clip`);
  return [name, { name, loop: authored.loop, duration: authored.duration, easing: authored.easing, note: authored.note, poses: authored.poses }];
})) as unknown as Readonly<Record<ClipName, Clip>>;

export function clipNamed(name: string): Clip {
  const clip = (CLIPS as Readonly<Record<string, Clip>>)[name];
  if (!clip) throw new Error(`FightLab has no public clip '${name}'`);
  return clip;
}

/** Every shipped clip is original and has no capture origin. */
export function clipOrigin(name: string): string | null {
  clipNamed(name);
  return null;
}
