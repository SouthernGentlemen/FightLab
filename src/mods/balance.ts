/**
 * Every tuning number the status system uses, in one place. All of them are first guesses, marked
 * provisional in docs/MODS.md until the tuning bot has measured them; a mod's own numbers live in
 * its registry entry, never here.
 */

/** Damage each Burn stack deals when a round ends, before Burn halves. */
export const BURN_DAMAGE_PER_STACK = 1;

/** Extra damage each Shock stack adds to the next hit that lands; that hit consumes them all. */
export const SHOCK_BONUS_PER_STACK = 1;

/** Poison deals `floor(stacks / POISON_DIVISOR)` when a round ends, and keeps every stack. */
export const POISON_DIVISOR = 2;

/** Burn after a round ends: it halves, rounding down, so 8 → 4 → 2 → 1 → 0. */
export function burnAfterRound(burn: number): number {
  return Math.floor(burn / 2);
}

export function burnDamage(burn: number): number {
  return burn * BURN_DAMAGE_PER_STACK;
}

export function poisonDamage(poison: number): number {
  return Math.floor(poison / POISON_DIVISOR);
}

export function shockBonus(shock: number): number {
  return shock * SHOCK_BONUS_PER_STACK;
}
