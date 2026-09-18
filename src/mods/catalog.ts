import type { ActionType } from "../battle/actions.ts";
import type { ShapeId } from "./shapes.ts";

/**
 * The sixteen mods. A mod is data — a shape, an affinity, a tier, a price and at most one perk —
 * and has no code of its own; `compileBuild` is the only thing that reads what it does.
 */

/** A mod property, never an action: Solar is not Strike, Void is not Block, Arc is not Tech. */
export type ModAffinity = "solar" | "void" | "arc" | "neutral";
export const MOD_AFFINITIES: readonly ModAffinity[] = ["solar", "void", "arc", "neutral"];
/** The affinities that power lanes, attune rows and count towards levels. */
export const ELEMENTS = ["solar", "void", "arc"] as const;
export type Element = (typeof ELEMENTS)[number];

export type Tier = 1 | 2 | 3 | 4;
export const TIERS: readonly Tier[] = [1, 2, 3, 4];

/** Everything a perk may do. None of it can change a frame count, an action order or a bar. */
export type Perk =
  /** Extra damage on every hit of one action; Block's is the riposte. */
  | { readonly kind: "damage"; readonly action: ActionType; readonly amount: number }
  /** Extra damage on every hit. */
  | { readonly kind: "every-hit"; readonly amount: number }
  /** Extra damage on every hit in a round the fighter entered with a Mixup. */
  | { readonly kind: "surge"; readonly amount: number }
  | { readonly kind: "parry-heal"; readonly amount: number }
  | { readonly kind: "income"; readonly amount: number }
  | { readonly kind: "free-reroll"; readonly amount: number }
  /** Adds the style payout once more. */
  | { readonly kind: "style-payout" }
  /** Each element cell of every mod touching this one powers its lane one more. */
  | { readonly kind: "overclock" };

export interface ModDefinition {
  readonly id: string;
  readonly name: string;
  readonly affinity: ModAffinity;
  readonly tier: Tier;
  readonly price: number;
  readonly shape: ShapeId;
  readonly perk: Perk | null;
  /** The perk in words, for tooltips; empty when there is none. */
  readonly text: string;
}

function mod(id: string, name: string, affinity: ModAffinity, tier: Tier, price: number, shape: ShapeId, perk: Perk | null, text = ""): ModDefinition {
  return Object.freeze({ id, name, affinity, tier, price, shape, perk: perk && Object.freeze(perk), text });
}

const LIST = [
  mod("ember", "Ember", "solar", 1, 3, "mono", null),
  mod("sunburst", "Sunburst", "solar", 1, 4, "duo", null),
  mod("flare", "Flare", "solar", 2, 5, "l3", { kind: "damage", action: "strike", amount: 2 }, "Jab +2"),
  mod("corona", "Corona", "solar", 3, 7, "t4", { kind: "every-hit", amount: 2 }, "Every hit +2"),
  mod("shade", "Shade", "void", 1, 3, "mono", null),
  mod("nightfall", "Nightfall", "void", 1, 4, "duo", null),
  mod("eclipse", "Eclipse", "void", 2, 5, "l3", { kind: "parry-heal", amount: 5 }, "A successful parry heals 5"),
  mod("event-horizon", "Event Horizon", "void", 3, 7, "o4", { kind: "damage", action: "block", amount: 5 }, "Riposte +5"),
  mod("spark", "Spark", "arc", 1, 3, "mono", null),
  mod("coil", "Coil", "arc", 1, 4, "duo", null),
  mod("static", "Static", "arc", 2, 5, "i3", { kind: "damage", action: "tech", amount: 2 }, "Overhead +2"),
  mod("thunderclap", "Thunderclap", "arc", 3, 7, "l4", { kind: "surge", amount: 3 }, "Every hit +3 in a round you entered with a Mixup"),
  mod("piggy-bank", "Piggy Bank", "neutral", 1, 3, "mono", { kind: "income", amount: 1 }, "+$1 every payday"),
  mod("coupon", "Coupon", "neutral", 2, 4, "mono", { kind: "free-reroll", amount: 1 }, "The first reroll each day is free"),
  mod("crowd-pleaser", "Crowd Pleaser", "neutral", 2, 5, "duo", { kind: "style-payout" }, "Style payout doubled"),
  mod("overclock", "Overclock", "neutral", 4, 8, "mono", { kind: "overclock" }, "Each cell of every mod touching it powers +1 more"),
] as const;

export type ModId = (typeof LIST)[number]["id"];

export const CATALOG: Readonly<Record<ModId, ModDefinition>> = Object.freeze(
  Object.fromEntries(LIST.map((definition) => [definition.id, definition])) as Record<ModId, ModDefinition>,
);

/** Catalogue order, which is also the order a shop draws within a tier. */
export const MOD_IDS: readonly ModId[] = Object.freeze(LIST.map((definition) => definition.id));

export function isModId(value: unknown): value is ModId {
  return typeof value === "string" && Object.hasOwn(CATALOG, value);
}

export function isElement(affinity: ModAffinity): affinity is Element {
  return affinity !== "neutral";
}
