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

async function key(name, shiftKey = false) {
  await evaluate(`window.dispatchEvent(new KeyboardEvent("keydown", {
    key: ${JSON.stringify(name)}, shiftKey: ${shiftKey}, bubbles: true, cancelable: true
  }))`);
  await sleep(50);
}

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false,
});
await send("Page.navigate", { url: "http://127.0.0.1:5192/" });
await waitFor(".title");

const opened = await evaluate(`(() => {
  const button = [...document.querySelectorAll("button")]
    .find((node) => node.textContent.trim().startsWith("Armory"));
  if (!button) return false;
  button.click();
  return true;
})()`);
if (!opened) throw new Error("Could not open Armory");
await waitFor(".armory");

const initial = await evaluate(`(() => ({
  cards: document.querySelectorAll(".catalog-card").length,
  oldRows: document.querySelectorAll(".armory__filters").length,
  filter: document.querySelector('[data-control="filter"]')?.textContent?.trim(),
}))()`);
if (initial.oldRows !== 0 || initial.filter !== "FILTER: NONE" || initial.cards <= 0) {
  throw new Error(`Initial filter shell failed: ${JSON.stringify(initial)}`);
}

const modal = await evaluate(`(() => {
  const filter = document.querySelector('[data-control="filter"]');
  if (!(filter instanceof HTMLButtonElement)) return null;
  filter.click();
  const panel = document.querySelector(".filter-modal__panel");
  if (!(panel instanceof HTMLElement)) return null;
  return {
    header: panel.querySelector("h2")?.textContent?.trim(),
    close: panel.querySelector(".filter-modal__close")?.textContent?.trim(),
    clear: panel.querySelector(".filter-modal__clear")?.textContent?.trim(),
    types: panel.querySelectorAll('[data-group="types"]').length,
    actions: panel.querySelectorAll('[data-group="affinities"]').length,
    sizes: [...panel.querySelectorAll('[data-group="sizes"]')].map((node) => ({
      value: node.getAttribute("data-value"),
      cells: node.querySelectorAll(".filter-chip__footprint i").length,
    })),
    rarities: panel.querySelectorAll('[data-group="rarities"]').length,
    focusInside: panel.contains(document.activeElement),
  };
})()`);
if (!modal
    || modal.header !== "FILTER"
    || modal.close !== "×"
    || modal.clear !== "CLEAR"
    || modal.types !== 4
    || modal.actions !== 4
    || modal.rarities !== 5
    || !modal.focusInside
    || JSON.stringify(modal.sizes) !== JSON.stringify([
      { value: "4", cells: 4 }, { value: "3", cells: 3 }, { value: "2", cells: 2 }, { value: "1", cells: 1 },
    ])) {
  throw new Error(`Filter modal contract failed: ${JSON.stringify(modal)}`);
}

const selected = await evaluate(`(() => {
  const click = (group, value) => {
    const node = document.querySelector(`[data-group="${group}"][data-value="${value}"]`);
    if (!(node instanceof HTMLButtonElement)) return false;
    node.click();
    return true;
  };
  if (!click("types", "solar") || !click("affinities", "strike") || !click("sizes", "2")) return null;
  const cards = [...document.querySelectorAll(".catalog-card")];
  return {
    summary: document.querySelector('[data-control="filter"]')?.textContent?.trim(),
    pressed: document.querySelectorAll('.filter-chip[aria-pressed="true"]').length,
    count: cards.length,
    allMatch: cards.every((card) => {
      const shape = card.querySelector(".catalog-card__shape");
      return shape?.getAttribute("data-type") === "solar"
        && shape?.getAttribute("data-affinity") === "strike"
        && card.querySelectorAll(".catalog-card__cell").length === 2;
    }),
  };
})()`);
if (!selected || selected.summary !== "FILTER: 3" || selected.pressed !== 3 || selected.count === 0 || !selected.allMatch) {
  throw new Error(`Live filtering failed: ${JSON.stringify(selected)}`);
}

const image = await send("Page.captureScreenshot", {
  format: "png", fromSurface: true, captureBeyondViewport: false,
});
writeFileSync("screenshots/catalogue-filter-modal.png", Buffer.from(image.data, "base64"));

await evaluate(`document.querySelector(".filter-modal__close")?.focus()`);
await key("Tab", true);
const wrappedBack = await evaluate(`document.activeElement?.classList.contains("filter-modal__clear") ?? false`);
await key("Tab");
const wrappedForward = await evaluate(`document.activeElement?.classList.contains("filter-modal__close") ?? false`);
if (!wrappedBack || !wrappedForward) throw new Error("Filter modal focus did not wrap");

const modalCleared = await evaluate(`(() => {
  const clear = document.querySelector(".filter-modal__clear");
  if (!(clear instanceof HTMLButtonElement)) return null;
  clear.click();
  return {
    summary: document.querySelector('[data-control="filter"]')?.textContent?.trim(),
    cards: document.querySelectorAll(".catalog-card").length,
    pressed: document.querySelectorAll('.filter-chip[aria-pressed="true"]').length,
  };
})()`);
if (!modalCleared || modalCleared.summary !== "FILTER: NONE"
    || modalCleared.cards !== initial.cards || modalCleared.pressed !== 0) {
  throw new Error(`Modal Clear failed: ${JSON.stringify(modalCleared)}`);
}

await evaluate(`document.querySelector('[data-group="types"][data-value="void"]')?.click()`);
await key("Escape");
const afterModalEscape = await evaluate(`(() => ({
  armory: Boolean(document.querySelector(".armory")),
  hidden: document.querySelector(".filter-modal")?.hasAttribute("hidden"),
  focusReturned: document.activeElement === document.querySelector('[data-control="filter"]'),
  summary: document.querySelector('[data-control="filter"]')?.textContent?.trim(),
}))()`);
if (!afterModalEscape.armory || !afterModalEscape.hidden || !afterModalEscape.focusReturned
    || afterModalEscape.summary !== "FILTER: 1") {
  throw new Error(`First Escape failed: ${JSON.stringify(afterModalEscape)}`);
}

const topCleared = await evaluate(`(() => {
  const clear = document.querySelector('[data-control="clear"]');
  if (!(clear instanceof HTMLButtonElement)) return null;
  clear.click();
  return {
    summary: document.querySelector('[data-control="filter"]')?.textContent?.trim(),
    cards: document.querySelectorAll(".catalog-card").length,
  };
})()`);
if (!topCleared || topCleared.summary !== "FILTER: NONE" || topCleared.cards !== initial.cards) {
  throw new Error(`Top Clear failed: ${JSON.stringify(topCleared)}`);
}

await key("Escape");
await waitFor(".title");
socket.close();
