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
        contacts.push({ attacker, defender, hit: hitbox.definition, overlap, parry: hitbox.definition.breaksGuard ? null : parry });
        break;
      }
    }
  });

  for (const contact of contacts) contact.attacker.hitTargets.push(gate(contact.defender, contact.hit));
  // A fighter struck on this tick is moved by that, not by the recoil of its own landed hit.
  const struck = new Set(contacts.map((contact) => (contact.parry ? contact.attacker : contact.defender)));
  for (const contact of contacts) {
    if (contact.parry) parried(contact, contact.parry, state.tick, report);
    else hit(contact, struck, state.tick, report);
  }
}

function hit({ attacker, defender, hit, overlap }: Contact, struck: ReadonlySet<FighterState>, tick: number, report: FrameReport): void {
  defender.health = Math.max(0, defender.health - hit.damage);
  attacker.hitstop = Math.max(attacker.hitstop, hit.hitstopAttacker);
  defender.hitstop = Math.max(defender.hitstop, hit.hitstopDefender);
  if (!struck.has(attacker)) attacker.vx = hit.pushbackAttacker * attacker.facing;
  defender.vx = hit.pushbackDefender * attacker.facing;
  defender.stun = hit.hitstun;
  leaveMove(defender, defender.health === 0 ? "defeated" : "hitstun");

  report.contacts.push({ source: attacker.id, target: defender.id, hitboxId: hit.id, overlap, damage: hit.damage, parried: false });
  report.events.push(
    { frame: tick, kind: "hit", source: attacker.id, target: defender.id, detail: `${hit.id} connected` },
    { frame: tick, kind: "damage-received", fighter: defender.id, detail: `-${hit.damage} health` },
  );
  if (defender.health === 0) report.events.push({ frame: tick, kind: "defeated", fighter: defender.id, detail: `${defender.id} knocked out` });
}

function parried({ attacker, defender, hit, overlap }: Contact, parry: ParryDefinition, tick: number, report: FrameReport): void {
  attacker.hitstop = Math.max(attacker.hitstop, parry.hitstopAttacker);
  defender.hitstop = Math.max(defender.hitstop, parry.hitstopDefender);
  attacker.vx = parry.pushbackAttacker * defender.facing;
  attacker.stun = parry.stun;
  leaveMove(attacker, "hitstun");
  startMove(defender, parry.counter);

  report.contacts.push({ source: attacker.id, target: defender.id, hitboxId: hit.id, overlap, damage: 0, parried: true });
  report.events.push(
    { frame: tick, kind: "parried", source: attacker.id, target: defender.id, detail: `${hit.id} parried` },
    { frame: tick, kind: "move-started", fighter: defender.id, detail: parry.counter },
  );
}
