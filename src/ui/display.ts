/**
 * When the display cannot show the 16:9 playfield — portrait, or too small to read — the stylesheet
 * hides it behind a single card, and nothing on it should advance. The same query is written in
 * `styles.css`; a test holds the two to each other.
 */
export const UNSUPPORTED_DISPLAY = "(orientation: portrait), (max-width: 559px), (max-height: 314px)";

export function presentable(): boolean {
  return !(globalThis.matchMedia?.(UNSUPPORTED_DISPLAY).matches ?? false);
}
