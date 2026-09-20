import { ACTION_TYPES } from "../battle/actions.ts";
import { STATUSES } from "./effects.ts";
import type { Amount, Condition, ModEffect, Payoff } from "./effects.ts";
import { RARITIES } from "./rarity.ts";
import { SHAPE_IDS, SHAPES, sizeOf } from "./shapes.ts";
import { MOD_TYPES } from "./tags.ts";
import type { CatalogueOptions, ModDefinition } from "./registry.ts";

const AFFINITIES = [null, ...ACTION_TYPES] as const;
const TETROMINOES = SHAPE_IDS.filter((shape) => sizeOf(SHAPES[shape]) === 4);
const TRIOMINOES = SHAPE_IDS.filter((shape) => sizeOf(SHAPES[shape]) === 3);
const PER_BY_RARITY = {
  common: ["flat", "cell"],
  uncommon: ["flat", "cell", "adjacent"],
  rare: ["flat", "cell", "adjacent", "adjacent-same", "adjacent-other"],
  "super-rare": ["flat", "cell", "adjacent", "adjacent-same", "adjacent-other", ...STATUSES],
  legendary: ["flat", "cell", "adjacent", "adjacent-same", "adjacent-other", ...STATUSES],
} as const;
const CONDITIONS_BY_RARITY = {
  common: [],
  uncommon: [],
  rare: ["adjacent-to"],
  "super-rare": ["adjacent-to", "opponent-has"],
  legendary: ["adjacent-to", "opponent-has"],
} as const;

function countProblem(problems: string[], label: string, actual: number, expected: number): void {
  if (actual === expected) return;
  const direction = actual < expected ? "low" : "high";
  problems.push(`${label} count: expected ${expected}, got ${actual} (off by ${Math.abs(actual - expected)} ${direction})`);
}

function atLeastOne(problems: string[], label: string, actual: number): void {
  if (actual > 0) return;
  problems.push(`${label} count: expected at least 1, got 0 (off by 1 low)`);
}

function scaled(value: unknown): readonly number[] | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  if (!value.every((part) => Number.isInteger(part) && part >= 0)) return null;
  return value as readonly number[];
}

function amountProblems(amount: Amount, allowed: readonly string[], say: (message: string) => void): readonly number[] | null {
  if (!allowed.includes(amount.per)) say(`scale '${amount.per}' is not allowed at this rarity`);
  const values = scaled(amount.value);
  if (values === null) say("amount is not three non-negative whole star values");
  return values;
}

function conditionProblems(condition: Condition, allowed: readonly string[], say: (message: string) => void): void {
  if (!allowed.includes(condition.kind)) {
    say(`condition '${condition.kind}' is not allowed at this rarity`);
    return;
  }
  if (condition.kind === "adjacent-to" && !MOD_TYPES.includes(condition.type)) say("adjacent-to names an unknown type");
  if (condition.kind === "opponent-has" && !STATUSES.includes(condition.status)) say("opponent-has names an unknown status");
}

function payoffProblems(
  payoff: Payoff, definition: ModDefinition, allowedPer: readonly string[], cleanseAllowed: boolean,
  say: (message: string) => void,
): readonly number[] | null {
  if (!["damage", "heal", "status", "cleanse"].includes(payoff.kind)) {
    say(`unknown payoff kind '${String((payoff as { kind?: unknown }).kind)}'`);
    return null;
  }
  if (payoff.kind === "status" && definition.type === "neutral") say("status payoff is not allowed on Neutral");
  if (payoff.kind === "cleanse") {
    if (!cleanseAllowed) say("cleanse is not allowed at this rarity");
    if (!STATUSES.includes(payoff.status)) say("cleanse names an unknown status");
  }
  return amountProblems(payoff.amount, allowedPer, say);
}

function effectProblems(definition: ModDefinition, say: (message: string) => void): void {
  const effect = definition.effect as ModEffect | undefined;
  if (effect === undefined) {
    say("missing §5 effect");
    return;
  }
  if (!RARITIES.includes(definition.rarity)) {
    say(`unknown rarity '${String(definition.rarity)}'`);
    return;
  }

  const allowedPer = PER_BY_RARITY[definition.rarity] as readonly string[];
  const allowedConditions = CONDITIONS_BY_RARITY[definition.rarity] as readonly string[];
  const growing: readonly number[][] = [];

  if (effect.kind === "exchange") {
    if (!Array.isArray(effect.payoffs) || effect.payoffs.length === 0) say("exchange needs at least one payoff");
    const maxPayoffs = definition.rarity === "common" ? 1 : definition.rarity === "legendary" ? Infinity : 2;
    if (effect.payoffs.length > maxPayoffs) say(`has ${effect.payoffs.length} payoffs; this rarity allows ${maxPayoffs}`);
    if (effect.when !== undefined) conditionProblems(effect.when, allowedConditions, say);
    for (const payoff of effect.payoffs) {
      const values = payoffProblems(payoff, definition, allowedPer, definition.rarity !== "common", say);
      if (values !== null) (growing as number[][]).push([...values]);
    }
  } else if (effect.kind === "boost") {
    if (definition.rarity !== "legendary") say("boost is Legendary-only");
    if (!["adjacent", "adjacent-same"].includes(effect.to)) say(`unknown boost target '${String(effect.to)}'`);
    const values = scaled(effect.amount);
    if (values === null) say("boost amount is not three non-negative whole star values");
    else (growing as number[][]).push([...values]);
  } else if (effect.kind === "perk") {
    if (definition.type !== "neutral" || definition.affinity !== null) say("perk requires Neutral with no affinity");
    if (!["income", "free-reroll", "style"].includes(effect.perk)) say(`unknown perk '${String(effect.perk)}'`);
    const values = scaled(effect.amount);
    if (values === null) say("perk amount is not three non-negative whole star values");
    else (growing as number[][]).push([...values]);
  } else {
    say(`unknown effect kind '${String((effect as { kind?: unknown }).kind)}'`);
  }

  if (!growing.some(([one, two, three]) => one < two && two < three)) say("nothing grows at every ★");
}

export function catalogueProblemsFor(definitions: readonly ModDefinition[], options: CatalogueOptions): string[] {
  const problems: string[] = [];
  const scope = options.type === undefined ? definitions : definitions.filter((definition) => definition.type === options.type);
  const whole = options.type === undefined;

  countProblem(problems, whole ? "catalogue" : `type ${options.type}`, scope.length, whole ? 64 : 16);

  if (whole) {
    for (const type of MOD_TYPES) countProblem(problems, `type ${type}`, definitions.filter((definition) => definition.type === type).length, 16);
  }

  for (const affinity of AFFINITIES) {
    const label = affinity ?? "none";
    countProblem(problems, `affinity ${label}`, scope.filter((definition) => definition.affinity === affinity).length, whole ? 16 : 4);
  }

  const pairTypes = whole ? MOD_TYPES : [options.type!];
  for (const type of pairTypes) {
    for (const affinity of AFFINITIES) {
      const label = affinity ?? "none";
      countProblem(problems, `pair ${type} × ${label}`, definitions.filter((definition) => definition.type === type && definition.affinity === affinity).length, 4);
    }
  }

  const sizeExpected = whole ? [0, 8, 16, 12, 28] : [0, 2, 4, 3, 7];
  for (let size = 1; size <= 4; size++) {
    const actual = scope.filter((definition) => Object.hasOwn(SHAPES, definition.shape) && sizeOf(SHAPES[definition.shape]) === size).length;
    countProblem(problems, `size ${size}`, actual, sizeExpected[size]);
  }

  for (const shape of SHAPE_IDS) {
    const actual = scope.filter((definition) => definition.shape === shape).length;
    if (TRIOMINOES.includes(shape) && !whole) atLeastOne(problems, `shape ${shape}`, actual);
    else {
      const expected = TETROMINOES.includes(shape) ? (whole ? 4 : 1)
        : TRIOMINOES.includes(shape) ? 6
        : shape === "domino" ? (whole ? 16 : 4)
        : whole ? 8 : 2;
      countProblem(problems, `shape ${shape}`, actual, expected);
    }
  }

  const rarityExpected = whole ? [16, 16, 16, 8, 8] : [4, 4, 4, 2, 2];
  RARITIES.forEach((rarity, index) =>
    countProblem(problems, `rarity ${rarity}`, scope.filter((definition) => definition.rarity === rarity).length, rarityExpected[index]));

  for (const key of ["id", "name"] as const) {
    const seen = new Set<string>();
    for (const definition of scope) {
      if (seen.has(definition[key])) problems.push(`${key} '${definition[key]}' is used twice`);
      seen.add(definition[key]);
    }
  }

  for (const definition of scope) {
    const say = (message: string) => problems.push(`${definition.id}: ${message}`);
    if (definition.name.length > 16) say(`name is ${definition.name.length} characters; maximum is 16`);
    if (!MOD_TYPES.includes(definition.type)) say(`unknown type '${String(definition.type)}'`);
    if (definition.affinity !== null && !ACTION_TYPES.includes(definition.affinity)) say(`unknown affinity '${String(definition.affinity)}'`);
    if (!Object.hasOwn(SHAPES, definition.shape)) say(`unknown shape '${String(definition.shape)}'`);
    effectProblems(definition, say);
  }

  return problems;
}
