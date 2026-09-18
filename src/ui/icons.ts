/**
 * Original glyphs, drawn for FightLab on a 16-unit grid. Colour is never the only signal: every
 * action and every affinity has its own shape.
 */

const INK = "#1c2230";

function glyph(body: string): string {
  return `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">${body}</svg>`;
}

export const ICONS = {
  heart: glyph(`<path d="M8 14 2 8.5C0 6.5.6 3 3.6 3c1.8 0 3 1.2 4.4 2.6C9.4 4.2 10.6 3 12.4 3c3 0 3.6 3.5 1.6 5.5z" fill="#ef566b" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`),
  trophy: glyph(`<path d="M4 2h8v3a4 4 0 0 1-8 0zM4 3H1.5v1.5A2.5 2.5 0 0 0 4 7m8-4h2.5v1.5A2.5 2.5 0 0 1 12 7M6.5 9h3v2.5h-3zm-2 2.5h7V14h-7z" fill="#f8c630" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`),
  gear: glyph(`<path d="M7 1h2l.4 2 1.6.7 1.7-1.2 1.4 1.4-1.2 1.7.7 1.6 2 .4v2l-2 .4-.7 1.6 1.2 1.7-1.4 1.4-1.7-1.2-1.6.7L9 15H7l-.4-2-1.6-.7-1.7 1.2-1.4-1.4 1.2-1.7-.7-1.6-2-.4V7l2-.4.7-1.6-1.2-1.7 1.4-1.4 1.7 1.2L6.6 3z" fill="#e3e9ee" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/><circle cx="8" cy="8" r="2.2" fill="${INK}"/>`),
  exit: glyph(`<path d="M9 2H3v12h6M7 8h7m-3-3 3 3-3 3" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`),
  fullscreen: glyph(`<path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`),
  speed: glyph(`<path d="M1.5 3 8 8l-6.5 5zM8 3l6.5 5L8 13z" fill="#fff" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`),
  lock: glyph(`<path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2" fill="none" stroke="${INK}" stroke-width="1.8"/><rect x="3" y="7" width="10" height="7.5" rx="1.5" fill="#fff" stroke="${INK}" stroke-width="1.5"/><path d="M8 10v2" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`),
  dice: glyph(`<rect x="2" y="2" width="12" height="12" rx="3" fill="#fff" stroke="${INK}" stroke-width="1.5"/><circle cx="5.3" cy="5.3" r="1.2" fill="${INK}"/><circle cx="8" cy="8" r="1.2" fill="${INK}"/><circle cx="10.7" cy="10.7" r="1.2" fill="${INK}"/>`),
  mixup: glyph(`<path d="M2 5h9m-3-3 3 3-3 3M14 11H5m3-3-3 3 3 3" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`),

  strike: glyph(`<path d="M3 7h9.5A1.5 1.5 0 0 1 14 8.5V11a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" fill="#fff" stroke="${INK}" stroke-width="1.4"/><path d="M5 7V4.5M7.7 7V3.8M10.4 7V4.3M3 9.5h3" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/>`),
  tech: glyph(`<path d="M2 2.5h8V7H2z" fill="#fff" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/><path d="M6.5 7 12 14" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><path d="M10 4.8h3.5" stroke="${INK}" stroke-width="1.4"/>`),
  block: glyph(`<path d="M8 1.5 14 4v4c0 3.5-2.8 5.8-6 6.8C4.8 13.8 2 11.5 2 8V4z" fill="#fff" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/><path d="M8 4v8" stroke="${INK}" stroke-width="1.2"/>`),

  solar: glyph(`<circle cx="8" cy="8" r="3.4" fill="#fff" stroke="${INK}" stroke-width="1.4"/><path d="M8 .8v2.4M8 12.8v2.4M.8 8h2.4M12.8 8h2.4M2.9 2.9l1.7 1.7M11.4 11.4l1.7 1.7M2.9 13.1l1.7-1.7M11.4 4.6l1.7-1.7" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>`),
  void: glyph(`<circle cx="8" cy="8" r="6" fill="#fff" stroke="${INK}" stroke-width="1.4"/><path d="M8 3.5a4.5 4.5 0 1 0 4.2 6.1A3.4 3.4 0 1 1 8 3.5z" fill="${INK}"/>`),
  arc: glyph(`<path d="M9.5 1 3 9h4.5L6 15l7-8.5H8.5z" fill="#fff" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`),

  burn: glyph(`<path d="M8 1.5c.6 2.6 3.9 4 3.9 7.7A3.9 3.9 0 0 1 8 13.2a3.9 3.9 0 0 1-3.9-4c0-1.8 1.1-2.7 1.8-3.9.3 1.2.9 1.9 1.6 2.2C7.3 5.7 7.2 3.4 8 1.5z" fill="#ff8c42" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`),
  shock: glyph(`<path d="M9.5 1 3 9h4.5L6 15l7-8.5H8.5z" fill="#35d07f" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`),
  poison: glyph(`<path d="M8 1.5C6 5 3.5 7.3 3.5 10a4.5 4.5 0 0 0 9 0C12.5 7.3 10 5 8 1.5z" fill="#9b6bff" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/><circle cx="6.4" cy="10.2" r="1.1" fill="#fff"/>`),

  coin: glyph(`<circle cx="8" cy="8" r="6" fill="#fff" stroke="${INK}" stroke-width="1.4"/><path d="M10 5.8C9.5 5 8.8 4.8 8 4.8c-1.2 0-2 .6-2 1.5 0 2 4 1.2 4 3.3 0 .9-.9 1.6-2 1.6-.9 0-1.7-.3-2.1-1.1M8 3.6v8.8" fill="none" stroke="${INK}" stroke-width="1.2"/>`),
  ticket: glyph(`<path d="M1.5 4.5h13v2a1.5 1.5 0 0 0 0 3v2h-13v-2a1.5 1.5 0 0 0 0-3z" fill="#fff" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/><path d="M10 4.8v6.4" stroke="${INK}" stroke-width="1.1" stroke-dasharray="1.2 1"/>`),
  star: glyph(`<path d="m8 1.5 1.9 4.1 4.5.5-3.4 3 1 4.4L8 11.3l-3.9 2.2 1-4.4-3.4-3 4.5-.5z" fill="#fff" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`),
  chip: glyph(`<rect x="4" y="4" width="8" height="8" rx="1" fill="#fff" stroke="${INK}" stroke-width="1.4"/><path d="M6 1.5V4M10 1.5V4M6 12v2.5M10 12v2.5M1.5 6H4M1.5 10H4M12 6h2.5M12 10h2.5" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/><rect x="6.5" y="6.5" width="3" height="3" fill="${INK}"/>`),
} as const;

export type IconName = keyof typeof ICONS;
