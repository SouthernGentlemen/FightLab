import { ACTION_TYPES, isActionType } from "../battle/actions.ts";
import type { ActionType } from "../battle/actions.ts";

/**
 * A mod's type: one or two tags from two families. An element is where a mod's energy comes from
 * and never means an action — Solar is not Strike. An action tag says when a mod fires: in an
 * exchange where its fighter plays that action.
 */

export const ELEMENTS = ["solar", "arc", "void", "neutral"] as const;
export type Element = (typeof ELEMENTS)[number];

/** The elements with a resource family of their own. Neutral has none and powers no lane. */
export const ELEMENTAL = ["solar", "arc", "void"] as const;
export type Elemental = (typeof ELEMENTAL)[number];

export type ModTag = Element | ActionType;
export const MOD_TAGS: readonly ModTag[] = [...ELEMENTS, ...ACTION_TYPES];

export const MAX_TAGS = 2;
export type ModTags = readonly [ModTag] | readonly [ModTag, ModTag];

export const TAG_LABEL: Readonly<Record<ModTag, string>> = {
  solar: "Solar", arc: "Arc", void: "Void", neutral: "Neutral", strike: "Strike", tech: "Tech", block: "Block",
};

export function isElement(value: unknown): value is Element {
  return typeof value === "string" && (ELEMENTS as readonly string[]).includes(value);
}

export function isElemental(value: unknown): value is Elemental {
  return typeof value === "string" && (ELEMENTAL as readonly string[]).includes(value);
}

export function isModTag(value: unknown): value is ModTag {
  return isElement(value) || isActionType(value);
}

/**
 * Why a list is not a mod's tags, or null when it is: one or two known tags, no repeats, at least one
 * element, never two actions, and Neutral alone among the elements. Two different elements make a
 * hybrid, which the model allows even though the first catalogue has only two.
 */
export function tagProblem(tags: readonly unknown[]): string | null {
  if (tags.length < 1 || tags.length > MAX_TAGS) return `a mod has one or two tags, not ${tags.length}`;
  const unknown = tags.find((tag) => !isModTag(tag));
  if (unknown !== undefined) return `'${String(unknown)}' is not a tag`;
  if (new Set(tags).size !== tags.length) return "a tag appears twice";
  const elements = tags.filter(isElement);
  if (elements.length === 0) return "a mod needs an element";
  if (elements.includes("neutral") && elements.length > 1) return "Neutral pairs with no other element";
  return null;
}

export function isModTags(value: unknown): value is ModTags {
  return Array.isArray(value) && tagProblem(value) === null;
}

export function elementsOf(tags: ModTags): Element[] {
  return tags.filter(isElement);
}

/** The action a mod fires on, or null for one that fires in every exchange. */
export function actionOf(tags: ModTags): ActionType | null {
  return tags.find(isActionType) ?? null;
}

/** `SOLAR / STRIKE`: how a mod's type is written wherever it is shown. */
export function tagLine(tags: ModTags): string {
  return tags.map((tag) => TAG_LABEL[tag].toUpperCase()).join(" / ");
}

/**
 * How a tile is filled: one colour per tag, in tag order, split half and half on the diagonal when
 * there are two. Colour is never the only signal: the tags are always written out beside it.
 */
export interface TileFill {
  readonly split: boolean;
  readonly colors: ModTags;
}

export function tileFill(tags: ModTags): TileFill {
  return { split: tags.length === 2, colors: tags };
}
