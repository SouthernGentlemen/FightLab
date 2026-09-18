import { SPEEDS } from "../game/clock.ts";
import { DEFAULT_SETTINGS } from "../game/settings.ts";
import type { Settings } from "../game/settings.ts";
import { button, h } from "./dom.ts";

export interface SettingsOptions {
  readonly settings: Settings;
  change(next: Settings): void;
  back(): void;
}

/** Only settings that work. Battle speed changes pacing, never outcomes. */
export function mountSettings(root: HTMLElement, options: SettingsOptions): () => void {
  const speeds = SPEEDS.map((speed) => button(`${speed}x`, "segment", () => apply({ ...current, speed })));
  let current = options.settings;

  function apply(next: Settings): void {
    current = next;
    options.change(next);
    speeds.forEach((node, index) => node.setAttribute("aria-pressed", String(SPEEDS[index] === next.speed)));
  }

  const back = button("Return", "button", options.back);
  root.replaceChildren(h("main", { class: "screen menu" },
    h("h1", { class: "menu__title" }, "Settings"),
    h("div", { class: "setting" },
      h("span", { class: "setting__label", id: "speed-label" }, "Battle speed"),
      h("div", { class: "segments", role: "group", "aria-labelledby": "speed-label" }, ...speeds),
    ),
    h("nav", { class: "menu__actions", "aria-label": "Settings actions" },
      button("Reset settings", "button", () => apply(DEFAULT_SETTINGS)),
      back,
    ),
  ));
  apply(current);
  back.focus();
  return () => root.replaceChildren();
}
