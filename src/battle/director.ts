import type { ActionType } from "./actions.ts";
import { resolveMatchup } from "./matchup.ts";
import type { MatchupResult } from "./matchup.ts";
import { PROGRAM_LENGTH, advanceCursor, isActionProgram, setSlot } from "./program.ts";
import type { ActionProgram } from "./program.ts";

/**
 * What the director needs from combat, and all it gets.
 *
 * The battle layer declares this so the combat adapter can implement it without battle ever
 * importing combat. Nothing here can set health, a position or a timer: the director commits
 * actions, lets time pass, and reads back what physically happened.
 */
export interface Arena {
  status(): ArenaStatus;
  /** Queue both actions to begin together on the next step. */
  commit(player: ActionType, opponent: ActionType): void;
  /** Advance the simulation one tick and report the health each side lost on it. */
  step(): ArenaStep;
  /** Which sides are knocked out, player first. */
  defeated(): readonly [boolean, boolean];
}

/**
 * - `busy`: a move, hitstun, hitstop or knockback is still playing out.
 * - `moving`: everything has settled and a fighter is walking back to its mark.
 * - `ready`: both fighters stand idle on their marks.
 * - `ko`: everything has settled and a fighter is knocked out.
 */
export type ArenaStatus = "busy" | "moving" | "ready" | "ko";

export interface ArenaStep {
  /** Health lost on this tick, through contact, player first. */
  readonly damage: readonly [number, number];
}

/** Pacing, counted in simulation ticks so it can never depend on how fast frames arrive. */
export interface BattleRules {
  /** Ticks both fighters stand ready before the first exchange commits. */
  readonly openingBeat: number;
  /** Ticks both fighters stand ready before each later exchange commits. */
  readonly beat: number;
  /** A match still running after this many cycles ends as a draw. A backstop, not a rule of play. */
  readonly cycleLimit: number;
}

export const RULES: BattleRules = { openingBeat: 45, beat: 24, cycleLimit: 30 };

export type BattlePhase = "planning" | "fighting" | "ko";
export type MatchOutcome = "victory" | "defeat" | "draw";
/** One knockout, both at once, a whole cycle nobody was hurt in, or the backstop. */
export type OutcomeReason = "ko" | "double-ko" | "stalemate" | "limit";

/** The exchange being resolved: one slot of each program. */
export interface Exchange {
  readonly cycle: number;
  readonly index: number;
  readonly player: ActionType;
  readonly opponent: ActionType;
  /** What the matchup says should happen. The arena decides what does. */
  readonly result: MatchupResult;
  stage: "beat" | "clash";
  /** Consecutive ticks both fighters have stood ready. */
  ready: number;
  committedAt: number | null;
  readonly damage: [number, number];
}

export interface ExchangeRecord {
  readonly cycle: number;
  readonly index: number;
  readonly player: ActionType;
  readonly opponent: ActionType;
  readonly result: MatchupResult;
  readonly committedAt: number;
  readonly settledAt: number;
  /** Health each side lost during the exchange, player first. */
  readonly damage: readonly [number, number];
  /** Whether the physics produced what the matchup decided. */
  readonly agrees: boolean;
}

export interface BattleState {
  phase: BattlePhase;
  /** The slot being resolved, 0–4. */
  actionIndex: number;
  /** How many times both programs have wrapped, from 0. */
  cycle: number;
  playerProgram: ActionProgram;
  opponentProgram: ActionProgram;
  exchange: Exchange | null;
  history: ExchangeRecord[];
  outcome: { readonly result: MatchOutcome; readonly reason: OutcomeReason; readonly tick: number } | null;
  /** Simulation ticks since the fight began. */
  tick: number;
}

export function createBattle(playerProgram: ActionProgram, opponentProgram: ActionProgram): BattleState {
  if (!isActionProgram(playerProgram)) throw new TypeError("the player program is not five actions");
  if (!isActionProgram(opponentProgram)) throw new TypeError("the opponent program is not five actions");
  return {
    phase: "planning",
    actionIndex: 0,
    cycle: 0,
    playerProgram,
    opponentProgram,
    exchange: null,
    history: [],
    outcome: null,
    tick: 0,
  };
}

/** Programming happens before the fight or not at all. */
export function programSlot(state: BattleState, slot: number, action: ActionType): void {
  if (state.phase !== "planning") throw new Error(`the program is locked while ${state.phase}`);
  state.playerProgram = setSlot(state.playerProgram, slot, action);
}

export function startFight(state: BattleState): void {
  if (state.phase !== "planning") throw new Error(`cannot start a fight while ${state.phase}`);
  state.phase = "fighting";
}

/** Back to planning with both programs and none of the fight. Replacing the arena is the caller's job. */
export function resetBattle(state: BattleState): void {
  Object.assign(state, createBattle(state.playerProgram, state.opponentProgram));
}

/**
 * One simulation tick of the fight.
 *
 * The exchange for the current slot opens, waits for both fighters to stand ready for a beat,
 * commits both actions on the same tick, and closes only when the arena reports that everything
 * it set in motion has settled. The cursor moves when combat says so and at no other time.
 */
export function stepBattle(state: BattleState, arena: Arena, rules: BattleRules = RULES): void {
  if (state.phase !== "fighting") return;
  const exchange = state.exchange ??= openExchange(state);

  if (exchange.stage === "beat") {
    exchange.ready = arena.status() === "ready" ? exchange.ready + 1 : 0;
    if (exchange.ready >= (state.history.length === 0 ? rules.openingBeat : rules.beat)) {
      arena.commit(exchange.player, exchange.opponent);
      exchange.stage = "clash";
      exchange.committedAt = state.tick;
    }
  }

  const { damage } = arena.step();
  state.tick++;
  if (exchange.stage !== "clash") return;
  exchange.damage[0] += damage[0];
  exchange.damage[1] += damage[1];

  const status = arena.status();
  if (status === "busy") return;
  closeExchange(state, exchange);

  if (status === "ko") {
    const [player, opponent] = arena.defeated();
    if (player && opponent) end(state, "draw", "double-ko");
    else end(state, opponent ? "victory" : "defeat", "ko");
    return;
  }
  if (state.actionIndex !== 0) return;
  // A cycle nobody was hurt in replays identically forever, so it ends the match rather than the
  // tab. Nothing random is ever added to force a winner.
  const finished = state.history.slice(-PROGRAM_LENGTH);
  if (finished.every((record) => record.damage[0] === 0 && record.damage[1] === 0)) end(state, "draw", "stalemate");
  else if (state.cycle >= rules.cycleLimit) end(state, "draw", "limit");
}

function openExchange(state: BattleState): Exchange {
  const player = state.playerProgram[state.actionIndex];
  const opponent = state.opponentProgram[state.actionIndex];
  return {
    cycle: state.cycle,
    index: state.actionIndex,
    player,
    opponent,
    result: resolveMatchup(player, opponent),
    stage: "beat",
    ready: 0,
    committedAt: null,
    damage: [0, 0],
  };
}

/** A winner hurts and is not hurt; a tie is a trade or nothing at all. */
function agrees(result: MatchupResult, toPlayer: number, toOpponent: number): boolean {
  if (result === "player") return toOpponent > 0 && toPlayer === 0;
  if (result === "opponent") return toPlayer > 0 && toOpponent === 0;
  return (toPlayer > 0) === (toOpponent > 0);
}

function closeExchange(state: BattleState, exchange: Exchange): void {
  const [toPlayer, toOpponent] = exchange.damage;
  state.history.push({
    cycle: exchange.cycle,
    index: exchange.index,
    player: exchange.player,
    opponent: exchange.opponent,
    result: exchange.result,
    committedAt: exchange.committedAt!,
    settledAt: state.tick,
    damage: [toPlayer, toOpponent],
    agrees: agrees(exchange.result, toPlayer, toOpponent),
  });
  const next = advanceCursor({ index: state.actionIndex, cycle: state.cycle });
  state.actionIndex = next.index;
  state.cycle = next.cycle;
  state.exchange = null;
}

function end(state: BattleState, result: MatchOutcome, reason: OutcomeReason): void {
  state.phase = "ko";
  state.outcome = { result, reason, tick: state.tick };
}
