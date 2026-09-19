import { ACTION_TYPES } from "../battle/actions.ts";
import { RARITIES, RARITY } from "../mods/rarity.ts";
import type { ShapeId } from "../mods/shapes.ts";
import { MOD_TYPES, TYPE_LABEL } from "../mods/tags.ts";
import { AFFINITY_LABEL } from "../mods/tags.ts";
import { h } from "./dom.ts";
import { modArt } from "./kit.ts";
import type { ModArtDefinition } from "./kit.ts";

const AFFINITIES = [null, ...ACTION_TYPES] as const;
const DEBUG_SHAPES: readonly ShapeId[] = ["single", "domino", "triomino-l", "tetromino-o"];

function definition(type: (typeof MOD_TYPES)[number], affinity: (typeof AFFINITIES)[number], shape: ShapeId): ModArtDefinition {
  return { type, affinity, shape };
}

function sample(view: ModArtDefinition, size: "card" | "board"): HTMLElement {
  return h("div", { class: `palette-sheet__sample palette-sheet__sample--${size}` },
    h("small", {}, size),
    modArt(view, 0, size === "card" ? "mod--mini" : ""));
}

/** Debug-only visual proof for the semantic palette and the real piece renderer. */
export function paletteDebugSheet(): HTMLElement {
  const pairs = MOD_TYPES.flatMap((type, typeIndex) =>
    AFFINITIES.map((affinity, affinityIndex) => {
      const shape = DEBUG_SHAPES[(typeIndex + affinityIndex) % DEBUG_SHAPES.length];
      const view = definition(type, affinity, shape);
      const action = affinity === null ? "None" : AFFINITY_LABEL[affinity];
      return h("article", {
        class: "palette-sheet__pair",
        "data-type": type,
        "data-affinity": affinity ?? "none",
      },
      h("b", { class: "palette-sheet__label" }, TYPE_LABEL[type], h("small", {}, action)),
      sample(view, "card"),
      sample(view, "board"));
    }),
  );

  const rarities = RARITIES.map((rarity) =>
    h("span", { class: "palette-sheet__rarity", "data-rarity": rarity }, RARITY[rarity].label));

  return h("section", { class: "palette-sheet", "aria-label": "Debug palette swatch sheet" },
    h("header", { class: "palette-sheet__head" },
      h("h2", {}, "Palette sheet"),
      h("p", {}, "16 type × affinity pieces · production modArt · card / board")),
    h("div", { class: "palette-sheet__grid" }, ...pairs),
    h("footer", { class: "palette-sheet__rarities" }, ...rarities));
}
