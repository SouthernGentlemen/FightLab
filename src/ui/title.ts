import { h } from "./dom.ts";
import { bevel, iconButton } from "./kit.ts";

export interface TitleActions {
  /** Whether a saved run exists to continue. */
  readonly saved: boolean;
  continueRun(): void;
  newRun(): void;
  armory(): void;
  settings(): void;
}

export function fullscreenSupported(): boolean {
  return document.fullscreenEnabled === true;
}

/** Fills the display where the browser allows it. The game is one 16:9 picture either way. */
export function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  else void document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
}

export function mountTitle(root: HTMLElement, actions: TitleActions): () => void {
  const buttons = h("nav", { class: "title__actions", "aria-label": "Main menu" });
  // Play picks up a saved run or starts one; a saved run can still be abandoned, below the rest.
  const menu = (): void => {
    const play = bevel("Play", "rose", actions.saved ? actions.continueRun : actions.newRun);
    if (actions.saved) play.append(h("small", {}, "Continue your run"));
    const items = [play, bevel("Armory", "sky", actions.armory), bevel("Settings", "paper", actions.settings),
      ...(actions.saved ? [bevel("New run", "paper", confirm, "btn--sm title__fresh")] : [])];
    buttons.replaceChildren(...items);
    play.focus();
  };
  // Starting over throws the saved run away, so it asks first.
  const confirm = (): void => {
    const keep = bevel("Keep it", "paper", menu);
    buttons.replaceChildren(h("p", { class: "title__confirm stroke" }, "Abandon the run in progress?"), bevel("Start over", "rose", actions.newRun), keep);
    keep.focus();
  };
  root.replaceChildren(h("main", { class: "screen title teal" },
    ...(fullscreenSupported() ? [h("div", { class: "title__corner" }, iconButton("fullscreen", "Fullscreen", toggleFullscreen))] : []),
    h("h1", { class: "wordmark stroke" }, "FightLab"),
    h("p", { class: "title__tagline stroke" }, "Build two plans. Read your opponent. Mix up."),
    buttons));
  menu();
  return () => root.replaceChildren();
}
