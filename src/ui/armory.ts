import "./armory-catalog.css";

import { ACTION_TYPES } from "../battle/actions.ts";
import { NO_FILTER, armoryList, collected, filterSummary, toggle } from "../mods/armory.ts";
import type {
  CatalogAffinity,
  CatalogFilter,
  Owned,
  SizeClass,
} from "../mods/armory.ts";
import { RARITIES, RARITY } from "../mods/rarity.ts";
import type { Rarity } from "../mods/rarity.ts";
import { MOD_IDS } from "../mods/registry.ts";
import type { ModId } from "../mods/registry.ts";
import { copiesIn } from "../mods/stars.ts";
import { AFFINITY_LABEL, MOD_TYPES, TYPE_LABEL } from "../mods/tags.ts";
import type { ModType } from "../mods/tags.ts";
import type { CollectionRepository } from "../run/collection.ts";
import { armoryCard } from "./armorycard.ts";
import { catalogCard } from "./catalogcard.ts";
import { catalogCardView } from "./catalogcardview.ts";
import { button, h, icon, setText } from "./dom.ts";
import { tagIcon } from "./kit.ts";
import { paletteDebugSheet } from "./palette-debug.ts";

export interface ArmoryOptions {
  readonly collection: CollectionRepository;
  readonly debug?: boolean;
  back(): void;
}

interface Segments {
  readonly node: HTMLElement;
  refresh(): void;
}

function counter(label: string, value: number, total: number): HTMLElement {
  return h("span", { class: "armory__counter" },
    h("small", {}, label),
    h("b", {}, `${value} / ${total}`));
}

/** Catalogue shell; tasks-028 replaces the temporary inline filter controls with the modal. */
export function mountArmory(root: HTMLElement, options: ArmoryOptions): () => void {
  const owned: Owned = (mod) => options.collection.ownedCopies(mod);
  let filter: CatalogFilter = NO_FILTER;
  let selected: ModId = MOD_IDS[0];
  const detail = armoryCard(owned);

  function segments<T extends string | number>(
    label: string,
    values: readonly T[],
    selectedValues: () => ReadonlySet<T>,
    choose: (value: T | null) => void,
    text: (value: T) => Array<Node | string>,
  ): Segments {
    const all = button("All", "segment", () => {
      choose(null);
      render();
    }, { "data-value": "all" });
    const buttons = values.map((value) => button(h("span", {}, ...text(value)), "segment", () => {
      choose(value);
      render();
    }, { "data-value": String(value) }));
    return {
      node: h("div", { class: "segments armory__segments", role: "group", "aria-label": label }, all, ...buttons),
      refresh: () => {
        const selected = selectedValues();
        all.setAttribute("aria-pressed", String(selected.size === 0));
        buttons.forEach((node, index) =>
          node.setAttribute("aria-pressed", String(selected.has(values[index]))));
      },
    };
  }

  const types = segments<ModType>(
    "Type",
    MOD_TYPES,
    () => filter.types,
    (value) => {
      filter = value === null ? { ...filter, types: new Set() } : toggle(filter, "types", value);
    },
    (value) => [icon(tagIcon(value)), TYPE_LABEL[value]],
  );
  const affinities = ["none", ...ACTION_TYPES] as const satisfies readonly CatalogAffinity[];
  const actions = segments<CatalogAffinity>(
    "Action",
    affinities,
    () => filter.affinities,
    (value) => {
      filter = value === null ? { ...filter, affinities: new Set() } : toggle(filter, "affinities", value);
    },
    (value) => value === "none" ? ["None"] : [icon(value), AFFINITY_LABEL[value]],
  );
  const rarities = segments<Rarity>(
    "Rarity",
    RARITIES,
    () => filter.rarities,
    (value) => {
      filter = value === null ? { ...filter, rarities: new Set() } : toggle(filter, "rarities", value);
    },
    (value) => [h("i", { class: "rarity-dot", "data-rarity": value }), RARITY[value].label],
  );
  const sizes = segments<SizeClass>(
    "Size",
    [1, 2, 3, 4],
    () => filter.sizes,
    (value) => {
      filter = value === null ? { ...filter, sizes: new Set() } : toggle(filter, "sizes", value);
    },
    (value) => [`${value} cell${value === 1 ? "" : "s"}`],
  );

  const filterReadout = h("span", { class: "armory__top-control", "data-control": "filter" }, "FILTER: NONE");
  const grid = h("div", { class: "armory__grid" });
  const empty = h("p", { class: "armory__empty", hidden: "" }, "No mod matches these filters.");
  const footer = h("footer", { class: "armory__count" });
  const screen = h("main", { class: `screen armory teal${options.debug ? " armory--debug" : ""}` },
    h("header", { class: "armory__top" },
      h("div", { class: "armory__top-left", "aria-label": "Catalogue controls" },
        filterReadout,
        h("span", { class: "armory__top-control", "data-control": "clear" }, "CLEAR")),
      h("h1", { class: "armory__title" }, "MOD CATALOG"),
      button("×", "armory__close", options.back, { "aria-label": "Close catalogue" })),
    detail.node,
    h("section", { class: "armory__browser", "aria-label": "Catalogue" },
      h("div", { class: "armory__filters" }, types.node, actions.node),
      h("div", { class: "armory__filters" }, rarities.node, sizes.node),
      h("div", { class: "armory__scroll" }, grid, empty),
      footer),
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
    for (const group of [types, actions, rarities, sizes]) group.refresh();
    setText(filterReadout, `FILTER: ${filterSummary(filter)}`);
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
