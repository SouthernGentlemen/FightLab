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

await evaluate(`(async () => {
  const { newRun } = await import("/src/run/run.ts");
  const { place } = await import("/src/mods/grid.ts");
  const { writeSave } = await import("/src/run/save.ts");
  const run = newRun(21021);
  run.grid = place(run.grid, { uid: 1, mod: "pulse-line", stars: 2, rotation: 0, x: 0, y: 0 });
  run.grid = place(run.grid, { uid: 2, mod: "flashpoint", stars: 1, rotation: 0, x: 2, y: 2 });
  run.nextUid = 3;
  run.day = 9;
  run.trophies = 10;
  run.phase = "over";
  run.ending = "champion";
  run.record = { wins: 8, losses: 1, draws: 0, bestStyle: 3 };
  writeSave(run, null, localStorage);
  return true;
})()`);

await send("Page.navigate", { url: "http://127.0.0.1:5192/" });
await waitFor(".title");
const opened = await evaluate(`(() => {
  const button = [...document.querySelectorAll("button")].find((node) => node.textContent.trim().startsWith("Play"));
  if (!button) return false;
  button.click();
  return true;
})()`);
if (!opened) throw new Error("Could not resume the seeded run");
await waitFor(".runend");
await sleep(250);

const evidence = await evaluate(`(() => {
  const build = document.querySelector(".runend__build");
  const grid = document.querySelector(".runend__grid");
  if (!build || !grid) return null;
  return {
    viewport: [innerWidth, innerHeight],
    pieces: grid.querySelectorAll(".piece").length,
    buildBackground: getComputedStyle(build).backgroundColor,
    gridBackground: getComputedStyle(grid).backgroundColor,
  };
})()`);

if (!evidence || evidence.viewport[0] !== 1920 || evidence.viewport[1] !== 1080 || evidence.pieces !== 2) {
  throw new Error(`Run-end evidence incomplete: ${JSON.stringify(evidence)}`);
}

const image = await send("Page.captureScreenshot", {
  format: "png",
  fromSurface: true,
  captureBeyondViewport: false,
});
writeFileSync("screenshots/runend.png", Buffer.from(image.data, "base64"));
socket.close();
