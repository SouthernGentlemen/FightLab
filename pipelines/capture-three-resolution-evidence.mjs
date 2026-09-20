import { mkdirSync, writeFileSync } from "node:fs";

mkdirSync("screenshots/tasks-047", { recursive: true });

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
const waitFor = async (selector, attempts = 120) => {
  for (let attempt = 0; attempt < attempts; attempt++) {
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
const viewport = async (width, height) => {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  await sleep(150);
  const state = await evaluate(`(() => {
    const app = document.querySelector("#app");
    const box = app?.getBoundingClientRect();
    const rootFont = parseFloat(getComputedStyle(document.documentElement).fontSize);
    return {
      width: innerWidth, height: innerHeight, rootFont, dpr: devicePixelRatio,
      app: box ? [box.left, box.top, box.width, box.height] : null,
      transform: app ? getComputedStyle(app).transform : null,
      scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
    };
  })()`);
  const expected = width / 160;
  if (state.width !== width || state.height !== height) throw new Error(`Viewport mismatch: ${JSON.stringify(state)}`);
  if (Math.abs(state.rootFont - expected) > 0.01) throw new Error(`Root font ${state.rootFont}px, expected ${expected}px at ${width}x${height}`);
  if (state.dpr !== 1 || state.transform !== "none") throw new Error(`Non-crisp root scaling: ${JSON.stringify(state)}`);
  if (!state.app || Math.abs(state.app[2] - width) > 0.5 || Math.abs(state.app[3] - height) > 0.5) {
    throw new Error(`App is not the full 16:9 viewport: ${JSON.stringify(state)}`);
  }
  if (state.scroll[0] > width || state.scroll[1] > height) throw new Error(`Document overflow: ${JSON.stringify(state)}`);
};
const shot = async (name) => {
  const image = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  writeFileSync(`screenshots/tasks-047/${name}.png`, Buffer.from(image.data, "base64"));
};
const reload = async () => {
  await send("Page.navigate", { url: "http://127.0.0.1:5192/" });
  await waitFor(".title");
};
const seed = async (body) => {
  await evaluate(`(async () => {
    localStorage.clear();
    ${body}
    return true;
  })()`);
  await reload();
};

await send("Page.enable");
await send("Runtime.enable");

const sizes = [[1920, 1080], [2560, 1440], [3840, 2160]];
for (const [width, height] of sizes) {
  const tag = `${width}x${height}`;
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  await evaluate("localStorage.clear()");
  await reload();
  await viewport(width, height);
  await clickText("Armory");
  await waitFor(".armory");
  await evaluate(`document.querySelector('[data-mod="ember-edge"]')?.click()`);
  await sleep(150);
  await waitFor(".card");
  await shot(`${tag}-catalogue`);
  await evaluate(`document.querySelector('[data-control="filter"]')?.click()`);
  await waitFor(".filter-modal:not([hidden])");
  await shot(`${tag}-catalogue-filter`);

  await seed(`
    const { newRun } = await import("/src/run/run.ts");
    const { place, setBankSlot } = await import("/src/mods/grid.ts");
    const { writeSave } = await import("/src/run/save.ts");
    const run = newRun(47);
    run.money = 30;
    run.grid = place(run.grid, { uid: 1, mod: "brand-needle", stars: 1, rotation: 0, x: 0, y: 0 });
    run.bank = setBankSlot(run.bank, 0, { uid: 2, mod: "flashpoint", stars: 1, rotation: 0 });
    run.nextUid = 3;
    run.shop = { ...run.shop, offers: ["searpoint", "spark-wire", "blight-fang", "hardpoint", null] };
    writeSave(run, null, localStorage);
  `);
  await clickText("Play");
  await waitFor(".prep");
  const hovered = await evaluate(`(() => {
    const offer = document.querySelector('.shop .offer[data-offer="0"]');
    if (!offer) return false;
    offer.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }));
    return true;
  })()`);
  if (!hovered) throw new Error("Could not hover a shop offer");
  await waitFor(".tip:not([hidden])");
  await shot(`${tag}-prep-tooltip`);

  const startDrag = await evaluate(`(() => {
    const source = document.querySelector('.slot[data-bank="0"] .mod__cell') || document.querySelector('.slot[data-bank="0"]');
    const target = document.querySelector('.cell[data-x="3"][data-y="3"]');
    if (!source || !target) return false;
    const a = source.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    source.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, clientX: a.left + a.width / 2, clientY: a.top + a.height / 2 }));
    window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, buttons: 1, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 }));
    return true;
  })()`);
  if (!startDrag) throw new Error("Could not start Prep drag");
  await waitFor('.ghost[data-placement="valid"]');
  await shot(`${tag}-prep-valid-carry`);
  await evaluate(`(() => {
    const target = document.querySelector('.cell[data-x="0"][data-y="0"]');
    const b = target.getBoundingClientRect();
    window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, buttons: 1, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 }));
  })()`);
  await waitFor('.ghost[data-placement="invalid"]');
  await shot(`${tag}-prep-invalid-carry`);
  await evaluate(`window.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true }))`);

  await seed(`
    const { newRun, beginFight } = await import("/src/run/run.ts");
    const { place } = await import("/src/mods/grid.ts");
    const { writeSave } = await import("/src/run/save.ts");
    const run = newRun(8080);
    run.grid = place(run.grid, { uid: 1, mod: "flashpoint", stars: 1, rotation: 0, x: 0, y: 0 });
    run.grid = place(run.grid, { uid: 2, mod: "brand-needle", stars: 1, rotation: 0, x: 1, y: 0 });
    run.nextUid = 3;
    beginFight(run);
    writeSave(run, { decisions: [] }, localStorage);
  `);
  await clickText("Play");
  await waitFor(".fight");
  await waitFor('.debuff[data-debuff="burn"]:not([hidden])', 200);
  await shot(`${tag}-fight-status`);

  await seed(`
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
  `);
  await clickText("Play");
  await waitFor(".runend");
  await shot(`${tag}-runend`);

  await viewport(width, height);
}

socket.close();
