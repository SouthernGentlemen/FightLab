/**
 * A roster figure, assembled by Boneyard, in the shape the browser draws from.
 *
 * Boneyard's own loader validates the manifest, the rig, every part and every cosmetic fit, and
 * its own assembly decides which markup belongs on which bone in which depth slot — the same two
 * calls its contact sheets make. This file only serialises that answer, so the browser never
 * re-implements the loading rules and nothing about a figure is decided twice. Node only: the
 * Vite plugin serves the result in development and emits it into a build.
 */

import { BONEYARD_ROOT } from "boneyard/paths";
import { assembleFigureBones, loadFigure } from "boneyard/render/sheet";

import type { FighterArt } from "../src/render/figure.ts";

const FIGURE_ID = /^[a-z][a-z0-9-]*$/;

export function fighterArt(id: string): FighterArt {
  // loadFigure also accepts paths; the server only ever hands it an id.
  if (!FIGURE_ID.test(id)) throw new Error(`'${id}' is not a figure id`);
  const figure = loadFigure(BONEYARD_ROOT, id);
  const bones = Object.fromEntries([...assembleFigureBones(figure)].map(([bone, assembled]) =>
    [bone, Object.fromEntries(assembled.layers)]));
  return { contract: 1, figure: figure.id, name: figure.manifest.name, rig: figure.rig.contract, bones };
}

export function fighterArtJson(id: string): string {
  return `${JSON.stringify(fighterArt(id))}\n`;
}
