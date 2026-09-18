import { button, h } from "./dom.ts";

export interface TitleActions {
  play(): void;
  settings(): void;
}

export function mountTitle(root: HTMLElement, actions: TitleActions): () => void {
  const play = button("Play", "button button--primary", actions.play);
  root.replaceChildren(h("main", { class: "screen menu" },
    h("h1", { class: "wordmark" }, "FIGHTLAB"),
    h("nav", { class: "menu__actions", "aria-label": "Main menu" }, play, button("Settings", "button", actions.settings)),
  ));
  play.focus();
  return () => root.replaceChildren();
}
