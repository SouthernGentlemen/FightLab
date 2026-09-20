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

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1920,
  height: 1080,
  deviceScaleFactor: 1,
  mobile: false,
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

const detail = await evaluate(`(() => {
  const selected = document.querySelector('[data-mod="cinder-wall"]');
  if (!(selected instanceof HTMLButtonElement)) return null;
  selected.click();
  selected.scrollIntoView({ block: "center" });
  const pane = document.querySelector(".detail-pane");
  const art = pane?.querySelector(".detail-pane__art");
  const catalogCell = document.querySelector(".catalog-card:not([data-mod=cinder-wall]) .catalog-card__cell");
  const detailCell = art?.querySelector(".catalog-card__cell");
  const copies = pane?.querySelector(".detail-pane__copies");
  const name = pane?.querySelector(".detail-pane__name");
  if (!(pane instanceof HTMLElement)
      || !(art instanceof HTMLElement)
      || !catalogCell || !detailCell || !(copies instanceof HTMLElement)
      || !(name instanceof HTMLElement)) return null;

  const filled = [...selected.querySelectorAll(".catalog-card__pip")]
    .filter((node) => node.getAttribute("data-filled") === "true")
    .map((node) => node.textContent?.trim() ?? "");
  return {
    name: name.textContent?.trim(),
    rarity: name.dataset.rarity,
    rarityNodes: pane.querySelectorAll("[data-rarity]").length,
    cells: art.querySelectorAll(".catalog-card__cell").length,
    actions: art.querySelectorAll(".catalog-card__action").length,
    pips: pane.querySelectorAll(".detail-pane__pip").length,
    selectedStars: pane.querySelector('.detail-pane__pip[aria-pressed="true"]')?.textContent?.trim(),
    expectedStars: filled.at(-1) || "★",
    rules: pane.querySelectorAll(".detail-pane__rules p").length,
    copies: copies.textContent?.trim() ?? "",
    copiesWhiteSpace: getComputedStyle(copies).whiteSpace,
    detailCell: parseFloat(getComputedStyle(detailCell).width),
    catalogCell: parseFloat(getComputedStyle(catalogCell).width),
    rotation: art.dataset.rotation,
    forbidden: pane.querySelectorAll(".card__description, .card__rarity, .tagchips, .card__table, .card__profile, .card__ports").length,
    rotateButtons: [...pane.querySelectorAll("button")].filter((node) => /rotate/i.test(node.textContent ?? "")).length,
  };
})()`);

if (!detail
    || detail.name !== "Cinder Wall"
    || detail.rarity !== "uncommon"
    || detail.rarityNodes !== 1
    || detail.cells !== 4
    || detail.actions !== 1
    || detail.pips !== 3
    || detail.selectedStars !== detail.expectedStars
    || detail.rules < 1 || detail.rules > 3
    || !/^Owned \d+ · ★★ (?:ready|\d+ more) · ★★★ (?:ready|\d+ more)$/.test(detail.copies)
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
await sleep(120);

const image = await send("Page.captureScreenshot", {
  format: "png",
  fromSurface: true,
  captureBeyondViewport: false,
});
writeFileSync("screenshots/catalogue-detail.png", Buffer.from(image.data, "base64"));
socket.close();
