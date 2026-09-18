import { resolvePushboxes } from "./collision.ts";
import { resolveContacts } from "./contact.ts";
import { advanceMove, currentMove, enterMode, isActionable, movePhase, startMove } from "./state.ts";
import type { Command, Facing, FighterDefinition, FighterState, FrameReport, SimulationConfig, SimulationState } from "./types.ts";

/** Frame data a move cannot honour is refused before a fight can start on it. */
export function validateContent(definition: FighterDefinition): void {
  for (const [key, move] of Object.entries(definition.moves)) {
    const where = `${definition.id}/${key}`;
    if (move.id !== key) throw new Error(`${where}: move id '${move.id}' does not match its key`);
    if (move.duration !== move.startup + move.active + move.recovery) {
      throw new Error(`${where}: duration must equal startup + active + recovery`);
    }
    const activeEnd = move.startup + move.active;
    for (const hitbox of move.hitboxes) {
      if (hitbox.startFrame < move.startup) throw new Error(`${where}/${hitbox.id}: hitbox begins during startup`);
      if (hitbox.endFrame >= activeEnd) throw new Error(`${where}/${hitbox.id}: hitbox extends beyond active frames`);
      if (hitbox.startFrame > hitbox.endFrame) throw new Error(`${where}/${hitbox.id}: inverted frame window`);
    }
    if (move.parry !== null) {
      const { startFrame, endFrame, counter, heal } = move.parry;
      if (startFrame < move.startup || endFrame >= activeEnd || startFrame > endFrame) {
        throw new Error(`${where}: parry window must sit inside the active frames`);
      }
      if (!Number.isInteger(heal) || heal < 0) throw new Error(`${where}: parry heal must be a whole number of health`);
      if (!definition.moves[counter]) throw new Error(`${where}: parry counters with unknown move '${counter}'`);
      if (definition.moves[counter].parry !== null) throw new Error(`${where}: counter '${counter}' parries too, which could chain forever`);
    }
  }
}

function fighter(id: FighterState["id"], x: number, health: number, facing: Facing): FighterState {
  return { id, x, vx: 0, facing, mode: "idle", stateFrame: 0, move: null, moveFrame: 0, bonus: 0, health, hitstop: 0, stun: 0, hitTargets: [] };
}

function applyCommand(fighter: FighterState, definition: FighterDefinition, command: Command, report: FrameReport): void {
  if (!isActionable(fighter)) return;
  if (command?.kind === "move") {
    if (!definition.moves[command.move]) throw new Error(`${definition.id} has no move '${command.move}'`);
    const bonus = command.bonus ?? 0;
    if (!Number.isInteger(bonus) || bonus < 0) throw new Error(`${definition.id}: a move's bonus must be a whole number of damage, not ${bonus}`);
    startMove(fighter, command.move, bonus);
    report.events.push({ frame: report.frame, kind: "move-started", fighter: fighter.id, detail: command.move });
    return;
  }
  if (command?.kind === "walk") {
    fighter.vx = command.direction * definition.walkSpeed;
    enterMode(fighter, "walk");
    return;
  }
  fighter.vx = 0;
  enterMode(fighter, "idle");
}

function applyMovement(fighter: FighterState, definition: FighterDefinition): void {
  fighter.x += fighter.vx;
  if (fighter.mode === "walk" || fighter.vx === 0) return;
  if (Math.abs(fighter.vx) <= definition.groundFriction) fighter.vx = 0;
  else fighter.vx -= Math.sign(fighter.vx) * definition.groundFriction;
}

export class CombatSimulation {
  readonly config: SimulationConfig;
  private state: SimulationState;

  constructor(config: SimulationConfig) {
    this.config = config;
    for (const definition of config.definitions) validateContent(definition);
    this.state = this.initialState();
  }

  private initialState(): SimulationState {
    return {
      tick: 0,
      fighters: [
        fighter("player", this.config.startX[0], this.config.definitions[0].maxHealth, 1),
        fighter("opponent", this.config.startX[1], this.config.definitions[1].maxHealth, -1),
      ],
    };
  }

  getState(): SimulationState {
    return this.state;
  }

  reset(): SimulationState {
    this.state = this.initialState();
    return this.state;
  }

  /**
   * One 60 Hz tick, in the order SVGLab's kernel established: timers, commands, movement,
   * facing, pushboxes, contacts, events.
   */
  step(commands: readonly [Command, Command]): FrameReport {
    const state = this.state;
    const { definitions } = this.config;
    const report: FrameReport = { frame: state.tick, contacts: [], events: [] };
    const before = state.fighters.map((current, index) => ({
      mode: current.mode,
      phase: movePhase(current, currentMove(current, definitions[index])),
    }));
    const frozen = [false, false];

    state.fighters.forEach((current, index) => {
      const definition = definitions[index];
      if (current.hitstop > 0) {
        current.hitstop--;
        frozen[index] = true;
        return;
      }
      const move = currentMove(current, definition);
      if (move !== null && advanceMove(current, move)) {
        report.events.push({ frame: state.tick, kind: "move-ended", fighter: current.id, detail: move.id });
      } else if (current.mode === "hitstun") {
        if (current.stun === 0) {
          enterMode(current, "idle");
          report.events.push({ frame: state.tick, kind: "recovered", fighter: current.id, detail: `${current.id} recovered from hitstun` });
        } else {
          current.stun--;
        }
      }
      applyCommand(current, definition, commands[index] ?? null, report);
    });

    state.fighters.forEach((current, index) => {
      if (!frozen[index]) applyMovement(current, definitions[index]);
    });

    const [player, opponent] = state.fighters;
    if (!frozen[0] && isActionable(player)) player.facing = player.x <= opponent.x ? 1 : -1;
    if (!frozen[1] && isActionable(opponent)) opponent.facing = opponent.x <= player.x ? 1 : -1;

    resolvePushboxes(state, definitions);
    resolveContacts(state, definitions, report);

    state.fighters.forEach((current, index) => {
      const phase = movePhase(current, currentMove(current, definitions[index]));
      if (phase !== null && phase !== before[index].phase) {
        report.events.push({ frame: state.tick, kind: "phase-changed", fighter: current.id, detail: phase });
      }
      if (current.mode !== before[index].mode) {
        report.events.push({ frame: state.tick, kind: "state-changed", fighter: current.id, detail: `${before[index].mode} → ${current.mode}` });
      }
      if (!frozen[index]) current.stateFrame++;
    });

    state.tick++;
    return report;
  }
}
