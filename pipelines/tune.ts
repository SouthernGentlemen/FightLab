#!/usr/bin/env node
/**
 * The tuning bot: `npm run tune`.
 *
 * Plays whole runs headlessly — real shop, real opponents, real fights through the kernel — with a
 * plain strategy, and prints how they went, so prices, income and opponent budgets are tuned from
 * measurements rather than guesses. Every choice the bot makes is recorded as an input; replaying
 * the inputs from the same seed must reproduce the run exactly, which the replay test holds it to.
 */

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { ACTION_TYPES } from "../src/battle/actions.ts";
import type { ActionType } from "../src/battle/actions.ts";
import { BAR_IDS, BAR_LENGTH } from "../src/battle/bars.ts";
import type { BarId, SlotIndex } from "../src/battle/bars.ts";
import { STYLE_RANKS } from "../src/battle/style.ts";
import { fightFor, playFight, reportOf } from "../src/game/fight.ts";
import type { Match } from "../src/game/match.ts";
import { firstFit } from "../src/mods/grid.ts";
import { REGISTRY, priceOf } from "../src/mods/registry.ts";
import { stream } from "../src/run/random.ts";
import { beginFight, buy, finishFight, move, newRun, nextDay, rerollPrice, reroll, setAction } from "../src/run/run.ts";
import type { DaySummary, Destination, Refusal, RunState, Source } from "../src/run/run.ts";

export type RunInput =
  | { readonly kind: "buy"; readonly offer: number; readonly to?: Destination }
  | { readonly kind: "move"; readonly from: Source; readonly to: Destination }
  | { readonly kind: "reroll" }
  | { readonly kind: "set"; readonly bar: BarId; readonly slot: SlotIndex; readonly action: ActionType }
  /** Begin the day's fight, play it making these Mixup decisions in order, and record the result. */
  | { readonly kind: "fight"; readonly decisions: readonly boolean[] }
  | { readonly kind: "next" };

/** Switches after a round in which the opponent won more exchanges. */
export function whenBeaten(match: Match): boolean {
  const last = match.battle.rounds.at(-1)!;
  return last.wins[0] < last.wins[1];
}

export function apply(run: RunState, input: RunInput): Refusal | null {
  switch (input.kind) {
    case "buy": return buy(run, input.offer, input.to);
    case "move": return move(run, input.from, input.to);
    case "reroll": return reroll(run);
    case "set": return setAction(run, input.bar, input.slot, input.action);
    case "next": return nextDay(run);
    case "fight": {
      const refused = beginFight(run);
      if (refused) return refused;
      const decisions = [...input.decisions];
      const match = playFight(fightFor(run).config, () => decisions.shift() ?? false);
      return finishFight(run, reportOf(match));
    }
  }
}

export interface BotRun {
  readonly seed: number;
  readonly inputs: readonly RunInput[];
  readonly days: readonly DaySummary[];
  readonly run: RunState;
  /** Money held at the start of each day's fight. */
  readonly stakes: readonly number[];
}

/** One day's bars, drawn from the bot's own stream so the run's streams never notice the bot. */
function barsFor(seed: number, day: number): Array<[BarId, SlotIndex, ActionType]> {
  const random = stream(seed, "bot", day);
  return BAR_IDS.flatMap((bar) => Array.from({ length: BAR_LENGTH }, (_, slot) => [bar, slot as SlotIndex, random.pick(ACTION_TYPES)] as [BarId, SlotIndex, ActionType]));
}

/**
 * A plain strategy: fresh bars each morning, then buy the dearest affordable mod that changes the
 * fight and fits the grid, reroll once or twice when nothing does, fight, and Mixup after losing a
 * round on exchanges.
 */
export function botRun(seed: number, maxDays = 40): BotRun {
  const run = newRun(seed);
  const inputs: RunInput[] = [];
  const days: DaySummary[] = [];
  const stakes: number[] = [];
  const act = (input: RunInput): Refusal | null => {
    const refused = apply(run, input);
    if (refused === null) inputs.push(input);
    return refused;
  };
  while (run.phase !== "over" && run.day <= maxDays) {
    for (const [bar, slot, action] of barsFor(seed, run.day)) {
      if (run.loadout[bar][slot] !== action) act({ kind: "set", bar, slot, action });
    }
    for (let rerolls = 0; ; ) {
      const choices = run.shop.offers.flatMap((mod, offer) => {
        if (mod === null || priceOf(mod) > run.money || REGISTRY[mod].type === "neutral") return [];
        const spot = firstFit(run.grid, mod);
        return spot ? [{ offer, price: priceOf(mod), to: { grid: { x: spot.x, y: spot.y, rotation: spot.rotation } } }] : [];
      }).sort((a, b) => b.price - a.price);
      if (choices.length > 0) {
        act({ kind: "buy", offer: choices[0].offer, to: choices[0].to });
        continue;
      }
      if (rerolls < 2 && run.money >= 4 && run.grid.length < 5 && rerollPrice(run) <= run.money) {
        act({ kind: "reroll" });
        rerolls++;
        continue;
      }
      break;
    }
    stakes.push(run.money);
    const refused = beginFight(run);
    if (refused) throw new Error(`the bot could not fight: ${refused}`);
    const match = playFight(fightFor(run).config, whenBeaten);
    inputs.push({ kind: "fight", decisions: [...match.decisions] });
    finishFight(run, reportOf(match));
    days.push(run.last!);
    if (run.phase === "payday") act({ kind: "next" });
  }
  return { seed, inputs, days, run, stakes };
}

/** A run rebuilt from nothing but its seed and its inputs. */
export function replayRun(seed: number, inputs: readonly RunInput[]): { run: RunState; days: DaySummary[] } {
  const run = newRun(seed);
  const days: DaySummary[] = [];
  for (const input of inputs) {
    const refused = apply(run, input);
    if (refused) throw new Error(`replay refused ${input.kind}: ${refused}`);
    if (input.kind === "fight") days.push(run.last!);
  }
  return { run, days };
}

function percent(part: number, whole: number): string {
  return whole === 0 ? "   —" : `${((100 * part) / whole).toFixed(0).padStart(3)}%`;
}

function main(argv: readonly string[]): void {
  const count = Number(argv.find((arg) => /^\d+$/.test(arg)) ?? 300);
  const started = performance.now();
  const runs = Array.from({ length: count }, (_, index) => botRun(index * 2654435761 % 0xffffffff));
  const byDay = new Map<number, { fights: number; wins: number; losses: number; draws: number; money: number; rounds: number }>();
  for (const { days, stakes } of runs) {
    days.forEach((summary, index) => {
      const entry = byDay.get(summary.day) ?? { fights: 0, wins: 0, losses: 0, draws: 0, money: 0, rounds: 0 };
      entry.fights++;
      entry.wins += summary.result === "victory" ? 1 : 0;
      entry.losses += summary.result === "defeat" ? 1 : 0;
      entry.draws += summary.result === "draw" ? 1 : 0;
      entry.money += stakes[index];
      entry.rounds += summary.rounds;
      byDay.set(summary.day, entry);
    });
  }
  const champions = runs.filter(({ run }) => run.ending === "champion").length;
  const lengths = runs.map(({ run }) => run.day).sort((a, b) => a - b);
  const styles = [0, 0, 0, 0];
  for (const { days } of runs) for (const summary of days) styles[summary.peakStyle]++;
  const fights = styles.reduce((sum, value) => sum + value, 0);
  console.log(`tune: ${count} bot runs in ${((performance.now() - started) / 1000).toFixed(1)} s`);
  console.log(`  champion ${percent(champions, count)}   run length median ${lengths[Math.floor(count / 2)]} days (${lengths[0]}–${lengths.at(-1)})`);
  console.log(`  peak style ${STYLE_RANKS.map((rank, index) => `${rank} ${percent(styles[index], fights)}`).join("  ")}`);
  console.log("  day  fights   win  loss  draw  money  rounds");
  for (const [day, entry] of [...byDay].sort(([a], [b]) => a - b)) {
    console.log(`  ${String(day).padStart(3)}  ${String(entry.fights).padStart(6)}  ${percent(entry.wins, entry.fights)}  ${percent(entry.losses, entry.fights)}  ${percent(entry.draws, entry.fights)}  ${(entry.money / entry.fights).toFixed(1).padStart(5)}  ${(entry.rounds / entry.fights).toFixed(1).padStart(6)}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
