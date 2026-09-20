import "./armory-catalog.css";

import { ACTION_TYPES } from "../battle/actions.ts";
import type { ActionType } from "../battle/actions.ts";
import { EVERYTHING, armoryList, collected } from "../mods/armory.ts";
import type { ArmoryFilter, Owned } from "../mods/armory.ts";
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
import { button, h, icon } from "./dom.ts";
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

/**
 * The Armory catalogue shell. tasks-025 owns navigation and layout; the existing detail card stays
 * until tasks-026, and the existing filter controls stay live until tasks-027/028 replace them.
 */
export function mountArmory(root: HTMLElement, options: ArmoryOptions): () => void {
  const owned: Owned = (mod) => options.collection.ownedCopies(mod);
  let filter: ArmoryFilter = EVERYTHING;
  let selected: ModId = MOD_IDS[0];
  const detail = armoryCard(owned);

  function segments<T extends string>(
    label: string,
    values: readonly T[],
    current: () => T,
    set: (value: T) => void,
    text: (value: T) => Array<Node | string>,
  ): Segments {
    const buttons = values.map((value) => button(h("span", {}, ...text(value)), "segment", () => {
      set(value);
      render();
    }, { "data-value": value }));
    return {
      node: h("div", { class: "segments armory__segments", role: "group", "aria-label": label }, ...buttons),
      refresh: () => buttons.forEach((node, index) =>
        node.setAttribute("aria-pressed", String(values[index] === current()))),
    };
  }

  const types = segments<ModType | "all">(
    "Type", ["all", ...MOD_TYPES], () => filter.type, (type) => { filter = { ...filter, type }; },
    (value) => (value === "all" ? ["All"] : [icon(tagIcon(value)), TYPE_LABEL[value]]),
  );
  const actions = segments<ActionType | "all">(
    "Action", ["all", ...ACTION_TYPES], () => filter.affinity, (affinity) => { filter = { ...filter, affinity }; },
    (value) => (value === "all" ? ["All"] : [icon(value), AFFINITY_LABEL[value]]),
  );
  const rarities = segments<Rarity | "all">(
    "Rarity", ["all", ...RARITIES], () => filter.rarity, (rarity) => { filter = { ...filter, rarity }; },
    (value) => (value === "all" ? ["All"] : [h("i", { class: "rarity-dot", "data-rarity": value }), RARITY[value].label]),
  );
  const ownedOnly = button("Owned only", "segment armory__owned", () => {
    filter = { ...filter, ownedOnly: !filter.ownedOnly };
    render();
  });
  const search = h("input", {
    class: "armory__search",
    type: "search",
    placeholder: "Search",
    "aria-label": "Search the Armory",
    spellcheck: "false",
  });
  search.addEventListener("input", () => {
    filter = { ...filter, text: search.value };
    render();
  });

  const grid = h("div", { class: "armory__grid" });
  const empty = h("p", { class: "armory__empty", hidden: "" }, "No mod matches these filters.");
  const footer = h("footer", { class: "armory__count" });
  const screen = h("main", { class: `screen armory teal${options.debug ? " armory--debug" : ""}` },
    h("header", { class: "armory__top" },
      h("div", { class: "armory__top-left", "aria-label": "Catalogue controls" },
        h("span", { class: "armory__top-control", "data-control": "filter" }, "FILTER: NONE"),
        h("span", { class: "armory__top-control", "data-control": "clear" }, "CLEAR")),
      h("h1", { class: "armory__title" }, "MOD CATALOG"),
      button("×", "armory__close", options.back, { "aria-label": "Close catalogue" })),
    detail.node,
    h("section", { class: "armory__browser", "aria-label": "Catalogue" },
      h("div", { class: "armory__filters" }, types.node, actions.node),
      h("div", { class: "armory__filters" }, rarities.node, ownedOnly, search),
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
    for (const group of [types, actions, rarities]) group.refresh();
    ownedOnly.setAttribute("aria-pressed", String(filter.ownedOnly));
    const listed = armoryList(filter, owned);
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
    const active = document.activeElement;
    const activeIndex = active instanceof HTMLButtonElement ? visible.indexOf(active) : -1;
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
    if (document.activeElement instanceof HTMLInputElement) return;

    const movement: Readonly<Record<string, number>> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -4,
      ArrowDown: 4,
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
