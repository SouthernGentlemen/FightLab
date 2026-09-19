import { ACTION_TYPES } from "../battle/actions.ts";
import type { ActionType } from "../battle/actions.ts";
import { EVERYTHING, armoryList, collected } from "../mods/armory.ts";
import type { ArmoryFilter, Owned } from "../mods/armory.ts";
import { RARITIES, RARITY } from "../mods/rarity.ts";
import type { Rarity } from "../mods/rarity.ts";
import { MOD_IDS } from "../mods/registry.ts";
import type { ModId } from "../mods/registry.ts";
import { bestStars, copiesIn } from "../mods/stars.ts";
import { AFFINITY_LABEL, MOD_TYPES, TYPE_LABEL } from "../mods/tags.ts";
import type { ModType } from "../mods/tags.ts";
import type { CollectionRepository } from "../run/collection.ts";
import { armoryCard } from "./armorycard.ts";
import { button, h, icon } from "./dom.ts";
import { iconButton, tagIcon } from "./kit.ts";
import { modTile } from "./modtile.ts";
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

/**
 * The Armory: the whole mod catalogue on one screen. The card on the left says everything about the
 * selected mod; the filters, the tiles and the collection count sit on the right, Batomon's
 * collection screen box for box. It reads the same registry a fight runs on.
 */
export function mountArmory(root: HTMLElement, options: ArmoryOptions): () => void {
  const owned: Owned = (mod) => options.collection.ownedCopies(mod);
  let filter: ArmoryFilter = EVERYTHING;
  let selected: ModId = MOD_IDS[0];
  const card = armoryCard(owned);

  function segments<T extends string>(label: string, values: readonly T[], current: () => T, set: (value: T) => void, text: (value: T) => Array<Node | string>): Segments {
    const buttons = values.map((value) => button(h("span", {}, ...text(value)), "segment", () => {
      set(value);
      render();
    }, { "data-value": value }));
    return {
      node: h("div", { class: "segments armory__segments", role: "group", "aria-label": label }, ...buttons),
      refresh: () => buttons.forEach((node, index) => node.setAttribute("aria-pressed", String(values[index] === current()))),
    };
  }

  const types = segments<ModType | "all">("Type", ["all", ...MOD_TYPES], () => filter.type, (type) => { filter = { ...filter, type }; },
    (value) => (value === "all" ? ["All"] : [icon(tagIcon(value)), TYPE_LABEL[value]]));
  const actions = segments<ActionType | "all">("Action", ["all", ...ACTION_TYPES], () => filter.affinity, (affinity) => { filter = { ...filter, affinity }; },
    (value) => (value === "all" ? ["All"] : [icon(value), AFFINITY_LABEL[value]]));
  const rarities = segments<Rarity | "all">("Rarity", ["all", ...RARITIES], () => filter.rarity, (rarity) => { filter = { ...filter, rarity }; },
    (value) => (value === "all" ? ["All"] : [h("i", { class: "rarity-dot", "data-rarity": value }), RARITY[value].label]));
  const ownedOnly = button("Owned only", "segment armory__owned", () => {
    filter = { ...filter, ownedOnly: !filter.ownedOnly };
    render();
  });
  const search = h("input", { class: "armory__search", type: "search", placeholder: "Search", "aria-label": "Search the Armory", spellcheck: "false" });
  search.addEventListener("input", () => {
    filter = { ...filter, text: search.value };
    render();
  });

  const grid = h("div", { class: "armory__grid" });
  const empty = h("p", { class: "armory__empty", hidden: "" }, "No mod matches these filters.");
  const count = h("footer", { class: "armory__count" });
  const screen = h("main", { class: `screen armory teal${options.debug ? " armory--debug" : ""}` },
    h("header", { class: "armory__top" }, h("h1", { class: "armory__title stroke" }, "Armory"), iconButton("exit", "Back to the title", options.back, "rose")),
    card.node,
    h("section", { class: "armory__browser", "aria-label": "Catalogue" },
      h("div", { class: "armory__filters" }, types.node, actions.node),
      h("div", { class: "armory__filters" }, rarities.node, ownedOnly, search),
      h("div", { class: "armory__scroll" }, grid, empty),
      count),
    ...(options.debug ? [paletteDebugSheet()] : []));
  root.replaceChildren(screen);

  function select(mod: ModId): void {
    selected = mod;
    for (const tile of grid.children) tile.setAttribute("aria-pressed", String((tile as HTMLElement).dataset.mod === mod));
    card.show(mod);
  }

  function render(): void {
    for (const group of [types, actions, rarities]) group.refresh();
    ownedOnly.setAttribute("aria-pressed", String(filter.ownedOnly));
    const listed = armoryList(filter, owned);
    grid.replaceChildren(...listed.map((definition) => {
      const id = definition.id as ModId;
      const tile = modTile(definition, bestStars(owned(id)), owned(id));
      tile.addEventListener("click", () => select(id));
      return tile;
    }));
    empty.hidden = listed.length > 0;
    select(selected);
    const { owned: have, total } = collected(owned);
    const ready = (copies: number) => MOD_IDS.filter((id) => owned(id) >= copies).length;
    count.replaceChildren(
      h("span", { class: "pill armory__pill stroke" }, `${have} / ${total}`), h("span", {}, "collected"),
      h("span", { class: "armory__ready" }, `★★ ready: ${ready(copiesIn(2))}`), h("span", { class: "armory__ready" }, `★★★ ready: ${ready(copiesIn(3))}`),
      h("small", {}, `Showing ${listed.length}`));
  }

  const onKey = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    if (document.activeElement === search && search.value !== "") return;
    event.preventDefault();
    options.back();
  };
  window.addEventListener("keydown", onKey);
  render();
  (grid.firstElementChild as HTMLElement | null)?.focus();
  return () => {
    window.removeEventListener("keydown", onKey);
    root.replaceChildren();
  };
}
