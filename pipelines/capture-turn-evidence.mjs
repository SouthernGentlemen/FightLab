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

const waitFor = async (selector) => {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`)) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${selector}`);
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
  const { writeSave } = await import("/src/run/save.ts");
  const run = newRun(12012);
  run.grid = Object.freeze([{ uid: 1, mod: "chain-circuit", stars: 1, rotation: 0, x: 0, y: 0 }]);
  run.nextUid = 2;
  writeSave(run, null, localStorage);
  return true;
})()`);

await send("Page.navigate", { url: "http://127.0.0.1:5192/" });
await waitFor(".title");
await clickText("Continue");
await waitFor('.piece[data-uid="1"]');
await sleep(150);

const measure = async () => evaluate(`(() => {
  const piece = document.querySelector('.piece[data-uid="1"]');
  const cell = piece?.querySelector('.mod__cell[data-index="0"]');
  if (!piece || !cell) return null;
  const box = piece.getBoundingClientRect();
  const pivot = cell.getBoundingClientRect();
  return {
    width: box.width,
    height: box.height,
    pivotX: pivot.left + pivot.width / 2,
    pivotY: pivot.top + pivot.height / 2,
  };
})()`);

const before = await measure();
if (!before || before.width <= before.height) throw new Error("Straight I did not start horizontal");
await shot("prep-i-before");

const turned = await evaluate(`(() => {
  const cell = document.querySelector('.piece[data-uid="1"] .mod__cell[data-index="0"]');
  if (!cell) return false;
  const rect = cell.getBoundingClientRect();
  cell.dispatchEvent(new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    button: 2,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  }));
  return true;
})()`);
if (!turned) throw new Error("Could not right-click the straight I");
await sleep(150);

const after = await measure();
if (!after || after.height <= after.width) throw new Error("Straight I did not turn vertical");
if (Math.abs(after.pivotX - before.pivotX) > 0.5 || Math.abs(after.pivotY - before.pivotY) > 0.5) {
  throw new Error(`Straight I pivot jumped from ${before.pivotX},${before.pivotY} to ${after.pivotX},${after.pivotY}`);
}
await shot("prep-i-after");

socket.close();
