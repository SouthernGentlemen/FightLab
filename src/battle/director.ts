import type { ActionType } from "./actions.ts";
import { BAR_LENGTH, actionLoadout, otherBar, sameBar } from "./bars.ts";
import type { ActionBar, ActionLoadout, BarId, SlotIndex } from "./bars.ts";
import { resolveMatchup } from "./matchup.ts";
import type { MatchupResult } from "./matchup.ts";
import { decideMixup, opponentPlan } from "./mixup.ts";
import type { MixupPlan, OpponentPlan } from "./mixup.ts";

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
  commit(player: ActionType, opponent: ActionType, context: CommitContext): void;
  /** Advance the simulation one tick and report what each side lost and regained on it. */
  step(): ArenaStep;
  /** Which sides are knocked out, player first. */
  defeated(): readonly [boolean, boolean];
  /**
   * Whatever the arena resolves when a round's last exchange has settled, all at once and in no
   * time at all: what each side lost to it, player first. It may knock a fighter out.
   */
  endRound(): ArenaStep;
}

/**
 * What combat may know about the round an exchange belongs to. A switch of bars is the player's
 * decision or an opponent's plan; combat can react to one and never cause one.
 */
export interface CommitContext {
  readonly round: number;
  /** Whether each side entered this round by switching bars, player first. */
  readonly mixedUp: readonly [boolean, boolean];
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
  /** Health regained on this tick, through a parry, player first. */
  readonly healing: readonly [number, number];
}

/** Pacing, counted in simulation ticks so it can never depend on how fast frames arrive. */
export interface BattleRules {
  /** Ticks both fighters stand ready at the start of a round before its first exchange opens. */
  readonly roundIntro: number;
  /** Ticks both fighters stand ready before each exchange commits. */
  readonly beat: number;
  /** A fight still running after this many rounds ends as a draw. A backstop, not a rule of play. */
  readonly roundLimit: number;
}

export const RULES: BattleRules = { roundIntro: 40, beat: 24, roundLimit: 30 };

export type FightPhase = "round-intro" | "fighting" | "round-pause" | "ko";
export type MatchOutcome = "victory" | "defeat" | "draw";
/** One knockout, both at once, a round that would repeat forever, or the backstop. */
export type OutcomeReason = "ko" | "double-ko" | "stalemate" | "limit";
export type Winner = "player" | "opponent" | null;

/** The exchange being resolved: one slot of each active bar. */
export interface Exchange {
  readonly round: number;
  readonly index: SlotIndex;
  readonly player: ActionType;
  readonly opponent: ActionType;
  /** What the matchup says should happen. The arena decides what does. */
  readonly result: MatchupResult;
  stage: "beat" | "clash";
  /** Consecutive ticks both fighters have stood ready. */
  ready: number;
  committedAt: number | null;
  readonly damage: [number, number];
  readonly healing: [number, number];
}

export interface ExchangeRecord {
  readonly round: number;
  readonly index: SlotIndex;
  readonly bars: readonly [BarId, BarId];
  readonly player: ActionType;
  readonly opponent: ActionType;
  readonly result: MatchupResult;
  /** Who hurt the other and was not hurt: what physically resolved, whatever the matrix said. */
  readonly winner: Winner;
  readonly committedAt: number;
  readonly settledAt: number;
  /** Health each side lost during the exchange, player first. */
  readonly damage: readonly [number, number];
  /** Health each side regained during the exchange, player first. */
  readonly healing: readonly [number, number];
  /** Whether the physics produced what the matchup decided. */
  readonly agrees: boolean;
}

export interface RoundRecord {
  readonly round: number;
  readonly bars: readonly [BarId, BarId];
  readonly mixedUp: readonly [boolean, boolean];
  /** Exchanges fought: three, unless a knockout came first. */
  readonly exchanges: number;
  readonly damage: readonly [number, number];
  /** Health each side lost when the round ended, outside any exchange. */
  readonly afflictions: readonly [number, number];
  /** Exchanges each side won, player first. */
  readonly wins: readonly [number, number];
}

export interface BattleOutcome {
  readonly result: MatchOutcome;
  readonly reason: OutcomeReason;
  readonly tick: number;
}

export interface BattleState {
  phase: FightPhase;
  /** From 1. */
  round: number;
  /** The active bar of each side, player first. */
  bars: [BarId, BarId];
  /** Whether each side entered the current round by switching bars. */
  mixedUp: [boolean, boolean];
  readonly playerLoadout: ActionLoadout;
  readonly opponentLoadout: ActionLoadout;
  readonly opponentMixup: MixupPlan;
  /** The slot being resolved. */
  actionIndex: SlotIndex;
  /** Consecutive ticks both fighters have stood ready during the round intro. */
  introReady: number;
  exchange: Exchange | null;
  history: ExchangeRecord[];
  rounds: RoundRecord[];
  /**
   * The opponent's choice for the next round, fixed the moment the pause begins so it can never
   * depend on what the player does during it. Never shown.
   */
  opponentSwitch: boolean | null;
  /** The player's bar when the pause began, so leaving it knows whether they switched. */
  pausedOn: BarId | null;
  outcome: BattleOutcome | null;
  /** Simulation ticks since the fight began. */
  tick: number;
}

/**
 * A fight exists only once combat has begun, so there is nothing to edit: both loadouts are frozen
 * copies, and no function here changes a slot.
 */
export function createBattle(player: ActionLoadout, opponent: OpponentPlan): BattleState {
  const plan = opponentPlan(opponent, opponent.mixup);
  return {
    phase: "round-intro",
    round: 1,
    bars: ["primary", "primary"],
    mixedUp: [false, false],
    playerLoadout: actionLoadout(player.primary, player.secondary),
    opponentLoadout: actionLoadout(plan.primary, plan.secondary),
    opponentMixup: plan.mixup,
    actionIndex: 0,
    introReady: 0,
    exchange: null,
    history: [],
    rounds: [],
    opponentSwitch: null,
    pausedOn: null,
    outcome: null,
    tick: 0,
  };
}

export function activeBar(state: BattleState, side: 0 | 1): ActionBar {
  const loadout = side === 0 ? state.playerLoadout : state.opponentLoadout;
  return loadout[state.bars[side]];
}

/**
 * One simulation tick of the fight. Nothing happens in the pause or after a knockout.
 *
 * A round opens with both fighters walking back to their marks and standing ready. Then, slot by
 * slot, the exchange opens, waits for both fighters to stand ready for a beat, commits both actions
 * on the same tick, and closes only when the arena reports that everything it set in motion has
 * settled. The cursor moves when combat says so and at no other time.
 */
export function stepBattle(state: BattleState, arena: Arena, rules: BattleRules = RULES): void {
  if (state.phase === "round-intro") {
    arena.step();
    state.tick++;
    state.introReady = arena.status() === "ready" ? state.introReady + 1 : 0;
    if (state.introReady >= rules.roundIntro) state.phase = "fighting";
    return;
  }
  if (state.phase !== "fighting") return;
  const exchange = state.exchange ??= openExchange(state);

  if (exchange.stage === "beat") {
    exchange.ready = arena.status() === "ready" ? exchange.ready + 1 : 0;
    if (exchange.ready >= rules.beat) {
      arena.commit(exchange.player, exchange.opponent, { round: state.round, mixedUp: [...state.mixedUp] });
      exchange.stage = "clash";
      exchange.committedAt = state.tick;
    }
  }

  const { damage, healing } = arena.step();
  state.tick++;
  if (exchange.stage !== "clash") return;
  exchange.damage[0] += damage[0];
  exchange.damage[1] += damage[1];
  exchange.healing[0] += healing[0];
  exchange.healing[1] += healing[1];

  const status = arena.status();
  if (status === "busy") return;
  closeExchange(state, exchange);

  if (status === "ko") {
    recordRound(state, [0, 0]);
    knockout(state, arena);
    return;
  }
  if (exchange.index < BAR_LENGTH - 1) {
    state.actionIndex = (exchange.index + 1) as SlotIndex;
    return;
  }
  recordRound(state, arena.endRound().damage);
  if (arena.status() === "ko") {
    knockout(state, arena);
    return;
  }
  if (state.round >= rules.roundLimit) {
    end(state, "draw", "limit");
    return;
  }
  state.phase = "round-pause";
  state.pausedOn = state.bars[0];
  state.opponentSwitch = decideMixup(state.opponentMixup, state.rounds);
}

/** Swap the player's active bar. Only between rounds; pressing it again swaps back. */
export function mixup(state: BattleState): void {
  if (state.phase !== "round-pause") throw new Error(`cannot mix up while ${state.phase}`);
  state.bars[0] = otherBar(state.bars[0]);
}

/**
 * Leave the pause: apply both sides' decisions and start the next round. A round nobody was hurt in
 * is three guards against three guards; if the next round would run the same actions again it would
 * repeat forever, so it ends the fight as a draw instead. Nothing random is added to force a winner.
 */
export function nextRound(state: BattleState): void {
  if (state.phase !== "round-pause") throw new Error(`cannot start a round while ${state.phase}`);
  const last = state.rounds.at(-1)!;
  const bars: [BarId, BarId] = [state.bars[0], state.opponentSwitch ? otherBar(state.bars[1]) : state.bars[1]];
  const mixedUp: [boolean, boolean] = [bars[0] !== state.pausedOn, bars[1] !== state.bars[1]];
  const repeats = sameBar(state.playerLoadout[last.bars[0]], state.playerLoadout[bars[0]])
    && sameBar(state.opponentLoadout[last.bars[1]], state.opponentLoadout[bars[1]]);
  state.bars = bars;
  state.opponentSwitch = null;
  state.pausedOn = null;
  const hurt = last.damage[0] + last.damage[1] + last.afflictions[0] + last.afflictions[1] > 0;
  if (repeats && !hurt) {
    end(state, "draw", "stalemate");
    return;
  }
  state.round++;
  state.mixedUp = mixedUp;
  state.actionIndex = 0;
  state.introReady = 0;
  state.phase = "round-intro";
}

function openExchange(state: BattleState): Exchange {
  const player = activeBar(state, 0)[state.actionIndex];
  const opponent = activeBar(state, 1)[state.actionIndex];
  return {
    round: state.round,
    index: state.actionIndex,
    player,
    opponent,
    result: resolveMatchup(player, opponent),
    stage: "beat",
    ready: 0,
    committedAt: null,
    damage: [0, 0],
    healing: [0, 0],
  };
}

/** A winner hurts and is not hurt; a tie is a trade or nothing at all. */
function agrees(result: MatchupResult, toPlayer: number, toOpponent: number): boolean {
  if (result === "player") return toOpponent > 0 && toPlayer === 0;
  if (result === "opponent") return toPlayer > 0 && toOpponent === 0;
  return (toPlayer > 0) === (toOpponent > 0);
}

function winnerOf(toPlayer: number, toOpponent: number): Winner {
  if (toOpponent > 0 && toPlayer === 0) return "player";
  if (toPlayer > 0 && toOpponent === 0) return "opponent";
  return null;
}

function closeExchange(state: BattleState, exchange: Exchange): void {
  const [toPlayer, toOpponent] = exchange.damage;
  state.history.push({
    round: exchange.round,
    index: exchange.index,
    bars: [state.bars[0], state.bars[1]],
    player: exchange.player,
    opponent: exchange.opponent,
    result: exchange.result,
    winner: winnerOf(toPlayer, toOpponent),
    committedAt: exchange.committedAt!,
    settledAt: state.tick,
    damage: [toPlayer, toOpponent],
    healing: [exchange.healing[0], exchange.healing[1]],
    agrees: agrees(exchange.result, toPlayer, toOpponent),
  });
  state.exchange = null;
}

function knockout(state: BattleState, arena: Arena): void {
  const [player, opponent] = arena.defeated();
  if (player && opponent) end(state, "draw", "double-ko");
  else end(state, opponent ? "victory" : "defeat", "ko");
}

function recordRound(state: BattleState, afflictions: readonly [number, number]): void {
  const fought = state.history.filter((record) => record.round === state.round);
  const total = (side: 0 | 1) => fought.reduce((sum, record) => sum + record.damage[side], 0);
  const won = (winner: Winner) => fought.filter((record) => record.winner === winner).length;
  state.rounds.push({
    round: state.round,
    bars: [state.bars[0], state.bars[1]],
    mixedUp: [state.mixedUp[0], state.mixedUp[1]],
    exchanges: fought.length,
    damage: [total(0), total(1)],
    afflictions: [afflictions[0], afflictions[1]],
    wins: [won("player"), won("opponent")],
  });
}

function end(state: BattleState, result: MatchOutcome, reason: OutcomeReason): void {
  state.phase = "ko";
  state.outcome = { result, reason, tick: state.tick };
}
