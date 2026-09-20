import type {
  Amount,
  Condition,
  Effect,
  LegacyPayoff,
  ModEffect,
  Payoff,
  Resource,
  Status,
} from "./effects.ts";
import type { ModDefinition } from "./registry.ts";
import { scaled } from "./stars.ts";
import type { Stars } from "./stars.ts";
import { AFFINITY_LABEL, TYPE_LABEL } from "./tags.ts";

const RESOURCE: Readonly<Record<Resource, string>> = {
  heat: "Heat",
  charge: "Charge",
  void: "Void",
};
const STATUS: Readonly<Record<Status, string>> = {
  burn: "Burn",
  shock: "Shock",
  poison: "Poison",
};
const LINE_LIMIT = 60;

const plural = (count: number, one: string, many = `${one}s`): string =>
  `${count} ${count === 1 ? one : many}`;

function legacyPayoffText(payoff: LegacyPayoff, stars: Stars, blocks: boolean): string {
  const amount = scaled(payoff.amount, stars);
  switch (payoff.kind) {
    case "damage": return `+${amount} ${blocks ? "riposte damage" : "damage"}`;
    case "heal": return `heals ${amount} on a parry`;
    case "debuff": return `${amount} ${STATUS[payoff.debuff]} on the opponent`;
    case "cleanse": return `removes ${amount} of your ${STATUS[payoff.debuff]}`;
  }
}

function legacyEffectText(effect: Effect, stars: Stars, blocks: boolean): string {
  const at = (values: readonly [number, number, number]) => scaled(values, stars);
  switch (effect.kind) {
    case "generate": return `Makes ${at(effect.amount)} ${RESOURCE[effect.resource]}${effect.perAdjacent ? `, +${at(effect.perAdjacent)} for every adjacent mod` : ""}.`;
    case "leech": return `Drains ${at(effect.amount)} of the opponent's ${effect.from === "either" ? "Heat or Charge, whichever they hold more of," : RESOURCE[effect.from]} into Void.`;
    case "convert": return `Turns up to ${at(effect.amount)} of your ${RESOURCE[effect.from]} into ${RESOURCE[effect.to]}.`;
    case "spend": return `Spends ${at(effect.cost)} ${RESOURCE[effect.resource]}: ${effect.payoff.map((payoff) => legacyPayoffText(payoff, stars, blocks)).join(", ")}.`;
    case "sink": return `Sinks up to ${at(effect.upTo)} ${RESOURCE[effect.resource]}; for each one, ${effect.per.map((payoff) => legacyPayoffText(payoff, stars, blocks)).join(", ")}.`;
    case "refund": return `Gives back ${at(effect.amount)} Charge each time an adjacent mod spends Charge.`;
    case "accrue": return `+${at(effect.amount)} Void when each round ends.`;
    case "capacity": return `Stores ${at(effect.amount)} more Charge.`;
    case "lane-boost": return `Each elemental cell of every mod touching it powers its lane +${at(effect.amount)}.`;
    case "income": return `+$${at(effect.amount)} every payday.`;
    case "free-reroll": return `${plural(at(effect.amount), "free reroll")} every day.`;
    case "style": return `Style pays out ${plural(at(effect.amount), "more time")}.`;
  }
}

function compactLegacyFiring(definition: ModDefinition): string {
  if (definition.effects.every((effect) =>
    ["capacity", "lane-boost", "income", "free-reroll", "style"].includes(effect.kind))) return "Always on.";
  return definition.affinity === null ? "Every exchange." : `On ${AFFINITY_LABEL[definition.affinity]}.`;
}

function wrap(text: string): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  for (const word of words) {
    const last = lines.at(-1);
    if (last === undefined || last.length + 1 + word.length > LINE_LIMIT) lines.push(word);
    else lines[lines.length - 1] = `${last} ${word}`;
  }
  return lines;
}

/** The legacy firing explanation remains exported until the legacy vocabulary retires. */
export function firingLine(definition: ModDefinition): string {
  const action = definition.affinity;
  if (definition.effects.every((effect) =>
    ["capacity", "lane-boost", "income", "free-reroll", "style"].includes(effect.kind))) return "Always on.";
  if (action === null) return "Fires in every exchange.";
  const waits = action === "block"
    ? "its payoffs land if your guard holds"
    : "its debuffs land if the hit does";
  return `Fires when you ${AFFINITY_LABEL[action]}; ${waits}.`;
}

function perText(amount: Amount, definition: ModDefinition, stars: Stars): string {
  const value = scaled(amount.value, stars);
  switch (amount.per) {
    case "flat": return String(value);
    case "cell": return `${value} per cell`;
    case "adjacent": return `${value} per adjacent mod`;
    case "adjacent-same": return `${value} per adjacent ${TYPE_LABEL[definition.type]} mod`;
    case "adjacent-other": return `${value} per adjacent other-type mod`;
    default: return `${value} per opponent ${STATUS[amount.per]} stack`;
  }
}

function conditionText(condition: Condition | undefined): string {
  if (condition === undefined) return "";
  return condition.kind === "adjacent-to"
    ? ` if next to ${TYPE_LABEL[condition.type]}`
    : ` if opponent has ${STATUS[condition.status]}`;
}

function actionText(definition: ModDefinition): string {
  return definition.affinity === null ? " each exchange" : ` on ${AFFINITY_LABEL[definition.affinity]}`;
}

function landingText(definition: ModDefinition): string {
  if (definition.affinity === null) return " each exchange";
  return definition.affinity === "block" ? " if guard holds" : " on a hit";
}

function payoffText(
  payoff: Payoff,
  effect: Extract<ModEffect, { kind: "exchange" }>,
  definition: ModDefinition,
  stars: Stars,
): string {
  const amount = perText(payoff.amount, definition, stars);
  const condition = conditionText(effect.when);
  switch (payoff.kind) {
    case "damage": return `+${amount} ${definition.affinity === "block" ? "riposte damage" : "damage"}${actionText(definition)}${condition}`;
    case "heal": return `+${amount} parry heal${actionText(definition)}${condition}`;
    case "status": {
      const status = definition.type === "solar" ? "Burn"
        : definition.type === "arc" ? "Shock"
          : definition.type === "void" ? "Poison" : "Status";
      return `${status} ${amount}${landingText(definition)}${condition}`;
    }
    case "cleanse": return `Cleanse ${STATUS[payoff.status]} ${amount}${landingText(definition)}${condition}`;
  }
}

function vocabularyLines(effect: ModEffect, definition: ModDefinition, stars: Stars): string[] {
  if (effect.kind === "exchange") {
    return effect.payoffs.map((payoff) => payoffText(payoff, effect, definition, stars));
  }
  const amount = scaled(effect.amount, stars);
  if (effect.kind === "boost") {
    const target = effect.to === "adjacent"
      ? "Adjacent mods"
      : `Adjacent ${TYPE_LABEL[definition.type]} mods`;
    return [`${target} +${amount}${definition.affinity === null ? "" : ` on ${AFFINITY_LABEL[definition.affinity]}`}`];
  }
  switch (effect.perk) {
    case "income": return [`+$${amount} every payday`];
    case "free-reroll": return [`+${plural(amount, "free reroll")} every day`];
    case "style": return [`+${plural(amount, "style payout")}`];
  }
}

/** Display-ready rules at one star level. */
export function effectLines(definition: ModDefinition, stars: Stars): string[] {
  if (definition.effect !== undefined) return vocabularyLines(definition.effect, definition, stars);
  const blocks = definition.affinity === "block";
  const text = [
    compactLegacyFiring(definition),
    ...definition.effects.map((effect) => legacyEffectText(effect, stars, blocks)),
  ].join(" ");
  return wrap(text);
}
