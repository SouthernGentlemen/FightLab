import type { ActionType } from "../battle/actions.ts";
import type { Arena, ArenaStatus, ArenaStep, CommitContext } from "../battle/director.ts";
import type { CombatArena } from "../combat/adapter.ts";
import type { ModProgram } from "../mods/program.ts";
import { endRound, freshState, prepareExchange, settleExchange } from "../mods/resolve.ts";
import type { ModState, Pair, Prepared, RoundEnd } from "../mods/resolve.ts";

interface OpenExchange {
  readonly prepared: Prepared;
  readonly damage: [number, number];
  readonly exposed: [number, number];
}

/**
 * The arena a fight runs on: the combat arena with each fighter's mods resolved around it. Before a
 * commit the engine derives damage, healing and status payoffs. When combat says the exchange has
 * settled, the engine reads what physically landed — never an animation — and applies earned
 * statuses. When the round ends, Burn and Poison go through the kernel as afflictions. The director
 * sees one `Arena` and never learns a mod exists.
 */
export class ModdedArena implements Arena {
  readonly combat: CombatArena;
  readonly programs: Pair<ModProgram>;
  states: Pair<ModState>;
  /** What the last round's end did, for presentation. */
  lastRoundEnd: RoundEnd | null = null;
  private open: OpenExchange | null = null;

  constructor(combat: CombatArena, programs: Pair<ModProgram>) {
    this.combat = combat;
    this.programs = programs;
    this.states = [freshState(), freshState()];
  }

  status(): ArenaStatus {
    return this.combat.status();
  }

  defeated(): readonly [boolean, boolean] {
    return this.combat.defeated();
  }

  commit(player: ActionType, opponent: ActionType, context: CommitContext): void {
    const prepared = prepareExchange(this.states, this.programs, [player, opponent]);
    this.states = prepared.states;
    this.open = { prepared, damage: [0, 0], exposed: [0, 0] };
    this.combat.commit(player, opponent, context, { bonus: prepared.bonus, heal: prepared.heal, exposure: prepared.exposure });
  }

  step(): ArenaStep {
    const step = this.combat.step();
    const open = this.open;
    if (open === null) return step;
    open.damage[0] += step.damage[0];
    open.damage[1] += step.damage[1];
    for (const contact of this.combat.lastReport?.contacts ?? []) open.exposed[contact.target === "player" ? 0 : 1] += contact.exposed;
    if (this.combat.status() !== "busy") {
      const [toPlayer, toOpponent] = open.damage;
      this.states = settleExchange(open.prepared, { landed: [toOpponent > 0, toPlayer > 0], hurt: [toPlayer > 0, toOpponent > 0], exposed: open.exposed });
      this.open = null;
    }
    return step;
  }

  endRound(): ArenaStep {
    const ended = endRound(this.states);
    this.states = ended.states;
    this.lastRoundEnd = ended;
    return this.combat.afflict(ended.afflictions);
  }
}
