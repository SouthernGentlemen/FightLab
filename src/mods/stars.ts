/**
 * Stars are a mod's upgrade level, and nothing else: ★, ★★ or ★★★. Three ★ copies of a mod combine
 * into one ★★, two ★★ into one ★★★, so a ★★★ is six copies. The mod stays itself and keeps its
 * rarity; stars only make its own numbers bigger.
 */

export type Stars = 1 | 2 | 3;
export const STARS: readonly Stars[] = [1, 2, 3];
export const MAX_STARS: Stars = 3;

/** A number a mod scales with its stars: its value at ★, ★★ and ★★★. */
export type Scaled = readonly [number, number, number];

export interface Recipe {
  readonly from: Stars;
  readonly count: number;
  readonly to: Stars;
}

/** The only two ways to combine. */
export const RECIPES: readonly Recipe[] = Object.freeze([
  Object.freeze({ from: 1, count: 3, to: 2 }),
  Object.freeze({ from: 2, count: 2, to: 3 }),
]);

export function isStars(value: unknown): value is Stars {
  return value === 1 || value === 2 || value === 3;
}

export function scaled(values: Scaled, stars: Stars): number {
  return values[stars - 1];
}

/** The recipe that makes `stars`, or null for ★, which is only ever bought. */
export function recipeFor(stars: Stars): Recipe | null {
  return RECIPES.find((recipe) => recipe.to === stars) ?? null;
}

/** How many ★ copies went into one mod of this level: 1, 3 or 6. */
export function copiesIn(stars: Stars): number {
  const recipe = recipeFor(stars);
  return recipe === null ? 1 : recipe.count * copiesIn(recipe.from);
}

export type StarCounts = Readonly<Record<Stars, number>>;

/** Combines everything that can be combined, lowest level first. Copies are never lost or made. */
export function combineAll(counts: StarCounts): StarCounts {
  const next = { 1: counts[1], 2: counts[2], 3: counts[3] };
  for (const { from, count, to } of RECIPES) {
    const made = Math.floor(next[from] / count);
    next[from] -= made * count;
    next[to] += made;
  }
  return next;
}

/** The highest level `copies` ★ copies can combine into; ★ when there are none, as a preview. */
export function bestStars(copies: number): Stars {
  return [...STARS].reverse().find((stars) => copiesIn(stars) <= copies) ?? 1;
}

export function starText(stars: Stars): string {
  return "★".repeat(stars);
}
