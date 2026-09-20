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
  if (!opened) throw new Error("Could not open Armory in debug mode");
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

await openArmory("http://127.0.0.1:5192/?debug=icon-placement");
await waitFor('[data-sheet="icon-placement"]');
await sleep(250);

const comparison = await evaluate(`(() => ({
  viewport: [innerWidth, innerHeight],
  shapes: [...document.querySelectorAll('[data-sheet="icon-placement"] [data-shape]')].map((node) => node.getAttribute("data-shape")),
  centreCard: document.querySelectorAll('[data-sheet="icon-placement"] [data-placement="centre"][data-size="card"] .mod__action').length,
  centreBoard: document.querySelectorAll('[data-sheet="icon-placement"] [data-placement="centre"][data-size="board"] .mod__action').length,
  anchorCard: document.querySelectorAll('[data-sheet="icon-placement"] [data-placement="anchor"][data-size="card"] .mod__action').length,
  anchorBoard: document.querySelectorAll('[data-sheet="icon-placement"] [data-placement="anchor"][data-size="board"] .mod__action').length,
  visible: document.querySelector('[data-sheet="icon-placement"]')?.getBoundingClientRect().height ?? 0,
}))()`);
const expectedShapes = ["tetromino-i", "tetromino-o", "tetromino-t", "tetromino-s", "tetromino-z", "tetromino-j", "tetromino-l", "triomino-i", "triomino-l", "domino", "single"];
if (comparison.viewport[0] !== 1920 || comparison.viewport[1] !== 1080
    || JSON.stringify(comparison.shapes) !== JSON.stringify(expectedShapes)
    || comparison.centreCard !== 11 || comparison.centreBoard !== 11
    || comparison.anchorCard !== 11 || comparison.anchorBoard !== 11
    || comparison.visible <= 0) {
  throw new Error(`Icon placement comparison incomplete: ${JSON.stringify(comparison)}`);
}
await shot("screenshots/icon-placement-compare.png");

socket.close();
