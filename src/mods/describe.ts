import type { Effect, LegacyPayoff, Resource } from "./effects.ts";
import type { ModDefinition } from "./registry.ts";
import { scaled } from "./stars.ts";
import type { Stars } from "./stars.ts";
import { AFFINITY_LABEL } from "./tags.ts";

/**
 * A mod's rules in words, written from its effects at one star level, so what the shop, the grid
 * and the Armory say is exactly what the engine does. Nothing here is stored anywhere.
 */

const RESOURCE: Readonly<Record<Resource, string>> = { heat: "Heat", charge: "Charge", void: "Void" };

const plural = (count: number, one: string, many = `${one}s`): string => `${count} ${count === 1 ? one : many}`;

function payoffText(payoff: LegacyPayoff, stars: Stars, blocks: boolean): string {
  const amount = scaled(payoff.amount, stars);
  switch (payoff.kind) {
    case "damage": return `+${amount} ${blocks ? "riposte damage" : "damage"}`;
    case "heal": return `heals ${amount} on a parry`;
    case "debuff": return `${amount} ${TAG_DEBUFF[payoff.debuff]} on the opponent`;
    case "cleanse": return `removes ${amount} of your ${TAG_DEBUFF[payoff.debuff]}`;
  }
}

const TAG_DEBUFF = { burn: "Burn", shock: "Shock", poison: "Poison" } as const;

function effectText(effect: Effect, stars: Stars, blocks: boolean): string {
  const at = (values: readonly [number, number, number]) => scaled(values, stars);
  switch (effect.kind) {
    case "generate": return `Makes ${at(effect.amount)} ${RESOURCE[effect.resource]}${effect.perAdjacent ? `, +${at(effect.perAdjacent)} for every adjacent mod` : ""}.`;
    case "leech": return `Drains ${at(effect.amount)} of the opponent's ${effect.from === "either" ? "Heat or Charge, whichever they hold more of," : RESOURCE[effect.from]} into Void.`;
    case "convert": return `Turns up to ${at(effect.amount)} of your ${RESOURCE[effect.from]} into ${RESOURCE[effect.to]}.`;
    case "spend": return `Spends ${at(effect.cost)} ${RESOURCE[effect.resource]}: ${effect.payoff.map((payoff) => payoffText(payoff, stars, blocks)).join(", ")}.`;
    case "sink": return `Sinks up to ${at(effect.upTo)} ${RESOURCE[effect.resource]}; for each one, ${effect.per.map((payoff) => payoffText(payoff, stars, blocks)).join(", ")}.`;
    case "refund": return `Gives back ${at(effect.amount)} Charge each time an adjacent mod spends Charge.`;
    case "accrue": return `+${at(effect.amount)} Void when each round ends.`;
    case "capacity": return `Stores ${at(effect.amount)} more Charge.`;
    case "lane-boost": return `Each elemental cell of every mod touching it powers its lane +${at(effect.amount)}.`;
    case "income": return `+$${at(effect.amount)} every payday.`;
    case "free-reroll": return `${plural(at(effect.amount), "free reroll")} every day.`;
    case "style": return `Style pays out ${plural(at(effect.amount), "more time")}.`;
  }
}

/** When the mod fires, and what its debuffs wait for. */
export function firingLine(definition: ModDefinition): string {
  const action = definition.affinity;
  if (definition.effects.every((effect) => ["capacity", "lane-boost", "income", "free-reroll", "style"].includes(effect.kind))) return "Always on.";
  if (action === null) return "Fires in every exchange.";
  const waits = action === "block" ? "its payoffs land if your guard holds" : "its debuffs land if the hit does";
  return `Fires when you ${AFFINITY_LABEL[action]}; ${waits}.`;
}

/** Every rule of the mod at `stars`, one sentence each, firing line first. */
export function effectLines(definition: ModDefinition, stars: Stars): string[] {
  const blocks = definition.affinity === "block";
  return [firingLine(definition), ...definition.effects.map((effect) => effectText(effect, stars, blocks))];
}
