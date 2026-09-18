import { defaultLoadout } from "../battle/bars.ts";
import type { ActionLoadout } from "../battle/bars.ts";
import { RULES, createBattle, mixup, nextRound, stepBattle } from "../battle/director.ts";
import type { BattleRules, BattleState } from "../battle/director.ts";
import { REFERENCE_OPPONENT } from "../battle/mixup.ts";
import type { OpponentPlan } from "../battle/mixup.ts";
import { styleOf } from "../battle/style.ts";
import type { StyleMeter } from "../battle/style.ts";
import { CombatArena } from "../combat/adapter.ts";
import type { CombatSide } from "../combat/adapter.ts";
import type { CombatEvent } from "../combat/kernel/index.ts";
import { BARE_SIDE } from "./sides.ts";

export interface MatchConfig {
  readonly sides: readonly [CombatSide, CombatSide];
  readonly player: ActionLoadout;
  readonly opponent: OpponentPlan;
  readonly rules: BattleRules;
}

export const DEFAULT_MATCH: MatchConfig = {
  sides: [BARE_SIDE, BARE_SIDE],
  player: defaultLoadout(),
  opponent: REFERENCE_OPPONENT,
  rules: RULES,
};

/**
 * One fight: the director above, a fresh arena below, and nothing else.
 *
 * A match exists only once combat begins, so it starts in round 1's intro at tick 0 and there is
 * nothing to edit. Every player decision it is given is recorded, because a fight is its two
 * loadouts, its builds and those decisions — enough to replay it exactly.
 */
export class Match {
  readonly config: MatchConfig;
  readonly battle: BattleState;
  readonly arena: CombatArena;
  /** Every combat event since the fight began, in order. */
  readonly events: CombatEvent[] = [];
  /** Whether the player switched bars at each pause left so far. */
  readonly decisions: boolean[] = [];
  /**
   * Counts every step in every phase. It animates the idle stance through a pause and the finish
   * after a knockout; the simulation never reads it.
   */
  presentationTick = 0;
  /** The presentation tick the match ended on, so the finish animates from zero. */
  endedAt: number | null = null;

  constructor(config: MatchConfig = DEFAULT_MATCH) {
    this.config = config;
    this.battle = createBattle(config.player, config.opponent);
    this.arena = new CombatArena(config.sides);
  }

  step(): void {
    this.presentationTick++;
    if (this.battle.phase === "round-pause" || this.battle.phase === "ko") return;
    stepBattle(this.battle, this.arena, this.config.rules);
    if (this.arena.lastReport) this.events.push(...this.arena.lastReport.events);
    if (this.over) this.endedAt = this.presentationTick;
  }

  mixup(): void {
    mixup(this.battle);
  }

  nextRound(): void {
    const switched = this.battle.bars[0] !== this.battle.pausedOn;
    nextRound(this.battle);
    this.decisions.push(switched);
    if (this.over) this.endedAt = this.presentationTick;
  }

  get paused(): boolean {
    return this.battle.phase === "round-pause";
  }

  get over(): boolean {
    return this.battle.phase === "ko";
  }

  style(): readonly [StyleMeter, StyleMeter] {
    return [styleOf(this.battle.history, "player"), styleOf(this.battle.history, "opponent")];
  }
}
