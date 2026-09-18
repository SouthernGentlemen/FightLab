/**
 * Seeded randomness for the run, and the only randomness FightLab has.
 *
 * Every draw is keyed by the run seed, a purpose and the indices of the draw — `shop / day / reroll`,
 * `opponent / day` — and gets a generator of its own. Nothing is drawn from a shared sequence, so
 * rerolling the shop can never shift tomorrow's opponent, and the order things happen to be
 * generated in never matters. Integer arithmetic throughout, so every engine agrees.
 */

export const MAX_SEED = 0xffffffff;

export function isSeed(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_SEED;
}

/** FNV-1a over the key's text, finished with a murmur-style mix so neighbouring keys spread apart. */
export function keyHash(seed: number, key: readonly (string | number)[]): number {
  const text = `${seed}|${key.join("|")}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

export interface Random {
  /** A float in [0, 1). */
  next(): number;
  /** An integer in [0, bound). */
  int(bound: number): number;
  pick<T>(items: readonly T[]): T;
  /** One of `items`, chosen in proportion to `weights`. */
  weighted<T>(items: readonly T[], weights: readonly number[]): T;
}

/** mulberry32. */
function generator(state: number): Random {
  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (bound: number): number => {
    if (!Number.isInteger(bound) || bound <= 0) throw new RangeError(`cannot draw below ${bound}`);
    return Math.floor(next() * bound);
  };
  return {
    next,
    int,
    pick: (items) => {
      if (items.length === 0) throw new RangeError("cannot pick from nothing");
      return items[int(items.length)];
    },
    weighted: (items, weights) => {
      const total = weights.reduce((sum, weight) => sum + weight, 0);
      if (items.length !== weights.length || total <= 0) throw new RangeError("weights do not describe the items");
      let roll = next() * total;
      let last = 0;
      for (let index = 0; index < items.length; index++) {
        if (weights[index] <= 0) continue;
        if (roll < weights[index]) return items[index];
        roll -= weights[index];
        last = index;
      }
      // Only reachable through rounding at the very top of the range.
      return items[last];
    },
  };
}

export function stream(seed: number, ...key: readonly (string | number)[]): Random {
  if (!isSeed(seed)) throw new RangeError(`${seed} is not a run seed`);
  return generator(keyHash(seed, key));
}
