import { h, icon, setText } from "./dom.ts";

export const HEART_COUNT = 5;

/**
 * How full each of a fighter's hearts is, 0 to 1. Health stays granular underneath; a heart is a
 * fifth of this fighter's maximum health, filled in proportion, so a +1 or +2 damage mod still moves
 * it visibly.
 */
export function heartFills(health: number, maxHealth: number, count = HEART_COUNT): number[] {
  const per = maxHealth / count;
  return Array.from({ length: count }, (_, index) => Math.min(1, Math.max(0, (health - index * per) / per)));
}

export interface HeartsMeter {
  readonly node: HTMLElement;
  update(health: number, maxHealth: number): void;
}

/** Five hearts with the exact number under them. `mirror` empties them from the left instead. */
export function heartsMeter(label: string, mirror = false): HeartsMeter {
  const fills = Array.from({ length: HEART_COUNT }, () => h("span", { class: "heart__fill" }, icon("heart")));
  const hearts = fills.map((fill) => h("span", { class: "heart" }, icon("heart", "icon heart__empty"), fill));
  const value = h("span", { class: "hearts__value stroke" });
  const row = h("span", { class: "hearts__row" }, ...(mirror ? [...hearts].reverse() : hearts));
  const node = h("div", { class: `hearts${mirror ? " hearts--mirror" : ""}`, role: "meter", "aria-label": `${label} health`, "aria-valuemin": "0" }, row, value);
  let shown = "";
  return {
    node,
    update(health, maxHealth) {
      const key = `${health}/${maxHealth}`;
      if (key === shown) return;
      shown = key;
      heartFills(health, maxHealth).forEach((fill, index) => {
        fills[index].style.width = `${(fill * 100).toFixed(1)}%`;
        hearts[index].classList.toggle("is-empty", fill === 0);
      });
      setText(value, `${health} / ${maxHealth}`);
      node.setAttribute("aria-valuenow", String(health));
      node.setAttribute("aria-valuemax", String(maxHealth));
    },
  };
}
