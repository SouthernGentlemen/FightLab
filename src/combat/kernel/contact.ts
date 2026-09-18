import { activeHitboxesOf, hurtboxesOf, intersection } from "./collision.ts";
import { currentMove, isParrying, leaveMove, startMove } from "./state.ts";
import type { Aabb, FighterDefinition, FighterState, FrameReport, HitboxDefinition, ParryDefinition, SimulationState } from "./types.ts";

interface Contact {
  readonly attacker: FighterState;
  readonly defender: FighterState;
  readonly hit: HitboxDefinition;
  readonly overlap: Aabb;
  /** The defender's parry, when it absorbs this hit. */
  readonly parry: ParryDefinition | null;
  /**
   * The bonus this contact carries — the attacker's for a hit, the parrier's for its counter — read
   * before any contact is applied, because applying one can end the move another's bonus came from.
   */
  readonly bonus: number;
  /** The parrier's own extra heal, read before anything is applied for the same reason. */
  readonly heal: number;
}

function gate(defender: FighterState, hit: HitboxDefinition): string {
  return `${defender.id}:${hit.id}`;
}

/**
 * Finds every contact on this tick against the state as it stands, then applies them together.
 *
 * Two fighters that connect on the same tick both land their hits — a trade — whichever of them
 * is listed first. SVGLab applied the first attacker before looking at the second, which a
 * stationary dummy never noticed and two programmed fighters would: the player would win every
 * tie.
 */
export function resolveContacts(state: SimulationState, definitions: readonly FighterDefinition[], report: FrameReport): void {
  const contacts: Contact[] = [];
  state.fighters.forEach((attacker, attackerIndex) => {
    const defenderIndex = attackerIndex === 0 ? 1 : 0;
    const defender = state.fighters[defenderIndex];
    const defenderDefinition = definitions[defenderIndex];
    const hurtboxes = hurtboxesOf(defender, defenderDefinition);
    const parry = isParrying(defender, defenderDefinition) ? currentMove(defender, defenderDefinition)!.parry : null;
    for (const hitbox of activeHitboxesOf(attacker, definitions[attackerIndex])) {
      if (attacker.hitTargets.includes(gate(defender, hitbox.definition))) continue;
      for (const hurtbox of hurtboxes) {
        const overlap = intersection(hitbox.aabb, hurtbox);
        if (overlap === null) continue;
        const absorbed = hitbox.definition.breaksGuard ? null : parry;
        contacts.push({
          attacker, defender, hit: hitbox.definition, overlap, parry: absorbed,
          bonus: absorbed ? defender.bonus : attacker.bonus, heal: absorbed ? defender.heal : 0,
        });
        break;
      }
    }
  });

  for (const contact of contacts) contact.attacker.hitTargets.push(gate(contact.defender, contact.hit));
  // A fighter struck on this tick is moved by that, not by the recoil of its own landed hit.
  const struck = new Set(contacts.map((contact) => (contact.parry ? contact.attacker : contact.defender)));
  for (const contact of contacts) {
    if (contact.parry) parried(contact, contact.parry, definitions[state.fighters.indexOf(contact.defender)], state.tick, report);
    else hit(contact, struck, state.tick, report);
  }
}

/** A landed hit adds the target's exposure, all of it, and clears it: only a hit that hurts can. */
function hit({ attacker, defender, hit, overlap, bonus }: Contact, struck: ReadonlySet<FighterState>, tick: number, report: FrameReport): void {
  const exposed = defender.exposure;
  const damage = hit.damage + bonus + exposed;
  defender.exposure = 0;
  defender.health = Math.max(0, defender.health - damage);
  attacker.hitstop = Math.max(attacker.hitstop, hit.hitstopAttacker);
  defender.hitstop = Math.max(defender.hitstop, hit.hitstopDefender);
  if (!struck.has(attacker)) attacker.vx = hit.pushbackAttacker * attacker.facing;
  defender.vx = hit.pushbackDefender * attacker.facing;
  defender.stun = hit.hitstun;
  leaveMove(defender, defender.health === 0 ? "defeated" : "hitstun");

  report.contacts.push({ source: attacker.id, target: defender.id, hitboxId: hit.id, overlap, damage, parried: false, heal: 0, exposed });
  report.events.push(
    { frame: tick, kind: "hit", source: attacker.id, target: defender.id, detail: `${hit.id} connected` },
    { frame: tick, kind: "damage-received", fighter: defender.id, detail: `-${damage} health` },
  );
  if (defender.health === 0) report.events.push({ frame: tick, kind: "defeated", fighter: defender.id, detail: `${defender.id} knocked out` });
}

/**
 * The parried attacker recoils into hitstun and the defender moves straight into its counter,
 * carrying the parry's bonus: whatever makes a parry hurt, it hurts through the counter's own
 * hitbox. A heal lands here, as part of the same contact, and never past maximum health.
 */
function parried(
  { attacker, defender, hit, overlap, bonus, heal: extra }: Contact,
  parry: ParryDefinition,
  definition: FighterDefinition,
  tick: number,
  report: FrameReport,
): void {
  attacker.hitstop = Math.max(attacker.hitstop, parry.hitstopAttacker);
  defender.hitstop = Math.max(defender.hitstop, parry.hitstopDefender);
  attacker.vx = parry.pushbackAttacker * defender.facing;
  attacker.stun = parry.stun;
  leaveMove(attacker, "hitstun");
  startMove(defender, parry.counter, bonus);
  const heal = Math.max(0, Math.min(parry.heal + extra, definition.maxHealth - defender.health));
  defender.health += heal;

  report.contacts.push({ source: attacker.id, target: defender.id, hitboxId: hit.id, overlap, damage: 0, parried: true, heal, exposed: 0 });
  report.events.push(
    { frame: tick, kind: "parried", source: attacker.id, target: defender.id, detail: `${hit.id} parried` },
    { frame: tick, kind: "move-started", fighter: defender.id, detail: parry.counter },
  );
  if (heal > 0) report.events.push({ frame: tick, kind: "healed", fighter: defender.id, detail: `+${heal} health` });
}
