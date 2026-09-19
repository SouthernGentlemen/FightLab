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

await send("Page.navigate", { url: "http://127.0.0.1:5192/?debug" });
await waitFor(".title");
const opened = await evaluate(`(() => {
  const button = [...document.querySelectorAll("button")].find((node) => node.textContent.trim().startsWith("Armory"));
  if (!button) return false;
  button.click();
  return true;
})()`);
if (!opened) throw new Error("Could not open Armory in debug mode");
await waitFor(".palette-sheet");
await sleep(250);

const evidence = await evaluate(`(() => ({
  viewport: [innerWidth, innerHeight],
  pairs: document.querySelectorAll(".palette-sheet__pair").length,
  cardActions: document.querySelectorAll(".palette-sheet__sample--card .mod__action").length,
  boardActions: document.querySelectorAll(".palette-sheet__sample--board .mod__action").length,
  rarities: document.querySelectorAll(".palette-sheet__rarity").length,
  visible: document.querySelector(".palette-sheet")?.getBoundingClientRect().height ?? 0,
}))()`);

if (evidence.viewport[0] !== 1920 || evidence.viewport[1] !== 1080) {
  throw new Error(`Expected 1920x1080 viewport, got ${evidence.viewport.join("x")}`);
}
if (evidence.pairs !== 16 || evidence.cardActions !== 12 || evidence.boardActions !== 12 || evidence.rarities !== 5) {
  throw new Error(`Palette sheet incomplete: ${JSON.stringify(evidence)}`);
}
if (evidence.visible <= 0) throw new Error("Palette sheet is not visible");

const image = await send("Page.captureScreenshot", {
  format: "png",
  fromSurface: true,
  captureBeyondViewport: false,
});
writeFileSync("screenshots/palette-sheet.png", Buffer.from(image.data, "base64"));
socket.close();
