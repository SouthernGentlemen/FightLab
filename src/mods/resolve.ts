import type { ActionType } from "../battle/actions.ts";
import { BASE_CHARGE_CAPACITY, burnAfterRound, burnDamage, heatAfterRound, poisonDamage, shockBonus } from "./balance.ts";
import type { Debuff, Effect, LegacyPayoff, Resource } from "./effects.ts";
import { vocabularyExchange, vocabularyPerkTotal } from "./effectresolve.ts";
import type { ActiveMod, ModProgram } from "./program.ts";
import { scaled } from "./stars.ts";
import type { Scaled } from "./stars.ts";

/**
 * The resource and debuff engine: what every fighter's mods do in an exchange and when a round ends.
 * Pure — states in, states out — and counted in exchanges and rounds, never in frames, so the combat
 * simulation stays the only thing that decides what lands and animation only ever shows it.
 *
 * Per exchange, for both fighters: 1 generate, 2 leech then convert, 3 consume; 4 the kernel resolves
 * the exchange; 5 the payoffs its result earned. After slot 3: 6 Burn and Poison, and the vent.
 */

export interface ModState {
  readonly heat: number;
  readonly charge: number;
  readonly capacity: number;
  /** The Void resource: what leeches and conversions have gathered. */
  readonly voidCharge: number;
  readonly burn: number;
  readonly shock: number;
  readonly poison: number;
}

export type Pair<T> = readonly [T, T];

/** What a payoff waits for: its fighter's move to land, its guard to hold, or nothing. */
export type Needs = "landed" | "guard" | null;

export interface PendingPayoff {
  readonly kind: "debuff" | "cleanse";
  readonly debuff: Debuff;
  readonly amount: number;
  readonly needs: Needs;
}

export interface Prepared {
  readonly states: Pair<ModState>;
  /** Extra damage on every hit of each side's move; a parry passes it to its riposte. */
  readonly bonus: Pair<number>;
  /** Extra healing on each side's parry, if it parries. */
  readonly heal: Pair<number>;
  /** Each side's Shock as the kernel's exposure: the first damaging hit it takes adds all of it. */
  readonly exposure: Pair<number>;
  readonly pending: Pair<readonly PendingPayoff[]>;
}

export interface Outcome {
  /** Whether each side's move hurt the other. */
  readonly landed: Pair<boolean>;
  /** Whether each side was hurt. */
  readonly hurt: Pair<boolean>;
  /** The exposure the kernel consumed on each side: all of its Shock, or nothing. */
  readonly exposed: Pair<number>;
}

export interface RoundEnd {
  readonly states: Pair<ModState>;
  /** Health each side loses to its afflictions. */
  readonly afflictions: Pair<number>;
  readonly burn: Pair<number>;
  readonly poison: Pair<number>;
}

const FIELD = { heat: "heat", charge: "charge", void: "voidCharge" } as const satisfies Record<Resource, keyof ModState>;

type Working = { -readonly [K in keyof ModState]: number } & { bonus: number; heal: number; pending: PendingPayoff[]; chargeSpenders: number[] };

const at = (mod: ActiveMod, values: Scaled): number => scaled(values, mod.stars);

export function staticTotal(program: ModProgram, kind: "capacity" | "lane-boost" | "income" | "free-reroll" | "style"): number {
  const legacy = program.mods.reduce((sum, mod) => sum + mod.definition.effects.reduce((inner, effect) =>
    inner + (effect.kind === kind ? at(mod, effect.amount) : 0), 0), 0);
  const bridged = kind === "income" || kind === "free-reroll" || kind === "style"
    ? vocabularyPerkTotal(program, kind)
    : 0;
  return legacy + bridged;
}

export function freshState(program: ModProgram): ModState {
  return { heat: 0, charge: 0, capacity: BASE_CHARGE_CAPACITY + staticTotal(program, "capacity"), voidCharge: 0, burn: 0, shock: 0, poison: 0 };
}

/** A mod with an action tag fires when its fighter plays that action; one without fires every exchange. */
export function fires(mod: ActiveMod, action: ActionType): boolean {
  const on = mod.definition.affinity;
  return on === null || on === action;
}

function needsOf(mod: ActiveMod): Needs {
  const on = mod.definition.affinity;
  return on === null ? null : on === "block" ? "guard" : "landed";
}

function room(work: Working, resource: Resource): number {
  return resource === "charge" ? Math.max(0, work.capacity - work.charge) : Number.POSITIVE_INFINITY;
}

function add(work: Working, resource: Resource, amount: number): void {
  work[FIELD[resource]] += Math.min(amount, room(work, resource));
}

function pay(work: Working, mod: ActiveMod, payoffs: readonly LegacyPayoff[], times: number): void {
  for (const payoff of payoffs) {
    const amount = at(mod, payoff.amount) * times;
    if (payoff.kind === "damage") work.bonus += amount;
    else if (payoff.kind === "heal") work.heal += amount;
    else work.pending.push({ kind: payoff.kind, debuff: payoff.debuff, amount, needs: needsOf(mod) });
  }
}

function each<K extends Effect["kind"]>(mods: readonly ActiveMod[], kind: K, run: (mod: ActiveMod, effect: Extract<Effect, { kind: K }>) => void): void {
  for (const mod of mods) for (const effect of mod.definition.effects) if (effect.kind === kind) run(mod, effect as Extract<Effect, { kind: K }>);
}

/** Steps 1–3 for both fighters. Leeches drain against what each side held after step 1, together. */
export function prepareExchange(states: Pair<ModState>, programs: Pair<ModProgram>, actions: Pair<ActionType>): Prepared {
  const work: Working[] = states.map((state) => ({ ...state, bonus: 0, heal: 0, pending: [], chargeSpenders: [] }));
  const firing = programs.map((program, side) => program.mods.filter((mod) => fires(mod, actions[side])));

  firing.forEach((mods, side) => each(mods, "generate", (mod, effect) =>
    add(work[side], effect.resource, at(mod, effect.amount) + (effect.perAdjacent ? at(mod, effect.perAdjacent) * mod.adjacent.length : 0))));

  const held = work.map((side) => ({ heat: side.heat, charge: side.charge }));
  const drained = firing.map((mods, side) => {
    const pools = { ...held[1 - side] };
    const taken = { heat: 0, charge: 0 };
    each(mods, "leech", (mod, effect) => {
      let wanted = at(mod, effect.amount);
      const order = effect.from !== "either" ? [effect.from] : pools.charge > pools.heat ? ["charge", "heat"] as const : ["heat", "charge"] as const;
      for (const source of order) {
        const take = Math.min(wanted, pools[source]);
        pools[source] -= take;
        taken[source] += take;
        wanted -= take;
      }
    });
    return taken;
  });
  drained.forEach((taken, side) => {
    work[1 - side].heat -= taken.heat;
    work[1 - side].charge -= taken.charge;
    work[side].voidCharge += taken.heat + taken.charge;
  });
  firing.forEach((mods, side) => each(mods, "convert", (mod, effect) => {
    const moved = Math.min(at(mod, effect.amount), work[side][FIELD[effect.from]], room(work[side], effect.to));
    work[side][FIELD[effect.from]] -= moved;
    add(work[side], effect.to, moved);
  }));

  firing.forEach((mods, side) => {
    const own = work[side];
    for (const mod of mods) {
      for (const effect of mod.definition.effects) {
        if (effect.kind === "spend" && own[FIELD[effect.resource]] >= at(mod, effect.cost)) {
          own[FIELD[effect.resource]] -= at(mod, effect.cost);
          pay(own, mod, effect.payoff, 1);
          if (effect.resource === "charge") own.chargeSpenders.push(mod.uid);
        } else if (effect.kind === "sink") {
          const removed = Math.min(at(mod, effect.upTo), own[FIELD[effect.resource]]);
          if (removed === 0) continue;
          own[FIELD[effect.resource]] -= removed;
          pay(own, mod, effect.per, removed);
          if (effect.resource === "charge") own.chargeSpenders.push(mod.uid);
        }
      }
    }
    each(mods, "refund", (mod, effect) =>
      add(own, "charge", at(mod, effect.amount) * own.chargeSpenders.filter((uid) => mod.adjacent.includes(uid)).length));
  });

  programs.forEach((program, side) => {
    const resolved = vocabularyExchange(program, work[1 - side], actions[side]);
    work[side].bonus += resolved.bonus;
    work[side].heal += resolved.heal;
    work[side].pending.push(...resolved.pending);
  });

  const state = ({ heat, charge, capacity, voidCharge, burn, shock, poison }: Working): ModState => ({ heat, charge, capacity, voidCharge, burn, shock, poison });
  return {
    states: [state(work[0]), state(work[1])],
    bonus: [work[0].bonus, work[1].bonus],
    heal: [work[0].heal, work[1].heal],
    exposure: [shockBonus(work[0].shock), shockBonus(work[1].shock)],
    pending: [work[0].pending, work[1].pending],
  };
}

/**
 * Step 5, once the kernel has resolved the exchange. A hit that consumed exposure took all of that
 * side's Shock. Then the payoffs land: debuffs on the opponent, then cleanses on the owner.
 */
export function settleExchange(prepared: Prepared, outcome: Outcome): Pair<ModState> {
  const next = prepared.states.map((state, side) => ({ ...state, shock: outcome.exposed[side] > 0 ? 0 : state.shock }));
  const earned = (side: number, needs: Needs) => needs === null || (needs === "landed" ? outcome.landed[side] : !outcome.hurt[side]);
  for (const kind of ["debuff", "cleanse"] as const) {
    prepared.pending.forEach((list, side) => {
      for (const payoff of list) {
        if (payoff.kind !== kind || !earned(side, payoff.needs)) continue;
        if (kind === "debuff") next[1 - side][payoff.debuff] += payoff.amount;
        else next[side][payoff.debuff] = Math.max(0, next[side][payoff.debuff] - payoff.amount);
      }
    });
  }
  return [next[0], next[1]];
}

/** Step 6: Burn deals its damage and halves, Poison deals its damage and stays, Heat vents, Void accrues. */
export function endRound(states: Pair<ModState>, programs: Pair<ModProgram>): RoundEnd {
  const burn = states.map((state) => burnDamage(state.burn));
  const poison = states.map((state) => poisonDamage(state.poison));
  const next = states.map((state, side): ModState => ({
    ...state,
    burn: burnAfterRound(state.burn),
    heat: heatAfterRound(state.heat),
    voidCharge: state.voidCharge + programs[side].mods.reduce((sum, mod) =>
      sum + mod.definition.effects.reduce((inner, effect) => inner + (effect.kind === "accrue" ? at(mod, effect.amount) : 0), 0), 0),
  }));
  return {
    states: [next[0], next[1]],
    afflictions: [burn[0] + poison[0], burn[1] + poison[1]],
    burn: [burn[0], burn[1]],
    poison: [poison[0], poison[1]],
  };
}
