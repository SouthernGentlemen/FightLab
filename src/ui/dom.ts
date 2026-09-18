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

export function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const node = h("button", { type: "button", class: className }, label);
  node.addEventListener("click", onClick);
  return node;
}

/** Writes text only when it changed, so a 60 Hz redraw does not churn the DOM. */
export function setText(node: Element, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}
