import { DEFAULT_ACTIONS } from "../battle/actions.ts";
import type { ActionType } from "../battle/actions.ts";
import { RULES, createBattle, programSlot, resetBattle, startFight, stepBattle } from "../battle/director.ts";
import type { BattleRules, BattleState } from "../battle/director.ts";
import { OPPONENT_PROGRAM } from "../battle/opponent.ts";
import { defaultProgram } from "../battle/program.ts";
import type { ActionProgram } from "../battle/program.ts";
import { CombatArena } from "../combat/adapter.ts";
import type { CombatSide } from "../combat/adapter.ts";
import { FIGHTLAB_FIGHTER } from "../combat/moves.ts";
import type { CombatEvent } from "../combat/kernel/index.ts";

export interface MatchConfig {
  readonly sides: readonly [CombatSide, CombatSide];
  readonly opponentProgram: ActionProgram;
  readonly rules: BattleRules;
}

export const DEFAULT_MATCH: MatchConfig = {
  sides: [
    { fighter: FIGHTLAB_FIGHTER, actions: DEFAULT_ACTIONS },
    { fighter: FIGHTLAB_FIGHTER, actions: DEFAULT_ACTIONS },
  ],
  opponentProgram: OPPONENT_PROGRAM,
  rules: RULES,
};

/**
 * One match: the director above, a fresh arena below, and nothing else.
 *
 * The arena is created before the fight and never stepped until it starts, so a match begins at
 * tick 0 however long the player spent planning, and a rematch is a new arena rather than a
 * reset one.
 */
export class Match {
  readonly config: MatchConfig;
  readonly battle: BattleState;
  arena: CombatArena;
  /** Every combat event since the fight began, in order. */
  readonly events: CombatEvent[] = [];
  /**
   * Counts every step in every phase. It animates the idle stance while planning and the finish
   * after a knockout; the simulation never reads it.
   */
  presentationTick = 0;
  /** The presentation tick the match ended on, so the finish animates from zero. */
  endedAt: number | null = null;

  constructor(config: MatchConfig = DEFAULT_MATCH, playerProgram: ActionProgram = defaultProgram()) {
    this.config = config;
    this.battle = createBattle(playerProgram, config.opponentProgram);
    this.arena = new CombatArena(config.sides);
  }

  setSlot(slot: number, action: ActionType): void {
    programSlot(this.battle, slot, action);
  }

  fight(): void {
    startFight(this.battle);
  }

  rematch(): void {
    resetBattle(this.battle);
    this.arena = new CombatArena(this.config.sides);
    this.events.length = 0;
    this.presentationTick = 0;
    this.endedAt = null;
  }

  step(): void {
    this.presentationTick++;
    if (this.battle.phase !== "fighting") return;
    stepBattle(this.battle, this.arena, this.config.rules);
    if (this.arena.lastReport) this.events.push(...this.arena.lastReport.events);
    if (this.over) this.endedAt = this.presentationTick;
  }

  get over(): boolean {
    return this.battle.phase === "ko";
  }
}
