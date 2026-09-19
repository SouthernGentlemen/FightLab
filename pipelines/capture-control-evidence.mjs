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

const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};

const waitFor = async (expression, label) => {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (await evaluate(expression)) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
};

const clickText = async (label) => {
  const clicked = await evaluate(`(() => {
    const node = [...document.querySelectorAll("button")].find((button) => button.textContent.trim().startsWith(${JSON.stringify(label)}));
    if (!node) return false;
    node.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Could not find ${label} button`);
};

const dispatchAt = async (selector, type, extras = "") => evaluate(`(() => {
  const node = document.querySelector(${JSON.stringify(selector)});
  if (!node) return false;
  const rect = node.getBoundingClientRect();
  const clientX = rect.left + rect.width / 2;
  const clientY = rect.top + rect.height / 2;
  node.dispatchEvent(new PointerEvent(${JSON.stringify(type)}, {
    bubbles: true, cancelable: true, pointerType: "mouse", button: 0, clientX, clientY${extras}
  }));
  return true;
})()`);

const clickPointer = async (selector) => {
  if (!await dispatchAt(selector, "pointerdown")) throw new Error(`Missing ${selector}`);
  await evaluate(`window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerType: "mouse", button: 0 }))`);
  await sleep(100);
};

const moveToCell = async (x, y) => {
  const selector = `.cell[data-x="${x}"][data-y="${y}"]`;
  if (!await dispatchAt(selector, "pointermove")) throw new Error(`Missing board cell ${x},${y}`);
  await sleep(100);
};

const rightClick = async (selector) => {
  const ok = await evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) return false;
    const rect = node.getBoundingClientRect();
    node.dispatchEvent(new MouseEvent("contextmenu", {
      bubbles: true, cancelable: true, button: 2,
      clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
    }));
    return true;
  })()`);
  if (!ok) throw new Error(`Missing ${selector}`);
  await sleep(100);
};

const shot = async (name) => {
  const viewport = await evaluate("({ width: innerWidth, height: innerHeight })");
  if (viewport.width !== 1920 || viewport.height !== 1080) {
    throw new Error(`Expected 1920x1080 viewport, got ${viewport.width}x${viewport.height}`);
  }
  const image = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  writeFileSync(`screenshots/${name}.png`, Buffer.from(image.data, "base64"));
};

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });

await evaluate(`(async () => {
  const { newRun } = await import("/src/run/run.ts");
  const { place, setBankSlot } = await import("/src/mods/grid.ts");
  const { writeSave } = await import("/src/run/save.ts");
  const run = newRun(13013);
  run.bank = setBankSlot(run.bank, 0, { uid: 1, mod: "chain-circuit", stars: 1, rotation: 0 });
  run.grid = place(run.grid, { uid: 2, mod: "heat-coil", stars: 1, rotation: 0, x: 2, y: 2 });
  run.nextUid = 3;
  writeSave(run, null, localStorage);
  return true;
})()`);

await send("Page.navigate", { url: "http://127.0.0.1:5192/" });
await waitFor('Boolean(document.querySelector(".title"))', "title");
await clickText("Play");
await waitFor('Boolean(document.querySelector(".prep"))', "Prep");

await evaluate(`(() => {
  const slot = document.querySelector('.slot[data-bank="0"]');
  slot?.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }));
  return true;
})()`);
await waitFor(
  'document.querySelector(".tip:not([hidden])")?.textContent.includes("While carried: click to place · right-click or R to turn · Esc to cancel") === true',
  "updated control tooltip",
);

await clickPointer('.slot[data-bank="0"] .mod__cell[data-index="1"]');
await waitFor('document.querySelector(".carried")?.hidden === false', "click carry");
const toast = await evaluate('document.querySelector(".toast:not([hidden])")?.textContent ?? ""');
if (toast !== "Click to place · right-click or R to turn · Esc to cancel") {
  throw new Error(`Unexpected carry toast: ${toast}`);
}

await moveToCell(1, 1);
await rightClick('.cell[data-x="1"][data-y="1"]');
let dimensions = await evaluate(`(() => {
  const art = document.querySelector(".carried .mod");
  return art ? { width: art.getBoundingClientRect().width, height: art.getBoundingClientRect().height } : null;
})()`);
if (!dimensions || dimensions.height <= dimensions.width) throw new Error("Right-click did not turn the carried I vertical");

await evaluate('window.dispatchEvent(new KeyboardEvent("keydown", { key: "r", bubbles: true }))');
await sleep(100);
dimensions = await evaluate(`(() => {
  const art = document.querySelector(".carried .mod");
  return art ? { width: art.getBoundingClientRect().width, height: art.getBoundingClientRect().height } : null;
})()`);
if (!dimensions || dimensions.width <= dimensions.height) throw new Error("R did not turn the carried I horizontal");
await evaluate('window.dispatchEvent(new KeyboardEvent("keydown", { key: "R", bubbles: true }))');
await sleep(100);

const valid = await evaluate('document.querySelectorAll(".cell.is-ok").length');
if (valid !== 3) throw new Error(`Expected 3 valid carry cells, got ${valid}`);
await shot("controls-valid-carry");

await clickPointer('.cell[data-x="1"][data-y="1"]');
await waitFor(`Boolean(document.querySelector(\'.piece[data-uid="1"]\')) && document.querySelector(".carried")?.hidden === true`, "valid placement");

await clickPointer('.piece[data-uid="1"] .mod__cell[data-index="0"]');
await moveToCell(2, 0);
const invalid = await evaluate('document.querySelectorAll(".cell.is-bad").length');
if (invalid !== 3) throw new Error(`Expected 3 invalid carry cells, got ${invalid}`);
await shot("controls-invalid-carry");

await clickPointer('.cell[data-x="2"][data-y="0"]');
await waitFor('document.querySelector(".carried")?.hidden === false', "refused drop keeps carry active");
const refusal = await evaluate('document.querySelector(".toast:not([hidden])")?.textContent ?? ""');
if (refusal !== "It doesn't fit there") throw new Error(`Unexpected refusal toast: ${refusal}`);

await evaluate('window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))');
await waitFor('document.querySelector(".carried")?.hidden === true', "Escape cancel");
const restored = await evaluate(`(() => {
  const piece = document.querySelector('.piece[data-uid="1"]');
  if (!piece) return false;
  return !piece.classList.contains("is-carried") && piece.style.left.includes("* 1") && piece.style.top.includes("* 0");
})()`);
if (!restored) throw new Error("Escape did not restore the carried piece");

socket.close();
