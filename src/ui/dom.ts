import { ICONS } from "./icons.ts";
import type { IconName } from "./icons.ts";

type Child = Node | string;

/** A tiny element builder. The UI is small enough that this is the whole framework. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Readonly<Record<string, string | undefined>> = {},
  ...children: readonly Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) if (value !== undefined) node.setAttribute(name, value);
  node.append(...children);
  return node;
}

export function button(label: Child, className: string, onClick: () => void, attributes: Readonly<Record<string, string | undefined>> = {}): HTMLButtonElement {
  const node = h("button", { type: "button", class: className, ...attributes }, label);
  node.addEventListener("click", onClick);
  return node;
}

/** One of FightLab's own glyphs. The markup is a constant from `icons.ts`, never user data. */
export function icon(name: IconName, className = "icon"): HTMLSpanElement {
  const node = h("span", { class: className, "aria-hidden": "true" });
  node.innerHTML = ICONS[name];
  return node;
}

/** Writes text only when it changed, so a 60 Hz redraw does not churn the DOM. */
export function setText(node: Element, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

/** Sets a data attribute only when it changed, for the same reason. */
export function setData(node: HTMLElement, key: string, value: string): void {
  if (node.dataset[key] !== value) node.dataset[key] = value;
}

/** Plays a CSS animation class from the start, even if it is already running. */
export function replay(node: HTMLElement, className: string): void {
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
}
