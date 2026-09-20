import "./armory-filter.css";

import { ACTION_TYPES } from "../battle/actions.ts";
import { NO_FILTER, toggle } from "../mods/armory.ts";
import type {
  CatalogAffinity,
  CatalogFilter,
  SizeClass,
} from "../mods/armory.ts";
import { RARITIES, RARITY } from "../mods/rarity.ts";
import { AFFINITY_LABEL, MOD_TYPES, TYPE_LABEL } from "../mods/types.ts";
import { button, h, icon } from "./dom.ts";

export interface ArmoryFilterModal {
  readonly node: HTMLElement;
  readonly open: boolean;
  show(returnFocus: HTMLElement): void;
  close(): void;
  refresh(filter: CatalogFilter): void;
  handleKey(event: KeyboardEvent): boolean;
}

interface FilterModalOptions {
  getFilter(): CatalogFilter;
  setFilter(filter: CatalogFilter): void;
}

function sizeFootprint(size: SizeClass): HTMLElement {
  return h("span", { class: "filter-chip__footprint", "aria-hidden": "true" },
    ...Array.from({ length: size }, () => h("i", {})));
}

export function armoryFilterModal(options: FilterModalOptions): ArmoryFilterModal {
  let returnFocus: HTMLElement | null = null;

  function chip<T extends string | number>(
    group: keyof CatalogFilter,
    value: T,
    label: string,
    content: readonly Node[],
  ): HTMLButtonElement {
    return button(
      h("span", { class: "filter-chip__content" }, ...content),
      "filter-chip",
      () => options.setFilter(toggle(options.getFilter(), group as never, value as never)),
      {
        "aria-label": label,
        "aria-pressed": "false",
        "data-group": group,
        "data-value": String(value),
      },
    );
  }

  const typeButtons = MOD_TYPES.map((value) =>
    chip("types", value, TYPE_LABEL[value], [h("span", { class: "filter-chip__swatch" }), h("b", {}, TYPE_LABEL[value])]));
  const affinities = ["none", ...ACTION_TYPES] as const satisfies readonly CatalogAffinity[];
  const actionButtons = affinities.map((value) =>
    chip("affinities", value, value === "none" ? "No action" : AFFINITY_LABEL[value],
      value === "none" ? [h("b", {}, "None")] : [icon(value), h("b", {}, AFFINITY_LABEL[value])]));
  const sizeButtons = ([4, 3, 2, 1] as const satisfies readonly SizeClass[]).map((value) =>
    chip("sizes", value, `${value}-cell`, [sizeFootprint(value), h("b", {}, `${value}-cell`)]));
  const rarityButtons = RARITIES.map((value) =>
    chip("rarities", value, RARITY[value].label,
      [h("span", { class: "filter-chip__rarity-dot" }), h("b", {}, RARITY[value].label)]));

  function group(label: string, buttons: readonly HTMLButtonElement[]): HTMLElement {
    return h("section", { class: "filter-modal__group", "aria-label": label },
      h("h3", {}, label.toUpperCase()),
      h("div", { class: "filter-modal__chips" }, ...buttons));
  }

  const closeButton = button("×", "filter-modal__close", () => close(), { "aria-label": "Close filters" });
  const clearButton = button("CLEAR", "filter-modal__clear", () => options.setFilter(NO_FILTER));
  const panel = h("section", {
    class: "filter-modal__panel",
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "filter-modal-title",
  },
  h("header", { class: "filter-modal__head" },
    h("h2", { id: "filter-modal-title" }, "FILTER"),
    closeButton),
  h("div", { class: "filter-modal__body" },
    group("Type", typeButtons),
    group("Action", actionButtons),
    group("Size", sizeButtons),
    group("Rarity", rarityButtons)),
  h("footer", { class: "filter-modal__foot" }, clearButton));

  const node = h("div", { class: "filter-modal", hidden: "" }, panel);

  function focusable(): HTMLButtonElement[] {
    return [...panel.querySelectorAll<HTMLButtonElement>("button:not([disabled])")];
  }

  function close(): void {
    if (node.hidden) return;
    node.hidden = true;
    returnFocus?.focus();
    returnFocus = null;
  }

  const modal: ArmoryFilterModal = {
    node,
    get open() {
      return !node.hidden;
    },
    show(nextReturnFocus) {
      returnFocus = nextReturnFocus;
      node.hidden = false;
      closeButton.focus();
    },
    close,
    refresh(filter) {
      for (const button of [...typeButtons, ...actionButtons, ...sizeButtons, ...rarityButtons]) {
        const group = button.dataset.group as keyof CatalogFilter;
        const raw = button.dataset.value!;
        const value = group === "sizes" ? Number(raw) : raw;
        button.setAttribute("aria-pressed", String((filter[group] as ReadonlySet<unknown>).has(value)));
      }
    },
    handleKey(event) {
      if (node.hidden) return false;
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return true;
      }
      if (event.key !== "Tab") return false;
      const items = focusable();
      if (items.length === 0) return true;
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.shiftKey
        ? (index <= 0 ? items.length - 1 : index - 1)
        : (index < 0 || index === items.length - 1 ? 0 : index + 1);
      event.preventDefault();
      items[next].focus();
      return true;
    },
  };
  return modal;
}
