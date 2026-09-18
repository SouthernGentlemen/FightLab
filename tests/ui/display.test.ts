import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { UNSUPPORTED_DISPLAY } from "../../src/ui/display.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const css = readFileSync(join(ROOT, "src/ui/styles.css"), "utf8");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

describe("the 16:9 composition", () => {
  it("scales one 1600 × 900 grid to the largest 16:9 rectangle, with no resolution cap", () => {
    expect(css).toMatch(/font-size:\s*calc\(min\(100vw,\s*100vh \* 16 \/ 9\) \/ 160\)/);
    expect(css).toMatch(/#app\s*\{[^}]*width:\s*160rem;\s*height:\s*90rem/);
    expect(css).not.toMatch(/max-width:\s*\d+px\s*[;}]/);
    expect(css).not.toMatch(/image-rendering/);
  });

  it("hides the playfield behind one card on exactly the displays the fight pauses for", () => {
    expect(css).toContain(`@media ${UNSUPPORTED_DISPLAY} {`);
    expect(html).toMatch(/class="unsupported"/);
    expect(html).toContain("Turn your device sideways");
  });

  it("draws the UI in the browser, at the device's resolution: no canvas, no bitmap art", () => {
    const sources = ["src/ui/fight.ts", "src/ui/prep.ts", "src/render/stage.ts"].map((path) => readFileSync(join(ROOT, path), "utf8"));
    for (const source of sources) expect(source).not.toMatch(/getContext\(|<canvas|createElement\("canvas"\)/);
  });
});
