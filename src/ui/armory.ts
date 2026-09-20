import "./armory-catalog.css";

import { NO_FILTER, armoryList, collected, filterSummary } from "../mods/armory.ts";
import type { CatalogFilter, Owned } from "../mods/armory.ts";
import { MOD_IDS } from "../mods/registry.ts";
import type { ModId } from "../mods/registry.ts";
import { copiesIn } from "../mods/stars.ts";
import type { CollectionRepository } from "../run/collection.ts";
import { armoryCard } from "./armorycard.ts";
import { catalogCard } from "./catalogcard.ts";
import { catalogCardView } from "./catalogcardview.ts";
import { button, h, setText } from "./dom.ts";
import { armoryFilterModal } from "./armoryfilter.ts";
import { paletteDebugSheet } from "./palette-debug.ts";

export interface ArmoryOptions {
  readonly collection: CollectionRepository;
  readonly debug?: boolean;
  back(): void;
}

function counter(label: string, value: number, total: number): HTMLElement {
  return h("span", { class: "armory__counter" },
    h("small", {}, label),
    h("b", {}, `${value} / ${total}`));
}

export function mountArmory(root: HTMLElement, options: ArmoryOptions): () => void {
  const owned: Owned = (mod) => options.collection.ownedCopies(mod);
  let filter: CatalogFilter = NO_FILTER;
  let selected: ModId = MOD_IDS[0];
  const detail = armoryCard(owned);

  const grid = h("div", { class: "armory__grid" });
  const empty = h("p", { class: "armory__empty", hidden: "" }, "No mod matches these filters.");
  const footer = h("footer", { class: "armory__count" });

  const filterModal = armoryFilterModal({
    getFilter: () => filter,
    setFilter(next) {
      filter = next;
      render();
    },
  });

  const filterButton = button("FILTER: NONE", "armory__top-control", () => {
    filterModal.show(filterButton);
    filterButton.setAttribute("aria-expanded", "true");
  }, {
    "data-control": "filter",
    "aria-haspopup": "dialog",
    "aria-expanded": "false",
  });
  const clearButton = button("CLEAR", "armory__top-control", () => {
    filter = NO_FILTER;
    render();
  }, { "data-control": "clear" });

  const screen = h("main", { class: `screen armory teal${options.debug ? " armory--debug" : ""}` },
    h("header", { class: "armory__top" },
      h("div", { class: "armory__top-left", "aria-label": "Catalogue controls" },
        filterButton,
        clearButton),
      h("h1", { class: "armory__title" }, "MOD CATALOG"),
      button("×", "armory__close", options.back, { "aria-label": "Close catalogue" })),
    detail.node,
    h("section", { class: "armory__browser", "aria-label": "Catalogue" },
      h("div", { class: "armory__scroll" }, grid, empty),
      footer),
    filterModal.node,
    ...(options.debug ? [paletteDebugSheet()] : []));
  root.replaceChildren(screen);

  function cards(): HTMLButtonElement[] {
    return [...grid.querySelectorAll<HTMLButtonElement>(".catalog-card")];
  }

  function select(mod: ModId): void {
    selected = mod;
    for (const node of cards()) node.setAttribute("aria-pressed", String(node.dataset.mod === mod));
    detail.show(mod);
  }

  function render(): void {
    filterModal.refresh(filter);
    setText(filterButton, `FILTER: ${filterSummary(filter)}`);
    const listed = armoryList(filter);
    grid.replaceChildren(...listed.map((definition) => {
      const id = definition.id as ModId;
      const node = catalogCardView(catalogCard(definition, owned(id)));
      node.addEventListener("click", () => select(id));
      return node;
    }));
    empty.hidden = listed.length > 0;
    select(selected);

    const { owned: have, total } = collected(owned);
    const ready = (copies: number) => MOD_IDS.filter((id) => owned(id) >= copies).length;
    footer.replaceChildren(
      counter("Owned", have, total),
      counter("★★ ready", ready(copiesIn(2)), total),
      counter("★★★ ready", ready(copiesIn(3)), total),
      h("small", { class: "armory__showing" }, `Showing ${listed.length}`),
    );
  }

  function moveFocus(offset: number): void {
    const visible = cards();
    if (visible.length === 0) return;
    const activeIndex = document.activeElement instanceof HTMLButtonElement
      ? visible.indexOf(document.activeElement)
      : -1;
    const selectedIndex = visible.findIndex((node) => node.dataset.mod === selected);
    const origin = activeIndex >= 0 ? activeIndex : Math.max(selectedIndex, 0);
    const next = Math.min(visible.length - 1, Math.max(0, origin + offset));
    visible[next].focus();
    visible[next].scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  const onKey = (event: KeyboardEvent): void => {
    if (filterModal.open) {
      if (filterModal.handleKey(event) && !filterModal.open) {
        filterButton.setAttribute("aria-expanded", "false");
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      options.back();
      return;
    }

    const movement: Readonly<Record<string, number>> = {
      ArrowLeft: -1, ArrowRight: 1, ArrowUp: -4, ArrowDown: 4,
    };
    const offset = movement[event.key];
    if (offset !== undefined) {
      event.preventDefault();
      moveFocus(offset);
      return;
    }
    if (event.key === "Enter" && document.activeElement instanceof HTMLButtonElement) {
      const mod = document.activeElement.dataset.mod as ModId | undefined;
      if (mod !== undefined) {
        event.preventDefault();
        select(mod);
      }
    }
  };

  window.addEventListener("keydown", onKey);
  render();
  cards()[0]?.focus();

  return () => {
    window.removeEventListener("keydown", onKey);
    root.replaceChildren();
  };
}
