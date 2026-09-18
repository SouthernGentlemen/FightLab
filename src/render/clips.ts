import catalog from "boneyard/catalog/clips.json" with { type: "json" };
import type { Clip } from "boneyard";

export type ClipName = keyof typeof catalog.clips;

if (catalog.contract !== 1) throw new Error(`Boneyard's clip catalog is contract ${catalog.contract}; FightLab reads contract 1`);

/** Boneyard's catalog, bundled whole: clips are small and are data, not art. */
export const CLIPS = catalog.clips as unknown as Readonly<Record<ClipName, Clip>>;
const ORIGINS = catalog.origins as Readonly<Record<string, string | null>>;

export function clipNamed(name: string): Clip {
  const clip = (CLIPS as Readonly<Record<string, Clip>>)[name];
  if (!clip) throw new Error(`Boneyard's catalog has no clip '${name}'`);
  return clip;
}

/** What a clip was derived from, which decides its depth profile. A shipped clip is its own origin. */
export function clipOrigin(name: string): string | null {
  return name in ORIGINS ? ORIGINS[name] : name;
}
