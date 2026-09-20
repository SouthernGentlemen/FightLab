export interface Oklab {
  readonly l: number;
  readonly a: number;
  readonly b: number;
}

function channel(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

export function rgb(hex: string): readonly [number, number, number] {
  const value = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) throw new Error(`Expected #rrggbb, got ${hex}`);
  return [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16)) as unknown as readonly [number, number, number];
}

export function relativeLuminance(hex: string): number {
  const [red, green, blue] = rgb(hex).map(channel);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

export function toOklab(hex: string): Oklab {
  const [red, green, blue] = rgb(hex).map(channel);
  const l = 0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue;
  const m = 0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue;
  const s = 0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue;
  const lr = Math.cbrt(l);
  const mr = Math.cbrt(m);
  const sr = Math.cbrt(s);
  return {
    l: 0.2104542553 * lr + 0.7936177850 * mr - 0.0040720468 * sr,
    a: 1.9779984951 * lr - 2.4285922050 * mr + 0.4505937099 * sr,
    b: 0.0259040371 * lr + 0.7827717662 * mr - 0.8086757660 * sr,
  };
}

export function oklabDeltaE(first: string, second: string): number {
  const a = toOklab(first);
  const b = toOklab(second);
  return Math.hypot(a.l - b.l, a.a - b.a, a.b - b.b);
}
