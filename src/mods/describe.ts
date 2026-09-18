import { LINK_BONUS } from "./balance.ts";
import type { Effect, Payoff } from "./effects.ts";
import type { Resource } from "./ports.ts";
import type { ModDefinition } from "./registry.ts";
import { scaled } from "./stars.ts";
import type { Scaled, Stars } from "./stars.ts";
import { TAG_LABEL, actionOf } from "./tags.ts";

/**
 * A mod's rules in words, written from its effects at one star level, so what the shop, the grid
 * and the Armory say is exactly what the engine does. Nothing here is stored anywhere.
 */

const RESOURCE: Readonly<Record<Resource, string>> = { heat: "Heat", charge: "Charge", void: "Void" };

const plural = (count: number, one: string, many = `${one}s`): string => `${count} ${count === 1 ? one : many}`;

function payoffText(payoff: Payoff, stars: Stars, blocks: boolean): string {
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
    case "generate": return `Makes ${at(effect.amount)} ${RESOURCE[effect.resource]}${effect.perLink ? `, +${at(effect.perLink)} for every link it is part of` : ""}.`;
    case "leech": return `Drains ${at(effect.amount)} of the opponent's ${effect.from === "either" ? "Heat or Charge, whichever they hold more of," : RESOURCE[effect.from]} into Void.`;
    case "convert": return `Turns up to ${at(effect.amount)} of your ${RESOURCE[effect.from]} into ${RESOURCE[effect.to]}.`;
    case "spend": return `Spends ${at(effect.cost)} ${RESOURCE[effect.resource]}: ${effect.payoff.map((payoff) => payoffText(payoff, stars, blocks)).join(", ")}.`;
    case "sink": return `Sinks up to ${at(effect.upTo)} ${RESOURCE[effect.resource]}; for each one, ${effect.per.map((payoff) => payoffText(payoff, stars, blocks)).join(", ")}.`;
    case "refund": return `Gives back ${at(effect.amount)} Charge each time a mod linked to it spends Charge.`;
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
  const action = actionOf(definition.tags);
  if (definition.effects.every((effect) => ["capacity", "lane-boost", "income", "free-reroll", "style"].includes(effect.kind))) return "Always on.";
  if (action === null) return "Fires in every exchange.";
  const waits = action === "block" ? "its payoffs land if your guard holds" : "its debuffs land if the hit does";
  return `Fires when you ${TAG_LABEL[action]}; ${waits}.`;
}

/** Every rule of the mod at `stars`, one sentence each, firing line first. */
export function effectLines(definition: ModDefinition, stars: Stars): string[] {
  const blocks = actionOf(definition.tags) === "block";
  return [firingLine(definition), ...definition.effects.map((effect) => effectText(effect, stars, blocks))];
}

/** What a port on this mod does for it, in words. */
export function portLine(definition: ModDefinition): string | null {
  if (definition.ports.length === 0) return null;
  const outs = definition.ports.filter((port) => port.flow === "out");
  return outs.length > 0
    ? `Feeding a matching in-port makes +${LINK_BONUS} ${outs.map((port) => RESOURCE[port.resource]).join(" and ")}.`
    : "Takes energy in from a neighbour whose out-port faces it.";
}

/** One number a mod scales, labelled, at ★, ★★ and ★★★: a row of the Armory's table. */
export interface ScaleRow {
  readonly label: string;
  readonly values: Scaled;
}

function payoffLabel(payoff: Payoff, blocks: boolean, per: string): string {
  switch (payoff.kind) {
    case "damage": return `${blocks ? "Riposte damage" : "Damage"}${per}`;
    case "heal": return `Parry heal${per}`;
    case "debuff": return `${TAG_DEBUFF[payoff.debuff]} applied${per}`;
    case "cleanse": return `${TAG_DEBUFF[payoff.debuff]} removed${per}`;
  }
}

/** Every number the mod has, in the order its effects list them. */
export function scaleRows(definition: ModDefinition): ScaleRow[] {
  const blocks = actionOf(definition.tags) === "block";
  return definition.effects.flatMap((effect): ScaleRow[] => {
    switch (effect.kind) {
      case "generate": return [{ label: `${RESOURCE[effect.resource]} made`, values: effect.amount }, ...(effect.perLink ? [{ label: "More per link", values: effect.perLink }] : [])];
      case "leech": return [{ label: "Drained into Void", values: effect.amount }];
      case "convert": return [{ label: `${RESOURCE[effect.from]} into ${RESOURCE[effect.to]}`, values: effect.amount }];
      case "spend": return [{ label: `${RESOURCE[effect.resource]} spent`, values: effect.cost }, ...effect.payoff.map((payoff) => ({ label: payoffLabel(payoff, blocks, ""), values: payoff.amount }))];
      case "sink": return [{ label: `${RESOURCE[effect.resource]} sunk, at most`, values: effect.upTo }, ...effect.per.map((payoff) => ({ label: payoffLabel(payoff, blocks, " per unit"), values: payoff.amount }))];
      case "refund": return [{ label: "Charge given back", values: effect.amount }];
      case "accrue": return [{ label: "Void each round", values: effect.amount }];
      case "capacity": return [{ label: "Charge capacity", values: effect.amount }];
      case "lane-boost": return [{ label: "Lane power per cell", values: effect.amount }];
      case "income": return [{ label: "Dollars each payday", values: effect.amount }];
      case "free-reroll": return [{ label: "Free rerolls each day", values: effect.amount }];
      case "style": return [{ label: "Extra style payouts", values: effect.amount }];
    }
  });
}

/** What a mod does with the three resources and the three debuffs, for the Armory's summary. */
export interface Profile {
  readonly makes: readonly Resource[];
  readonly spends: readonly Resource[];
  readonly applies: readonly (keyof typeof TAG_DEBUFF)[];
  readonly cleanses: readonly (keyof typeof TAG_DEBUFF)[];
}

export function profileOf(definition: ModDefinition): Profile {
  const makes = new Set<Resource>();
  const spends = new Set<Resource>();
  const applies = new Set<keyof typeof TAG_DEBUFF>();
  const cleanses = new Set<keyof typeof TAG_DEBUFF>();
  for (const effect of definition.effects) {
    if (effect.kind === "generate") makes.add(effect.resource);
    if (effect.kind === "leech" || effect.kind === "accrue") makes.add("void");
    if (effect.kind === "refund") makes.add("charge");
    if (effect.kind === "convert") {
      spends.add(effect.from);
      makes.add(effect.to);
    }
    if (effect.kind === "spend" || effect.kind === "sink") {
      spends.add(effect.resource);
      for (const payoff of effect.kind === "spend" ? effect.payoff : effect.per) {
        if (payoff.kind === "debuff") applies.add(payoff.debuff);
        if (payoff.kind === "cleanse") cleanses.add(payoff.debuff);
      }
    }
  }
  return { makes: [...makes], spends: [...spends], applies: [...applies], cleanses: [...cleanses] };
}
