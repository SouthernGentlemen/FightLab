import type { ModDefinition } from "../mods/registry.ts";
import { SHAPES, sizeOf } from "../mods/shapes.ts";
import { scaled } from "../mods/stars.ts";
import type { Stars } from "../mods/stars.ts";
import type { Per, Status } from "../mods/effects.ts";

export type EffectKind = "damage" | "burn" | "shock" | "poison" | "block" | "heal" | "cleanse" | "boost" | "income" | "reroll" | "style";

export interface EffectBadge {
  readonly kind: EffectKind;
  readonly text: string;
}

const STATUS: Readonly<Record<Status, string>> = { burn: "BURN", shock: "SHOCK", poison: "POISON" };

function amount(value: number, per: Per, cells: number): string {
  if (per === "cell") return String(value * cells);
  const scale: Readonly<Record<Exclude<Per, "cell">, string>> = {
    flat: "", adjacent: "/ADJ", "adjacent-same": "/SAME", "adjacent-other": "/OTHER",
    burn: "/BURN", shock: "/SHOCK", poison: "/POISON",
  };
  return `${value}${scale[per]}`;
}

/** Compact, truthful one-star or preview-star readouts from the same vocabulary combat compiles. */
export function effectBadges(definition: ModDefinition, stars: Stars): readonly EffectBadge[] {
  const { effect } = definition;
  if (effect.kind === "perk") {
    const value = scaled(effect.amount, stars);
    const kind = effect.perk === "free-reroll" ? "reroll" : effect.perk;
    const text = effect.perk === "income" ? `PAYDAY +$${value}`
      : effect.perk === "free-reroll" ? `REROLL +${value}` : `STYLE +${value}`;
    return [{ kind, text }];
  }
  if (effect.kind === "boost") {
    const target = effect.to === "adjacent-same" ? "/SAME" : "/ADJ";
    return [{ kind: "boost", text: `BOOST +${scaled(effect.amount, stars)}${target}` }];
  }

  const cells = sizeOf(SHAPES[definition.shape]);
  const condition = effect.when === undefined ? ""
    : effect.when.kind === "adjacent-to" ? ` IF ${effect.when.type.toUpperCase()}`
      : ` IF ${STATUS[effect.when.status]}`;
  return effect.payoffs.map((payoff): EffectBadge => {
    const value = amount(scaled(payoff.amount.value, stars), payoff.amount.per, cells);
    if (payoff.kind === "damage") {
      const block = definition.affinity === "block";
      return { kind: block ? "block" : "damage", text: `${block ? "BLOCK RIP" : "DMG"} +${value}${condition}` };
    }
    if (payoff.kind === "heal") return { kind: "heal", text: `HEAL +${value}${condition}` };
    if (payoff.kind === "cleanse") return { kind: "cleanse", text: `CLEANSE ${STATUS[payoff.status]} ${value}${condition}` };
    const kind = definition.type === "solar" ? "burn" : definition.type === "arc" ? "shock" : "poison";
    return { kind, text: `${STATUS[kind]} +${value}${condition}` };
  });
}

/** The edge treatment is neutral: rarity changes its geometry, while name colour still signals rarity. */
export function outlineSignature(definition: ModDefinition): string {
  return `${definition.type}/${definition.affinity ?? "none"}/${definition.shape}/${definition.rarity}`;
}

/** A small printed value on the occupied anchor cell, even on the packed board. */
export function pieceMark(badges: readonly EffectBadge[]): EffectBadge {
  return badges.find(({ kind }) => kind === "burn" || kind === "shock" || kind === "poison")
    ?? badges[0] ?? { kind: "damage", text: "" };
}

export function pieceMarkText(badges: readonly EffectBadge[]): string {
  const badge = pieceMark(badges);
  const value = badge.text.match(/\d+/)?.[0] ?? "";
  const prefix: Readonly<Record<EffectKind, string>> = {
    damage: "+", burn: "B", shock: "S", poison: "P", block: "R", heal: "H",
    cleanse: "C", boost: "+", income: "$", reroll: "R", style: "S",
  };
  return `${prefix[badge.kind]}${value}`;
}
