import { SPEEDS } from "../game/clock.ts";
import { DEFAULT_SETTINGS } from "../game/settings.ts";
import type { Settings } from "../game/settings.ts";
import { button, h } from "./dom.ts";
import { bevel, panel } from "./kit.ts";
import { fullscreenSupported, toggleFullscreen } from "./title.ts";

export interface SettingsOptions {
  readonly settings: Settings;
  change(next: Settings): void;
  back(): void;
}

/** Only settings that work. Battle speed changes pacing, never outcomes. */
export function mountSettings(root: HTMLElement, options: SettingsOptions): () => void {
  const speeds = SPEEDS.map((speed) => button(`${speed}×`, "segment", () => apply({ ...current, speed })));
  let current = options.settings;

  function apply(next: Settings): void {
    current = next;
    options.change(next);
    speeds.forEach((node, index) => node.setAttribute("aria-pressed", String(SPEEDS[index] === next.speed)));
  }

  const back = bevel("Return", "rose", options.back);
  root.replaceChildren(h("main", { class: "screen settings teal" },
    panel("Settings", "sun", [],
      h("div", { class: "setting" },
        h("span", { class: "setting__label", id: "speed-label" }, "Battle speed"),
        h("div", { class: "segments", role: "group", "aria-labelledby": "speed-label" }, ...speeds)),
      ...(fullscreenSupported() ? [h("div", { class: "setting" }, h("span", { class: "setting__label" }, "Display"),
        bevel("Fullscreen", "paper", toggleFullscreen, "btn--sm"))] : []),
      h("nav", { class: "settings__actions", "aria-label": "Settings actions" },
        bevel("Reset settings", "paper", () => apply(DEFAULT_SETTINGS), "btn--sm"), back))));
  apply(current);
  back.focus();
  return () => root.replaceChildren();
}
