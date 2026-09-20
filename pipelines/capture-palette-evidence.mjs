import { writeFileSync } from "node:fs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pages = await fetch("http://127.0.0.1:9222/json").then((response) => response.json());
const page = pages.find((entry) => entry.type === "page");
if (!page) throw new Error("Chrome exposed no page target");

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});

let nextId = 1;
const pending = new Map();
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const entry = pending.get(message.id);
  if (!entry) return;
  pending.delete(message.id);
  if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
  else entry.resolve(message.result);
};

const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(selector) {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`)) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${selector}`);
}

async function openArmory(url) {
  await send("Page.navigate", { url });
  await waitFor(".title");
  const opened = await evaluate(`(() => {
    const button = [...document.querySelectorAll("button")].find((node) => node.textContent.trim().startsWith("Armory"));
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (!opened) throw new Error("Could not open Armory");
  await waitFor(".armory");
}

async function key(name) {
  await evaluate(`window.dispatchEvent(new KeyboardEvent("keydown", { key: ${JSON.stringify(name)}, bubbles: true }))`);
  await sleep(50);
}

async function shot(path) {
  const image = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  writeFileSync(path, Buffer.from(image.data, "base64"));
}

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1920,
  height: 1080,
  deviceScaleFactor: 1,
  mobile: false,
});

await openArmory("http://127.0.0.1:5192/");
const shell = await evaluate(`(() => {
  const grid = document.querySelector(".armory__grid");
  const scroll = document.querySelector(".armory__scroll");
  if (!grid || !scroll) return null;
  return {
    viewport: [innerWidth, innerHeight],
    title: document.querySelector(".armory__title")?.textContent?.trim(),
    controls: [...document.querySelectorAll(".armory__top-control")].map((node) => node.textContent?.trim()),
    close: document.querySelector(".armory__close")?.textContent?.trim(),
    filterRows: document.querySelectorAll(".armory__filters").length,
    columns: getComputedStyle(grid).gridTemplateColumns.trim().split(/\\s+/).length,
    overflowY: getComputedStyle(scroll).overflowY,
    scrollable: scroll.scrollHeight > scroll.clientHeight,
    counters: [...document.querySelectorAll(".armory__counter")].map((node) => node.textContent?.replace(/\\s+/g, " ").trim()),
  };
})()`);
if (!shell
    || shell.viewport[0] !== 1920 || shell.viewport[1] !== 1080
    || shell.title !== "MOD CATALOG"
    || JSON.stringify(shell.controls) !== JSON.stringify(["FILTER: NONE", "CLEAR"])
    || shell.close !== "×"
    || shell.filterRows !== 2
    || shell.columns !== 4
    || shell.overflowY !== "scroll"
    || !shell.scrollable
    || shell.counters.length !== 3
    || !shell.counters.every((text) => /\d+ \/ \d+$/.test(text))) {
  throw new Error(`Catalogue shell failed: ${JSON.stringify(shell)}`);
}

const filtered = await evaluate(`(() => {
  const solar = document.querySelector('.armory__segments[aria-label="Type"] [data-value="solar"]');
  if (!(solar instanceof HTMLButtonElement)) return null;
  solar.click();
  const cards = [...document.querySelectorAll(".catalog-card__shape")];
  return { count: cards.length, allSolar: cards.every((node) => node.getAttribute("data-type") === "solar") };
})()`);
if (!filtered || filtered.count === 0 || !filtered.allSolar) {
  throw new Error(`Legacy type filter stopped working: ${JSON.stringify(filtered)}`);
}
await evaluate(`document.querySelector('.armory__segments[aria-label="Type"] [data-value="all"]')?.click()`);
await sleep(50);

await evaluate(`document.querySelectorAll(".catalog-card")[0]?.focus()`);
await key("ArrowRight");
const afterRight = await evaluate(`(() => {
  const cards = [...document.querySelectorAll(".catalog-card")];
  return cards.indexOf(document.activeElement);
})()`);
if (afterRight !== 1) throw new Error(`ArrowRight moved to index ${afterRight}, expected 1`);

await key("ArrowDown");
const afterDown = await evaluate(`(() => {
  const cards = [...document.querySelectorAll(".catalog-card")];
  return cards.indexOf(document.activeElement);
})()`);
if (afterDown !== 5) throw new Error(`ArrowDown moved to index ${afterDown}, expected 5`);

await key("Enter");
const entered = await evaluate(`(() => {
  const active = document.activeElement;
  return active instanceof HTMLElement
    && active.dataset.mod
    && document.querySelector('.catalog-card[aria-pressed="true"]')?.getAttribute("data-mod") === active.dataset.mod;
})()`);
if (!entered) throw new Error("Enter did not select the focused catalogue card");

const detail = await evaluate(`(() => {
  const selected = document.querySelector('[data-mod="thunderhead"]');
  if (!(selected instanceof HTMLButtonElement)) return null;
  selected.click();
  selected.scrollIntoView({ block: "center" });
  const pane = document.querySelector(".detail-pane");
  const art = pane?.querySelector(".detail-pane__art");
  const catalogCell = document.querySelector(".catalog-card:not([data-mod=thunderhead]) .catalog-card__cell");
  const detailCell = art?.querySelector(".catalog-card__cell");
  if (!(pane instanceof HTMLElement) || !(art instanceof HTMLElement) || !catalogCell || !detailCell) return null;
  const filled = [...selected.querySelectorAll(".catalog-card__pip")]
    .filter((node) => node.getAttribute("data-filled") === "true")
    .map((node) => node.textContent?.trim() ?? "");
  const expectedStars = filled.at(-1) || "★";
  return {
    name: pane.querySelector(".detail-pane__name")?.textContent?.trim(),
    rarity: pane.dataset.rarity,
    cells: art.querySelectorAll(".catalog-card__cell").length,
    actions: art.querySelectorAll(".catalog-card__action").length,
    pips: pane.querySelectorAll(".detail-pane__pip").length,
    selectedStars: pane.querySelector('.detail-pane__pip[aria-pressed="true"]')?.textContent?.trim(),
    expectedStars,
    rules: pane.querySelectorAll(".detail-pane__rules p").length,
    copies: pane.querySelector(".detail-pane__copies")?.textContent?.trim() ?? "",
    copiesWhiteSpace: getComputedStyle(pane.querySelector(".detail-pane__copies")).whiteSpace,
    detailCell: parseFloat(getComputedStyle(detailCell).width),
    catalogCell: parseFloat(getComputedStyle(catalogCell).width),
    rotation: art.dataset.rotation,
    forbidden: pane.querySelectorAll(".card__description, .card__rarity, .tagchips, .card__table, .card__profile, .card__ports").length,
    rotateButtons: [...pane.querySelectorAll("button")].filter((node) => /rotate/i.test(node.textContent ?? "")).length,
  };
})()`);
if (!detail
    || detail.name !== "Thunderhead"
    || detail.rarity !== "legendary"
    || detail.cells !== 4
    || detail.actions !== 1
    || detail.pips !== 3
    || detail.selectedStars !== detail.expectedStars
    || detail.rules < 1 || detail.rules > 3
    || !/^Owned \\d+ · ★★ (?:ready|\\d+ more) · ★★★ (?:ready|\\d+ more)$/.test(detail.copies)
    || detail.copiesWhiteSpace !== "nowrap"
    || !(detail.detailCell > detail.catalogCell)
    || detail.rotation !== "0"
    || detail.forbidden !== 0
    || detail.rotateButtons !== 0) {
  throw new Error(`Detail pane contract failed: ${JSON.stringify(detail)}`);
}
const rotated = await evaluate(`(() => {
  const art = document.querySelector(".detail-pane__art");
  if (!(art instanceof HTMLElement)) return null;
  art.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
  const afterContext = art.dataset.rotation;
  art.dispatchEvent(new KeyboardEvent("keydown", { key: "r", bubbles: true, cancelable: true }));
  return { afterContext, afterR: art.dataset.rotation };
})()`);
if (!rotated || rotated.afterContext !== "90" || rotated.afterR !== "180") {
  throw new Error(`Detail rotation failed: ${JSON.stringify(rotated)}`);
}
await evaluate(`document.querySelector('.detail-pane__pip[aria-label="Preview at 3 stars"]')?.click()`);
await sleep(100);
await shot("screenshots/catalogue-detail.png");

const hoverTarget = await evaluate(`(() => {
  const cards = [...document.querySelectorAll(".catalog-card")];
  const selected = cards.find((node) => node.getAttribute("data-mod") === "cinder-edge");
  if (!(selected instanceof HTMLButtonElement)) return null;
  selected.click();
  selected.scrollIntoView({ block: "center" });
  const index = cards.indexOf(selected);
  const target = cards[index + 1] ?? cards[index - 1];
  if (!(target instanceof HTMLButtonElement)) return null;
  const rect = target.getBoundingClientRect();
  return {
    selected: selected.dataset.mod,
    target: target.dataset.mod,
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
})()`);
if (!hoverTarget || hoverTarget.selected === hoverTarget.target) throw new Error("Could not choose separate selected and hover cards");
await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: hoverTarget.x, y: hoverTarget.y });
await sleep(150);
const hoverState = await evaluate(`(() => ({
  selected: document.querySelector('.catalog-card[aria-pressed="true"]')?.getAttribute("data-mod"),
  hovered: document.querySelector(".catalog-card:hover")?.getAttribute("data-mod"),
}))()`);
if (hoverState.selected !== "cinder-edge" || hoverState.hovered !== hoverTarget.target || hoverState.hovered === hoverState.selected) {
  throw new Error(`Selected/hover evidence failed: ${JSON.stringify({ hoverTarget, hoverState })}`);
}
await shot("screenshots/catalogue-selected-hover.png");

await key("Escape");
await waitFor(".title");

await openArmory("http://127.0.0.1:5192/?debug");
await waitFor(".palette-sheet");
await sleep(250);

const evidence = await evaluate(`(() => ({
  viewport: [innerWidth, innerHeight],
  pairs: document.querySelectorAll(".palette-sheet__pair").length,
  cardActions: document.querySelectorAll(".palette-sheet__sample--card .mod__action").length,
  boardActions: document.querySelectorAll(".palette-sheet__sample--board .mod__action").length,
  rarities: document.querySelectorAll(".palette-sheet__rarity").length,
  states: [...document.querySelectorAll(".palette-sheet__state > small")].map((node) => node.textContent?.trim() ?? ""),
  selectedCorners: Boolean(document.querySelector('.palette-sheet__state .catalog-card[aria-pressed="true"]')),
  poor: Boolean(document.querySelector(".palette-sheet__state .offer.is-poor")),
  sold: Boolean(document.querySelector('.palette-sheet__state .offer[data-sold="true"]')),
  valid: Boolean(document.querySelector('.palette-sheet__state .mod[data-placement="valid"]')),
  invalid: Boolean(document.querySelector('.palette-sheet__state .mod[data-placement="invalid"]')),
  source: Boolean(document.querySelector(".palette-sheet__state .mod.is-source")),
  visible: document.querySelector(".palette-sheet")?.getBoundingClientRect().height ?? 0,
}))()`);

if (evidence.viewport[0] !== 1920 || evidence.viewport[1] !== 1080) {
  throw new Error(`Expected 1920x1080 viewport, got ${evidence.viewport.join("x")}`);
}
const expectedStates = ["Hover", "Selected", "Focus", "Unaffordable", "Sold", "Valid carry", "Invalid carry", "Source"];
if (evidence.pairs !== 16 || evidence.cardActions !== 12 || evidence.boardActions !== 12 || evidence.rarities !== 5) {
  throw new Error(`Palette sheet incomplete: ${JSON.stringify(evidence)}`);
}
if (JSON.stringify(evidence.states) !== JSON.stringify(expectedStates)) {
  throw new Error(`Palette state sheet incomplete: ${JSON.stringify(evidence.states)}`);
}
if (!evidence.selectedCorners || !evidence.poor || !evidence.sold || !evidence.valid || !evidence.invalid || !evidence.source) {
  throw new Error(`Palette state hooks are missing: ${JSON.stringify(evidence)}`);
}
if (evidence.visible <= 0) throw new Error("Palette sheet is not visible");
await shot("screenshots/palette-sheet.png");

socket.close();
