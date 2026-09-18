import type { ActionTable, ActionType } from "../battle/actions.ts";
import type { Arena, ArenaStatus, ArenaStep, CommitContext } from "../battle/director.ts";
import { CombatSimulation, isActionable, px } from "./kernel/index.ts";
import type { Command, FighterDefinition, FighterState, FrameReport, SimulationState } from "./kernel/index.ts";

/** One side of a fight: the frame data it runs on and what each action means to it. */
export interface CombatSide {
  readonly fighter: FighterDefinition;
  readonly actions: ActionTable;
}

/**
 * Where each fighter stands when an exchange commits. Eighty pixels apart puts every move in
 * reach and nobody's pushbox in contact, and returning to the same marks every time means the
 * fortieth exchange is fought at the same distance as the first.
 */
export const MARKS: readonly [number, number] = [px(-40), px(40)];

/**
 * The battle layer's `Arena`, over the sealed kernel.
 *
 * This is the only place an action becomes a move. Positioning between exchanges lives here too,
 * because walking back to a mark is physical: the director never learns where anyone stands.
 */
export class CombatArena implements Arena {
  readonly simulation: CombatSimulation;
  readonly sides: readonly [CombatSide, CombatSide];
  /** The latest tick's contacts and events, for presentation. */
  lastReport: FrameReport | null = null;
  private pending: [Command, Command] = [null, null];

  constructor(sides: readonly [CombatSide, CombatSide]) {
    for (const { fighter, actions } of sides) {
      for (const action of Object.values(actions)) {
        if (!fighter.moves[action.move]) throw new Error(`${fighter.id}: ${action.id} names missing move '${action.move}'`);
      }
    }
    this.sides = sides;
    this.simulation = new CombatSimulation({ definitions: [sides[0].fighter, sides[1].fighter], startX: MARKS });
  }

  get state(): SimulationState {
    return this.simulation.getState();
  }

  commit(player: ActionType, opponent: ActionType, _context: CommitContext): void {
    this.pending = [
      { kind: "move", move: this.sides[0].actions[player].move },
      { kind: "move", move: this.sides[1].actions[opponent].move },
    ];
  }

  status(): ArenaStatus {
    const { fighters } = this.state;
    if (!fighters.every(settled)) return "busy";
    if (fighters.some((fighter) => fighter.mode === "defeated")) return "ko";
    return fighters.every((fighter, index) => fighter.mode === "idle" && this.onMark(fighter, index)) ? "ready" : "moving";
  }

  defeated(): readonly [boolean, boolean] {
    const [player, opponent] = this.state.fighters;
    return [player.mode === "defeated", opponent.mode === "defeated"];
  }

  step(): ArenaStep {
    const { fighters } = this.state;
    const approach = fighters.every(settled) && !fighters.some((fighter) => fighter.mode === "defeated");
    const commands: [Command, Command] = [
      this.pending[0] ?? (approach ? this.toMark(fighters[0], 0) : null),
      this.pending[1] ?? (approach ? this.toMark(fighters[1], 1) : null),
    ];
    this.pending = [null, null];
    const before = [fighters[0].health, fighters[1].health];
    this.lastReport = this.simulation.step(commands);
    return { damage: [before[0] - fighters[0].health, before[1] - fighters[1].health], healing: [0, 0] };
  }

  private onMark(fighter: FighterState, index: number): boolean {
    return Math.abs(MARKS[index] - fighter.x) < this.sides[index].fighter.walkSpeed;
  }

  private toMark(fighter: FighterState, index: number): Command {
    if (this.onMark(fighter, index)) return null;
    return { kind: "walk", direction: MARKS[index] > fighter.x ? 1 : -1 };
  }
}

/** Nothing this fighter was doing is still playing out. Walking back to a mark is not an exchange. */
function settled(fighter: FighterState): boolean {
  if (fighter.hitstop > 0) return false;
  if (fighter.mode === "walk") return true;
  return (isActionable(fighter) || fighter.mode === "defeated") && fighter.vx === 0;
}
