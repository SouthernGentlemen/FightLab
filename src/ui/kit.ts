import { DEFAULT_ACTIONS } from "../battle/actions.ts";
import type { ActionType } from "../battle/actions.ts";
import type { BarId } from "../battle/bars.ts";
import { STYLE_RANKS } from "../battle/style.ts";
import type { StyleMeter } from "../battle/style.ts";
import { REGISTRY } from "../mods/registry.ts";
import type { ModDefinition, ModId } from "../mods/registry.ts";
import { shapeCells, shapeSize } from "../mods/shapes.ts";
import type { Rotation } from "../mods/shapes.ts";
import { starText } from "../mods/stars.ts";
import type { Stars } from "../mods/stars.ts";
import { iconAnchorCell } from "./catalogcard.ts";
import { button, h, icon, replay, setData, setText } from "./dom.ts";
import type { IconName } from "./icons.ts";

export const ACTION_LABEL: Readonly<Record<ActionType, string>> = {
  strike: DEFAULT_ACTIONS.strike.label,
  tech: DEFAULT_ACTIONS.tech.label,
  block: DEFAULT_ACTIONS.block.label,
};

export const BAR_NAME: Readonly<Record<BarId, string>> = { primary: "Bar A", secondary: "Bar B" };

/** `★★`: the upgrade level, independent of rarity. */
export function starRow(stars: Stars, className = "stars"): HTMLElement {
  return h("span", { class: className, role: "img", "aria-label": `${stars} star${stars === 1 ? "" : "s"}` }, starText(stars));
}

/**
 * A mod drawn as solid type-coloured blocks with at most one action-affinity icon on the occupied
 * cell nearest its centroid. Stars sit at the piece corner. The same markup draws full size on the
 * grid and in miniature in the bank and shop.
 */
export type ModArtDefinition = Pick<ModDefinition, "type" | "affinity" | "shape">;

export function modArt(mod: ModId | ModArtDefinition, rotation: Rotation, className = "", stars: Stars = 1): HTMLElement {
  const definition = typeof mod === "string" ? REGISTRY[mod] : mod;
  const cells = shapeCells(definition.shape, rotation);
  const [width, height] = shapeSize(cells);
  const iconCell = iconAnchorCell(cells);
  const node = h("div", {
    class: `mod ${className}`.trim(),
    "data-type": definition.type,
    "data-affinity": definition.affinity ?? undefined,
    "data-stars": String(stars),
    style: `width: calc(var(--cell) * ${width}); height: calc(var(--cell) * ${height})`,
  });
  cells.forEach(({ x, y }, index) => {
    const cell = h("span", { class: "mod__cell", "data-index": String(index), style: `left: calc(var(--cell) * ${x}); top: calc(var(--cell) * ${y})` });
    if (x === iconCell.x && y === iconCell.y && definition.affinity !== null) {
      cell.append(h("span", { class: "mod__action", "data-action": definition.affinity }, icon(definition.affinity)));
    }
    node.append(cell);
  });
  node.append(starRow(stars, "stars mod__stars"));
  return node;
}

/** An action, as a coloured chip with its glyph. `null` is an action not yet revealed. */
export function actionChip(action: ActionType | null, className = "chip"): HTMLSpanElement {
  const node = h("span", { class: className });
  paintChip(node, action);
  return node;
}

export function paintChip(node: HTMLElement, action: ActionType | null): void {
  const key = action ?? "hidden";
  if (node.dataset.action === key) return;
  node.dataset.action = key;
  node.replaceChildren(...(action === null ? [h("b", {}, "?")] : [icon(action), h("b", {}, ACTION_LABEL[action])]));
  node.setAttribute("aria-label", action === null ? "Not revealed" : ACTION_LABEL[action]);
}

/** A bevelled button in one of the kit's colours. Outlined white type on colour; ink on paper. */
export function bevel(label: string, color: string, onClick: () => void, className = ""): HTMLButtonElement {
  const node = button(h("span", { class: color === "paper" ? "" : "stroke" }, label), `btn ${className}`.trim(), onClick);
  node.style.setProperty("--c", `var(--${color})`);
  return node;
}

export function iconButton(name: IconName, label: string, onClick: () => void, color = "paper"): HTMLButtonElement {
  const node = button(icon(name), "btn btn--icon", onClick, { "aria-label": label, title: label });
  node.style.setProperty("--c", `var(--${color})`);
  return node;
}

/** A paper panel under a coloured header band. */
export function panel(title: string, color: string, extra: readonly Node[], ...body: readonly Node[]): HTMLElement {
  const head = h("div", { class: "panel__head" }, h("span", { class: "panel__title" }, title), ...extra);
  head.style.setProperty("--c", `var(--${color})`);
  return h("section", { class: "panel", "aria-label": title }, head, h("div", { class: "panel__body" }, ...body));
}

export interface StyleView {
  readonly node: HTMLElement;
  update(meter: StyleMeter): void;
}

/**
 * The style meter: a big outlined rank letter, a four-step ladder and the chain under it. A combo
 * stamps the new letter in; being hurt cracks it down.
 */
export function styleMeter(side: "player" | "opponent"): StyleView {
  const rank = h("span", { class: "stylemeter__rank" });
  const rungs = STYLE_RANKS.map(() => h("i", { class: "rung" }));
  const chain = h("span", { class: "stylemeter__chain stroke" });
  const node = h("div", { class: `stylemeter stylemeter--${side}`, "aria-label": `${side === "player" ? "Your" : "Their"} style` },
    h("span", { class: "stylemeter__label stroke" }, "Style"), rank, h("span", { class: "stylemeter__ladder" }, ...rungs), chain);
  let shown = -1;
  return {
    node,
    update(meter) {
      if (meter.rank !== shown) {
        if (shown >= 0) replay(node, meter.rank > shown ? "is-up" : "is-down");
        shown = meter.rank;
        setText(rank, STYLE_RANKS[meter.rank]);
        setData(node, "rank", STYLE_RANKS[meter.rank]);
        rungs.forEach((rung, index) => rung.classList.toggle("is-on", index <= meter.rank));
      }
      setText(chain, meter.chain >= 2 ? `Combo ×${meter.chain}` : "");
    },
  };
}

/** A short-lived message over the screen. */
export function toaster(host: HTMLElement): (text: string) => void {
  const node = h("div", { class: "toast", role: "status", hidden: "" });
  host.append(node);
  let timer = 0;
  return (text) => {
    setText(node, text);
    node.hidden = false;
    replay(node, "is-in");
    clearTimeout(timer);
    timer = window.setTimeout(() => { node.hidden = true; }, 1600);
  };
}

export function shake(node: Element): void {
  if (node instanceof HTMLElement) replay(node, "is-shake");
}
