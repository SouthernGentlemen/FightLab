import { h } from "./dom.ts";
import type { EffectBadge } from "./modvisual.ts";

/** Text stays in the DOM and can wrap independently of the polyomino's footprint. */
export function effectBadgeRow(badges: readonly EffectBadge[], className = ""): HTMLSpanElement {
  return h("span", { class: `mod-badges ${className}`.trim() },
    ...badges.map(({ kind, text }) => h("span", { class: "mod-badge", "data-effect": kind }, text)));
}
