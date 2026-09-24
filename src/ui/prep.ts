import { ACTION_TYPES } from "../battle/actions.ts";
import type { ActionType } from "../battle/actions.ts";
import { BAR_IDS, BAR_LENGTH } from "../battle/bars.ts";
import type { BarId, SlotIndex } from "../battle/bars.ts";
import { combatSide, hitDamage } from "../game/sides.ts";
import { BANK_SIZE, BOARD_HEIGHT, BOARD_WIDTH, canPlace, cellsOf, firstFit, turnAbout } from "../mods/grid.ts";
import { RARITIES, RARITY } from "../mods/rarity.ts";
import { REGISTRY, priceOf } from "../mods/registry.ts";
import type { ModId } from "../mods/registry.ts";
import { shapeCells, shapeSize } from "../mods/shapes.ts";
import type { GridPoint, Rotation } from "../mods/shapes.ts";
import { effectLines } from "../mods/describe.ts";
import { starText } from "../mods/stars.ts";
import type { Stars } from "../mods/stars.ts";
import { sellValue } from "../run/economy.ts";
import { buildOf, buy, move, rerollPrice, reroll, rotate, sell, setAction, toggleLock } from "../run/run.ts";
import type { Destination, Refusal, RunState, Source } from "../run/run.ts";
import type { Placement } from "../mods/grid.ts";
import { RARITY_ODDS, SHOP_SIZE, shopRank } from "../run/shop.ts";
import { button, h, icon, setText } from "./dom.ts";
import { modLabel } from "./modlabel.ts";
import { effectBadgeRow } from "./modbadgeview.ts";
import { effectBadges } from "./modvisual.ts";
import { ACTION_LABEL, BAR_NAME, actionChip, bevel, iconButton, modArt, paintChip, panel, shake, starRow, toaster } from "./kit.ts";

export interface PrepOptions {
  readonly run: RunState;
  /** Called after every change to the run, so it can be saved. */
  changed(): void;
  fight(): void;
  settings(): void;
  leave(): void;
}

const REFUSALS: Readonly<Record<Refusal, string>> = {
  "wrong-phase": "Not now",
  "sold-out": "Sold out",
  "cannot-afford": "Not enough money",
  "no-room": "The bank is full",
  "blocked": "It doesn't fit there",
  "missing": "Nothing there",
};

/** A mod in hand: an offer not yet bought, a banked mod, or a piece on the grid. */
type Held = { readonly kind: "offer"; readonly offer: number } | { readonly kind: "bank"; readonly slot: number } | { readonly kind: "piece"; readonly uid: number };

type Target =
  | { readonly kind: "grid"; readonly x: number; readonly y: number; readonly legal: boolean }
  | { readonly kind: "bank"; readonly slot: number; readonly legal: boolean }
  | { readonly kind: "sell" };

interface Drag {
  readonly held: Held;
  readonly mod: ModId;
  placement: Placement;
  /** The occupied board cell held under the pointer. */
  pivot: GridPoint;
  readonly startX: number;
  readonly startY: number;
  x: number;
  y: number;
  moved: boolean;
  ghost: HTMLElement | null;
  target: Target | null;
  readonly origin: HTMLElement;
}

/** A mod picked up without dragging, moved with the keyboard or by tapping where it should go. */
interface Carry {
  readonly held: Held;
  readonly mod: ModId;
  rotation: Rotation;
  x: number;
  y: number;
  /** The occupied board cell the carry turns around. */
  pivot: GridPoint;
}

/**
 * The shop, box for box in Batomon's proportions: bank and grid in the centre, the two action bars
 * in the negative space on the right, and nothing at all about the next opponent.
 */
export function mountPrep(root: HTMLElement, options: PrepOptions): () => void {
  const { run } = options;
  let drag: Drag | null = null;
  let carry: Carry | null = null;
  let picking: { bar: BarId; slot: SlotIndex } | null = null;

  // The top bar.
  const hearts = h("b", { class: "stat__value stroke" });
  const day = h("div", { class: "topbar__day stroke" });
  const trophies = h("b", { class: "stat__value stroke" });
  const topbar = h("header", { class: "topbar" },
    h("div", { class: "topbar__center" },
      h("span", { class: "stat", title: "Hearts: a defeat costs one" }, icon("heart"), hearts), day,
      h("span", { class: "stat", title: "Trophies: ten win the run" }, icon("trophy"), trophies)),
    h("div", { class: "topbar__right" }, iconButton("gear", "Settings", options.settings), iconButton("exit", "Leave the run", options.leave, "rose")));

  // The bank.
  const bankSlots = Array.from({ length: BANK_SIZE }, (_, slot) => h("div", { class: "slot", "data-bank": String(slot), tabindex: "0", role: "button" }));
  const bank = panel("Bank", "sun", [h("small", {}, "any mod, one slot")], h("div", { class: "bank" }, ...bankSlots));
  bank.classList.add("prep__bank");

  // The mod grid.
  const cells = Array.from({ length: BOARD_WIDTH * BOARD_HEIGHT }, (_, index) =>
    h("div", { class: "cell", "data-x": String(index % BOARD_WIDTH), "data-y": String(Math.floor(index / BOARD_WIDTH)) }));
  const pieces = h("div", { class: "pieces" });
  const carried = h("div", { class: "carried", hidden: "" });
  const gridBox = h("div", { class: "grid", style: `--board-w:${BOARD_WIDTH};--board-h:${BOARD_HEIGHT}` }, ...cells, pieces, carried);
  const mods = panel("Mods", "rose", [], h("div", { class: "board" }, gridBox));
  mods.classList.add("prep__mods");

  // The two action bars, in the negative space on the right.
  const barSlots = BAR_IDS.map((bar) => Array.from({ length: BAR_LENGTH }, (_, slot) => {
    const chip = actionChip(null, "barslot__chip");
    const damage = h("b", { class: "barslot__damage stroke" });
    const node = h("button", { type: "button", class: "barslot", "data-bar": bar, "data-slot": String(slot), "aria-haspopup": "menu" },
      h("span", { class: "barslot__index" }, String(slot + 1)), chip, damage);
    node.addEventListener("click", () => openPicker(bar, slot as SlotIndex, node));
    return { node, chip, damage };
  }));
  const stats = h("p", { class: "bars__stats" });
  const bars = panel("Action bars", "sky", [],
    ...BAR_IDS.flatMap((bar, index) => [
      h("p", { class: "bars__name" }, h("b", {}, BAR_NAME[bar]), h("small", {}, index === 0 ? "opens every fight" : "Mixup between rounds")),
      h("div", { class: "bars__row" }, ...barSlots[index].map(({ node }) => node)),
    ]),
    stats);
  bars.classList.add("prep__bars");

  // The shop strip.
  const odds = h("div", { class: "odds" });
  const money = h("div", { class: "pill money stroke prep__money" });
  const lock = bevel("Lock", "sun", () => apply(toggleLock(run)), "btn--sm prep__lock");
  const rerollLabel = h("span", { class: "stroke" });
  const rerollButton = button(rerollLabel, "btn prep__reroll", () => apply(reroll(run)));
  rerollButton.style.setProperty("--c", "var(--tangerine)");
  rerollButton.prepend(icon("dice"));
  const offers = Array.from({ length: SHOP_SIZE }, (_, offer) => h("div", { class: "offer", "data-offer": String(offer), tabindex: "0", role: "button" }));
  const shop = h("div", { class: "shop", "data-sell": "" }, ...offers);
  const fightButton = bevel("Fight!", "rose", () => {
    closePicker();
    options.fight();
  }, "prep__fight");

  const tip = h("div", { class: "tip", role: "tooltip", hidden: "" });
  const pickerOptions = ACTION_TYPES.map((action) => {
    const node = button(actionChip(action), "picker__option", () => choose(action), { role: "menuitemradio", "data-action": action });
    return { action, node };
  });
  const picker = h("div", { class: "picker", role: "menu", "aria-label": "Choose an action", hidden: "" }, ...pickerOptions.map(({ node }) => node));

  const screen = h("main", { class: "screen prep" },
    topbar, bank, mods, bars,
    h("div", { class: "prep__info" }, odds), money, lock,
    rerollButton, shop, fightButton, picker, tip);
  root.replaceChildren(screen);
  const toast = toaster(screen);

  function apply(refused: Refusal | null, culprit?: Element | null): boolean {
    if (refused) {
      toast(REFUSALS[refused]);
      if (culprit) shake(culprit);
      return false;
    }
    options.changed();
    render();
    return true;
  }

  function heldMod(held: Held): { mod: ModId; rotation: Rotation; stars: Stars } | null {
    if (held.kind === "offer") {
      const mod = run.shop.offers[held.offer];
      return mod === null ? null : { mod, rotation: 0, stars: 1 };
    }
    const owned = held.kind === "bank" ? run.bank[held.slot] : run.grid.find((piece) => piece.uid === held.uid);
    return owned ? { mod: owned.mod, rotation: owned.rotation, stars: owned.stars } : null;
  }

  function sourceOf(held: Held): Source {
    return held.kind === "bank" ? { bank: held.slot } : { piece: (held as { uid: number }).uid };
  }

  function placementFor(held: Held, mod: { mod: ModId; rotation: Rotation }): Placement {
    const piece = held.kind === "piece" ? run.grid.find((candidate) => candidate.uid === held.uid) : undefined;
    return piece ?? firstFit(run.grid, mod.mod, mod.rotation) ?? { mod: mod.mod, rotation: mod.rotation, x: 0, y: 0 };
  }

  function pivotFor(placement: Placement, cellIndex = 0): GridPoint {
    const local = shapeCells(REGISTRY[placement.mod].shape, placement.rotation)[cellIndex]
      ?? shapeCells(REGISTRY[placement.mod].shape, placement.rotation)[0];
    return { x: placement.x + local.x, y: placement.y + local.y };
  }

  /** Puts what is held where it was dropped: buys an offer, moves an owned mod, or sells it. */
  function drop(held: Held, target: Target, rotation: Rotation): Refusal | null {
    if (target.kind === "sell") return held.kind === "offer" ? null : sell(run, sourceOf(held));
    const destination: Destination = target.kind === "bank" ? { bank: target.slot } : { grid: { x: target.x, y: target.y, rotation } };
    if (held.kind === "offer") return buy(run, held.offer, destination);
    return move(run, sourceOf(held), destination);
  }

  // Rendering: everything is read from the run; nothing here writes it.

  function render(): void {
    const build = buildOf(run);
    const side = combatSide(build);
    setText(hearts, String(run.hearts));
    setText(day, `Day ${run.day}`);
    setText(trophies, `${run.trophies}/10`);

    bankSlots.forEach((slot, index) => {
      const owned = run.bank[index];
      slot.replaceChildren(...(owned ? [modArt(owned.mod, owned.rotation, "mod--mini", owned.stars),
        effectBadgeRow(effectBadges(REGISTRY[owned.mod], owned.stars), "slot__badges"),
        starRow(owned.stars, "stars slot__stars")] : []));
      slot.dataset.filled = owned ? "true" : "false";
      slot.setAttribute("aria-label", owned ? modLabel(REGISTRY[owned.mod], owned.stars) : `Empty bank slot ${index + 1}`);
      slot.classList.toggle("is-source", carry?.held.kind === "bank" && carry.held.slot === index);
    });

    pieces.replaceChildren(...run.grid.map((piece) => {
      const art = modArt(piece.mod, piece.rotation, "piece", piece.stars);
      art.style.left = `calc(var(--cell) * ${piece.x})`;
      art.style.top = `calc(var(--cell) * ${piece.y})`;
      art.dataset.uid = String(piece.uid);
      art.tabIndex = 0;
      art.setAttribute("role", "button");
      art.setAttribute("aria-label", modLabel(REGISTRY[piece.mod], piece.stars));
      art.classList.toggle("is-source", carry?.held.kind === "piece" && carry.held.uid === piece.uid);
      return art;
    }));

    BAR_IDS.forEach((bar, index) => barSlots[index].forEach(({ node, chip, damage }, slot) => {
      const action = run.loadout[bar][slot];
      const hit = hitDamage(side, action, build.preview[action]);
      node.dataset.action = action;
      paintChip(chip, action);
      setText(damage, String(hit));
      node.setAttribute("aria-label", `${BAR_NAME[bar]} slot ${slot + 1}: ${ACTION_LABEL[action]}, ${hit} damage. Change it.`);
    }));
    setText(stats, `♥ ${side.fighter.maxHealth} health`);

    const rank = shopRank(run.day);
    odds.replaceChildren(h("b", {}, `Rank ${rank}`), ...RARITY_ODDS[rank].flatMap((chance, index) => {
      if (chance === 0) return [];
      const rarity = RARITIES[index];
      return [h("span", { class: "odds__rarity", "data-rarity": rarity }, `${RARITY[rarity].label} ${chance}%`)];
    }));
    setText(money, `$${run.money}`);
    lock.setAttribute("aria-pressed", String(run.shop.locked));
    setText(lock.firstElementChild!, run.shop.locked ? "Locked" : "Lock");
    shop.classList.toggle("is-locked", run.shop.locked);
    const price = rerollPrice(run);
    setText(rerollLabel, price === 0 ? "Reroll free" : `Reroll $${price}`);
    rerollButton.disabled = price > run.money;

    offers.forEach((node, index) => {
      const mod = run.shop.offers[index];
      node.replaceChildren();
      node.dataset.sold = mod === null ? "true" : "false";
      node.classList.remove("is-poor");
      delete node.dataset.type;
      delete node.dataset.rarity;
      if (mod === null) {
        node.setAttribute("aria-label", "Sold");
        return;
      }
      const definition = REGISTRY[mod];
      node.dataset.type = definition.type;
      node.dataset.rarity = definition.rarity;
      node.classList.toggle("is-poor", priceOf(mod) > run.money);
      node.append(h("div", { class: "offer__art" }, modArt(mod, 0, "mod--mini"),
        effectBadgeRow(effectBadges(definition, 1), "offer__badges")),
        h("div", { class: "offer__foot" }, h("span", { class: "offer__name" }, definition.name), h("b", { class: "offer__price" }, `$${priceOf(mod)}`)));
      node.setAttribute("aria-label", modLabel(definition, 1));
    });
    drawCarry();
  }

  // The carried piece keeps its type colour; the piece itself carries valid/invalid placement state.

  function drawCarry(): void {
    if (carry === null) {
      carried.hidden = true;
      return;
    }
    const placement = { mod: carry.mod, rotation: carry.rotation, x: carry.x, y: carry.y };
    const legal = canPlace(run.grid, placement, carry.held.kind === "piece" ? carry.held.uid : null);
    const art = modArt(carry.mod, carry.rotation, "piece piece--ghost");
    art.dataset.placement = legal ? "valid" : "invalid";
    art.style.left = `calc(var(--cell) * ${carry.x})`;
    art.style.top = `calc(var(--cell) * ${carry.y})`;
    carried.replaceChildren(art);
    carried.hidden = false;
  }

  function startCarry(held: Held, pivot?: GridPoint): void {
    const found = heldMod(held);
    if (found === null) return;
    closePicker();
    const spot = placementFor(held, found);
    carry = { held, mod: found.mod, rotation: spot.rotation, x: spot.x, y: spot.y, pivot: pivot ?? pivotFor(spot) };
    toast("Click to place · right-click or R to turn · Esc to cancel");
    render();
  }

  function endCarry(): void {
    carry = null;
    render();
  }

  function placeCarry(): void {
    if (carry === null) return;
    const held = carry.held;
    const target: Target = { kind: "grid", x: carry.x, y: carry.y, legal: true };
    if (!apply(drop(held, target, carry.rotation), gridBox)) return;
    carry = null;
    render();
    const placed = run.grid.find((piece) => piece.x === target.x && piece.y === target.y);
    if (placed) pieces.querySelector<HTMLElement>(`[data-uid="${placed.uid}"]`)?.focus();
  }

  function moveCarry(dx: number, dy: number): void {
    if (carry === null) return;
    const [width, height] = shapeSize(shapeCells(REGISTRY[carry.mod].shape, carry.rotation));
    const nextX = Math.min(BOARD_WIDTH - width, Math.max(0, carry.x + dx));
    const nextY = Math.min(BOARD_HEIGHT - height, Math.max(0, carry.y + dy));
    carry.pivot = { x: carry.pivot.x + nextX - carry.x, y: carry.pivot.y + nextY - carry.y };
    carry.x = nextX;
    carry.y = nextY;
    drawCarry();
  }

  function followCarry(x: number, y: number): void {
    if (carry === null) return;
    const point = boardPointAt(x, y);
    if (point === null || (point.x === carry.pivot.x && point.y === carry.pivot.y)) return;
    carry.x += point.x - carry.pivot.x;
    carry.y += point.y - carry.pivot.y;
    carry.pivot = point;
    drawCarry();
  }

  // Dragging.

  function heldAt(target: EventTarget | null): { held: Held; origin: HTMLElement; cell: number } | null {
    if (!(target instanceof Element)) return null;
    const offer = target.closest<HTMLElement>(".offer[data-offer]");
    if (offer && offer.dataset.sold !== "true") return { held: { kind: "offer", offer: Number(offer.dataset.offer) }, origin: offer, cell: Number(target.closest<HTMLElement>(".mod__cell")?.dataset.index ?? 0) };
    const slot = target.closest<HTMLElement>(".slot[data-bank]");
    if (slot && slot.dataset.filled === "true") return { held: { kind: "bank", slot: Number(slot.dataset.bank) }, origin: slot, cell: Number(target.closest<HTMLElement>(".mod__cell")?.dataset.index ?? 0) };
    const piece = target.closest<HTMLElement>(".piece[data-uid]");
    if (piece && !piece.classList.contains("piece--ghost")) {
      const cell = target.closest<HTMLElement>(".mod__cell");
      return { held: { kind: "piece", uid: Number(piece.dataset.uid) }, origin: piece, cell: Number(cell?.dataset.index ?? 0) };
    }
    return null;
  }

  function inside(rect: DOMRect, x: number, y: number): boolean {
    return x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom;
  }

  function boardPointAt(x: number, y: number): GridPoint | null {
    const grid = gridBox.getBoundingClientRect();
    if (!inside(grid, x, y)) return null;
    return {
      x: Math.floor((x - grid.left) / (grid.width / BOARD_WIDTH)),
      y: Math.floor((y - grid.top) / (grid.height / BOARD_HEIGHT)),
    };
  }

  function targetAt(x: number, y: number, current: Drag): Target | null {
    const boardPoint = boardPointAt(x, y);
    if (boardPoint !== null) {
      const dx = boardPoint.x - current.pivot.x;
      const dy = boardPoint.y - current.pivot.y;
      current.placement = { ...current.placement, x: current.placement.x + dx, y: current.placement.y + dy };
      current.pivot = boardPoint;
      const except = current.held.kind === "piece" ? current.held.uid : null;
      return {
        kind: "grid",
        x: current.placement.x,
        y: current.placement.y,
        legal: canPlace(run.grid, current.placement, except),
      };
    }
    for (const [slot, node] of bankSlots.entries()) {
      if (inside(node.getBoundingClientRect(), x, y)) {
        const own = current.held.kind === "bank" && current.held.slot === slot;
        return { kind: "bank", slot, legal: own || run.bank[slot] === null };
      }
    }
    if (current.held.kind !== "offer" && inside(shop.getBoundingClientRect(), x, y)) return { kind: "sell" };
    return null;
  }

  function drawGhost(current: Drag): void {
    const grid = gridBox.getBoundingClientRect();
    const cellWidth = grid.width / BOARD_WIDTH;
    const ghost = modArt(current.mod, current.placement.rotation, "ghost");
    ghost.style.setProperty("--cell", `${cellWidth}px`);
    current.ghost?.remove();
    current.ghost = ghost;
    screen.append(ghost);
    placeGhost(current);
  }

  function placeGhost(current: Drag): void {
    if (current.ghost === null) return;
    const bounds = screen.getBoundingClientRect();
    const grid = gridBox.getBoundingClientRect();
    const cellWidth = grid.width / BOARD_WIDTH;
    const cellHeight = grid.height / BOARD_HEIGHT;
    current.target = targetAt(current.x, current.y, current);
    const anchor = { x: current.pivot.x - current.placement.x, y: current.pivot.y - current.placement.y };
    current.ghost.style.left = `${current.x - bounds.left - (anchor.x + 0.5) * cellWidth}px`;
    current.ghost.style.top = `${current.y - bounds.top - (anchor.y + 0.5) * cellHeight}px`;
    const target = current.target;
    if (target?.kind === "grid") current.ghost.dataset.placement = target.legal ? "valid" : "invalid";
    else delete current.ghost.dataset.placement;
    bankSlots.forEach((slot, index) => slot.classList.toggle("is-target", target?.kind === "bank" && target.slot === index));
    shop.classList.toggle("is-sell", target?.kind === "sell");
    if (current.held.kind !== "offer") {
      const owned = heldMod(current.held);
      shop.dataset.sell = owned ? `Sell +$${sellValue(owned)}` : "";
    }
  }

  function endDrag(): void {
    if (drag === null) return;
    drag.ghost?.remove();
    drag.origin.classList.remove("is-source");
    bankSlots.forEach((slot) => slot.classList.remove("is-target"));
    shop.classList.remove("is-sell", "is-selling");
    drag = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerCancel);
    drawCarry();
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    const inPicker = event.target instanceof Element && event.target.closest(".picker, .barslot");
    if (!inPicker) closePicker();
    if (carry !== null && tapWhileCarrying(event)) return;
    const found = heldAt(event.target);
    if (found === null) return;
    const mod = heldMod(found.held);
    if (mod === null) return;
    event.preventDefault();
    hideTip();
    const placement = placementFor(found.held, mod);
    drag = {
      held: found.held,
      mod: mod.mod,
      placement,
      pivot: pivotFor(placement, found.cell),
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      ghost: null,
      target: null,
      origin: found.origin,
    };
    if (found.held.kind !== "offer") shop.classList.add("is-selling");
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
  }

  function onPointerMove(event: PointerEvent): void {
    if (drag === null) return;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (!drag.moved && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) > 6) {
      drag.moved = true;
      carry = null;
      drag.origin.classList.add("is-source");
      drawGhost(drag);
    }
    if (drag.moved) placeGhost(drag);
  }

  function onPointerUp(): void {
    const finished = drag;
    if (finished === null) return;
    const { held, moved, target, placement, pivot, origin } = finished;
    endDrag();
    if (!moved) {
      startCarry(held, pivot);
      return;
    }
    if (target === null) return;
    if ((target.kind === "grid" || target.kind === "bank") && !target.legal) {
      apply("blocked", origin);
      return;
    }
    apply(drop(held, target, placement.rotation), origin);
  }

  function onPointerCancel(): void {
    endDrag();
  }

  /** While a mod is carried, a tap on the grid puts its icon cell there, on the bank banks it, on the shop sells it. */
  function tapWhileCarrying(event: PointerEvent): boolean {
    if (carry === null || !(event.target instanceof Element)) return false;
    const held = carry.held;
    const cell = event.target.closest<HTMLElement>(".cell, .grid");
    if (cell && gridBox.contains(cell)) {
      const boardPoint = boardPointAt(event.clientX, event.clientY);
      if (boardPoint === null) return false;
      carry.x += boardPoint.x - carry.pivot.x;
      carry.y += boardPoint.y - carry.pivot.y;
      carry.pivot = boardPoint;
      event.preventDefault();
      placeCarry();
      return true;
    }
    const slot = event.target.closest<HTMLElement>(".slot[data-bank]");
    if (slot && slot.dataset.filled !== "true") {
      event.preventDefault();
      if (apply(drop(held, { kind: "bank", slot: Number(slot.dataset.bank), legal: true }, carry.rotation), slot)) endCarry();
      return true;
    }
    if (event.target.closest(".shop") && held.kind !== "offer") {
      event.preventDefault();
      if (apply(sell(run, sourceOf(held)), shop)) endCarry();
      return true;
    }
    if (!event.target.closest(".piece, .slot")) {
      endCarry();
      return true;
    }
    endCarry();
    return false;
  }

  // Turning: right-click or R while a piece is in hand; right-click on a placed piece turns it in place.

  function turnHeld(): void {
    if (drag?.moved) {
      const turned = turnAbout(drag.placement, drag.pivot);
      if (turned !== null) drag.placement = turned;
      drawGhost(drag);
    } else if (carry !== null) {
      const turned = turnAbout({ mod: carry.mod, rotation: carry.rotation, x: carry.x, y: carry.y }, carry.pivot);
      if (turned === null) return;
      carry.rotation = turned.rotation;
      carry.x = turned.x;
      carry.y = turned.y;
      drawCarry();
    }
  }

  function onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    if (drag?.moved || carry !== null) {
      turnHeld();
      return;
    }
    const found = heldAt(event.target);
    if (found === null || found.held.kind === "offer") return;
    if (found.held.kind === "piece") {
      const uid = found.held.uid;
      const piece = run.grid.find((candidate) => candidate.uid === uid);
      const pivot = boardPointAt(event.clientX, event.clientY);
      if (piece === undefined || pivot === null || !cellsOf(piece).some(({ x, y }) => x === pivot.x && y === pivot.y)) return;
      apply(rotate(run, sourceOf(found.held), pivot), found.origin);
      return;
    }
    apply(rotate(run, sourceOf(found.held)), found.origin);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      if (drag) endDrag();
      else if (carry) endCarry();
      else if (picking) closePicker();
      return;
    }
    if (event.key === "r" || event.key === "R") {
      if (drag?.moved || carry) {
        event.preventDefault();
        turnHeld();
        return;
      }
      const found = heldAt(document.activeElement);
      if (found && found.held.kind !== "offer") {
        event.preventDefault();
        apply(rotate(run, sourceOf(found.held)), found.origin);
      }
      return;
    }
    if (carry !== null) {
      const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (moves[event.key]) {
        event.preventDefault();
        moveCarry(...moves[event.key]);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        placeCarry();
      } else if (event.key === "b" || event.key === "B") {
        const slot = run.bank.indexOf(null);
        if (carry.held.kind === "bank") endCarry();
        else if (slot < 0) apply("no-room", bank);
        else if (apply(drop(carry.held, { kind: "bank", slot, legal: true }, carry.rotation), bank)) endCarry();
      } else if ((event.key === "s" || event.key === "S" || event.key === "Delete" || event.key === "Backspace") && carry.held.kind !== "offer") {
        event.preventDefault();
        if (apply(sell(run, sourceOf(carry.held)), shop)) endCarry();
      }
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && document.activeElement instanceof HTMLElement) {
      const found = heldAt(document.activeElement);
      if (found === null) return;
      event.preventDefault();
      const mod = heldMod(found.held);
      if (mod !== null) {
        const spot = placementFor(found.held, mod);
        startCarry(found.held, pivotFor(spot, found.cell));
      }
    }
  }

  // The Strike / Tech / Block picker for a bar slot.

  function openPicker(bar: BarId, slot: SlotIndex, anchor: HTMLElement): void {
    if (picking && picking.bar === bar && picking.slot === slot) {
      closePicker();
      return;
    }
    picking = { bar, slot };
    const current = run.loadout[bar][slot];
    for (const { action, node } of pickerOptions) node.setAttribute("aria-checked", String(action === current));
    picker.hidden = false;
    const bounds = screen.getBoundingClientRect();
    const rect = anchor.getBoundingClientRect();
    const box = picker.getBoundingClientRect();
    picker.style.left = `${Math.min(bounds.width - box.width - 8, Math.max(8, rect.left - bounds.left + rect.width / 2 - box.width / 2))}px`;
    picker.style.top = `${Math.max(8, rect.top - bounds.top - box.height - 8)}px`;
    pickerOptions[ACTION_TYPES.indexOf(current)].node.focus();
  }

  function closePicker(): void {
    if (picking === null) return;
    picking = null;
    picker.hidden = true;
  }

  function choose(action: ActionType): void {
    if (picking === null) return;
    const { bar, slot } = picking;
    closePicker();
    apply(setAction(run, bar, slot, action));
    barSlots[BAR_IDS.indexOf(bar)][slot].node.focus();
  }

  // Tooltips: everything a mod, a lane, a level or a slot means, on hover or focus.

  function describe(target: Element): Node[] | null {
    const found = heldAt(target);
    if (found) {
      const mod = heldMod(found.held);
      if (mod === null) return null;
      const definition = REGISTRY[mod.mod];
      return [
        h("b", {}, `${definition.name} ${starText(mod.stars)}`),
        ...effectLines(definition, mod.stars).map((line) => h("span", { class: "tip__rule" }, line)),
        h("small", {}, found.held.kind === "offer" ? `${priceOf(mod.mod)} · click to carry, drag to place`
          : `Sells for ${sellValue(mod)} · click to carry, drag to move`),
        h("small", {}, "While carried: click to place · right-click or R to turn · Esc to cancel"),
      ];
    }
    return null;
  }

  function showTip(target: Element): void {
    if (drag?.moved) return;
    const lines = describe(target);
    if (lines === null) return;
    const found = heldAt(target);
    const mod = found === null ? null : heldMod(found.held);
    if (mod === null) delete tip.dataset.rarity;
    else tip.dataset.rarity = REGISTRY[mod.mod].rarity;
    tip.replaceChildren(...lines);
    tip.hidden = false;
    const bounds = screen.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    const box = tip.getBoundingClientRect();
    const above = rect.top - bounds.top - box.height - 10;
    tip.style.left = `${Math.min(bounds.width - box.width - 8, Math.max(8, rect.left - bounds.left + rect.width / 2 - box.width / 2))}px`;
    tip.style.top = `${above > 8 ? above : rect.bottom - bounds.top + 10}px`;
  }

  function hideTip(): void {
    tip.hidden = true;
  }

  function onPointerOver(event: PointerEvent): void {
    if (event.pointerType === "touch" || !(event.target instanceof Element)) return;
    const describable = event.target.closest(".offer, .slot, .piece, [data-lane]");
    if (describable) showTip(describable);
    else hideTip();
  }

  function onFocusIn(event: FocusEvent): void {
    if (event.target instanceof Element && event.target.matches(".offer, .slot, .piece")) showTip(event.target);
    else hideTip();
  }

  screen.addEventListener("pointerdown", onPointerDown);
  screen.addEventListener("pointermove", (event) => {
    if (drag === null && carry !== null) followCarry(event.clientX, event.clientY);
  });
  screen.addEventListener("pointerover", onPointerOver);
  screen.addEventListener("pointerleave", hideTip);
  screen.addEventListener("focusin", onFocusIn);
  screen.addEventListener("contextmenu", onContextMenu);
  window.addEventListener("keydown", onKeyDown);

  render();
  return () => {
    endDrag();
    window.removeEventListener("keydown", onKeyDown);
    root.replaceChildren();
  };
}
