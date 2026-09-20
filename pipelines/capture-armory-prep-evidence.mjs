const { writeFileSync } = await import("node:fs");
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

await send("Page.navigate", { url: "http://127.0.0.1:5192/" });
await waitFor(".title");
await clickText("Armory");
await waitFor(".armory");
const selected = await evaluate(`(() => {
  const node = document.querySelector('[data-mod="ember-edge"]');
  if (!node) return false;
  node.click();
  return true;
})()`);
if (!selected) throw new Error("Could not select Cinder Edge in the Armory");
await sleep(250);
const armoryState = await evaluate(`(() => {
  const catalog = document.querySelector('[data-mod="ember-edge"]');
  const detail = document.querySelector(".card");
  if (!catalog || !detail) return null;
  const cells = [...catalog.querySelectorAll(".catalog-card__cell")];
  const cellSizes = cells.map((cell) => {
    const style = getComputedStyle(cell);
    return [style.width, style.height];
  });
  const name = catalog.querySelector(".catalog-card__name");
  return {
    visibleText: name?.textContent?.trim() ?? "",
    label: catalog.getAttribute("aria-label") ?? "",
    cells: cells.length,
    cellSizes,
    actions: catalog.querySelectorAll(".catalog-card__action").length,
    pips: catalog.querySelectorAll(".catalog-card__pip").length,
    legacy: document.querySelectorAll(".tile, .square, [class*='tile__'], [class*='square__']").length,
    repeatedCardLabels: detail.querySelectorAll(".card__rarity, .tagchips").length,
    statBlocks: detail.querySelectorAll(".card__table, .card__profile").length,
    cardText: detail.textContent ?? "",
    nameOverflow: name ? getComputedStyle(name).textOverflow : "",
    nameWhiteSpace: name ? getComputedStyle(name).whiteSpace : "",
  };
})()`);
if (!armoryState) throw new Error("Could not inspect Armory catalogue card state");
if (armoryState.totalCards !== 64 || armoryState.columns !== 4 || armoryState.totalCards / armoryState.columns !== 16) {
  throw new Error(`Expected 64 catalogue cards in 16 rows of four: ${JSON.stringify(armoryState)}`);
}
if (armoryState.visibleText !== "Cinder Edge") throw new Error(`Catalogue card name is wrong: ${armoryState.visibleText}`);
if (!/^Cinder Edge, Solar, Strike affinity, domino, Uncommon$/.test(armoryState.label)) {
  throw new Error(`Catalogue card accessible label is incomplete: ${armoryState.label}`);
}
if (armoryState.cells !== 2 || armoryState.cellSizes.some(([width, height]) => width !== height)) {
  throw new Error(`Catalogue shape cells are not the expected uniform domino: ${JSON.stringify(armoryState)}`);
}
if (armoryState.actions > 1 || armoryState.pips !== 3 || armoryState.legacy !== 0) {
  throw new Error(`Catalogue card contract failed: ${JSON.stringify(armoryState)}`);
}
if (armoryState.nameOverflow !== "ellipsis" || armoryState.nameWhiteSpace !== "nowrap") {
  throw new Error(`Catalogue name is not one-line ellipsis: ${JSON.stringify(armoryState)}`);
}
if (armoryState.repeatedCardLabels !== 0) throw new Error("Armory detail still repeats rarity/type labels");
if (armoryState.statBlocks !== 0) throw new Error("Armory detail still renders energy/number stat blocks");
if (/\bports?\b|Orientation/i.test(armoryState.cardText)) {
  throw new Error(`Armory detail still exposes port/orientation text: ${armoryState.cardText}`);
}
await shot("armory");

const longName = await evaluate(`(() => {
  const catalog = document.querySelector('[data-mod="ember-edge"]');
  const name = catalog?.querySelector(".catalog-card__name");
  if (!catalog || !name) return null;
  name.textContent = "12345678901234567890123456789012";
  const style = getComputedStyle(name);
  return {
    length: name.textContent.length,
    overflowed: name.scrollWidth > name.clientWidth,
    oneLine: style.whiteSpace === "nowrap",
    cardContained: catalog.scrollWidth <= catalog.clientWidth,
    textOverflow: style.textOverflow,
  };
})()`);
if (!longName || longName.length !== 32 || !longName.overflowed || !longName.oneLine || !longName.cardContained || longName.textOverflow !== "ellipsis") {
  throw new Error(`32-character catalogue name broke the layout: ${JSON.stringify(longName)}`);
}
await shot("armory-long-name");

let prepSeed = null;
for (let seed = 1; seed <= 40; seed++) {
  await evaluate("localStorage.clear()");
  await send("Page.navigate", { url: `http://127.0.0.1:5192/?seed=${seed}` });
  await sleep(100);
  await waitFor(".title");
  await clickText("Play");
  await waitFor(".prep");
  const hasSolarStrike = await evaluate(
    'Boolean(document.querySelector(".shop .mod[data-type=solar][data-affinity=strike]"))'
  );
  if (hasSolarStrike) {
    prepSeed = seed;
    break;
  }
}
if (prepSeed === null) throw new Error("No Solar Strike offer found in seeds 1-40");
const tipOpened = await evaluate(`(() => {
  const art = document.querySelector(".shop .mod[data-type=solar][data-affinity=strike]");
  const offer = art?.closest(".offer");
  if (!offer) return false;
  offer.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }));
  return true;
})()`);
if (!tipOpened) throw new Error("Could not hover the Solar Strike offer for tooltip evidence");
await waitFor(".tip:not([hidden])");
await sleep(250);
const prepState = await evaluate(`(() => {
  const tip = document.querySelector(".tip:not([hidden])");
  const art = document.querySelector(".shop .mod[data-type=solar][data-affinity=strike]");
  const offer = art?.closest(".offer");
  if (!tip || !offer) return null;
  const stats = document.querySelector(".bars__stats");
  return {
    tipText: tip.textContent ?? "",
    repeatedMeta: tip.querySelectorAll(".tip__meta").length,
    energyCounters: document.querySelectorAll(".levels, .level, [data-element]").length,
    statsText: stats?.textContent ?? "",
    offerLabel: offer.getAttribute("aria-label") ?? "",
  };
})()`);
if (!prepState) throw new Error("Could not inspect Prep task-006 state");
if (/\bports?\b|in-port|out-port/i.test(prepState.tipText)) {
  throw new Error(`Prep tooltip still exposes port text: ${prepState.tipText}`);
}
if (prepState.repeatedMeta !== 0) throw new Error("Prep tooltip still repeats type/rarity metadata");
if (prepState.energyCounters !== 0) throw new Error("Prep still renders element counters or their tooltip targets");
if (!/^♥ \d+ health$/.test(prepState.statsText) || /Charge|Heat|Void/.test(prepState.statsText)) {
  throw new Error(`Prep stats still expose energy state: ${prepState.statsText}`);
}
if (!/^[^,]+, (Solar|Arc|Void|Neutral), (Strike|Tech|Block) affinity, .+, (Common|Uncommon|Rare|Super Rare|Legendary), 1 star$/.test(prepState.offerLabel)) {
  throw new Error(`Prep offer accessible label is incomplete: ${prepState.offerLabel}`);
}
await shot("prep");

socket.close();
