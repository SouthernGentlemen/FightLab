/**
 * Which Boneyard figure each side wears. Presentation only: combat never reads it, and a figure
 * is swapped here without touching frame data. Both figures target Boneyard's `fighter` rig.
 */
export const ROSTER = { player: "fighter", opponent: "barst" } as const;

export type RosterSide = keyof typeof ROSTER;
