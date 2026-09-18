import type { ActionType } from "./actions.ts";

export type MatchupResult = "player" | "opponent" | "tie";

/**
 * Each action beats exactly one other, and the three form a cycle, so no action dominates and
 * every choice can be punished. This table is the only statement of the rule.
 */
export const BEATS: { readonly [K in ActionType]: ActionType } = {
  strike: "tech",
  tech: "block",
  block: "strike",
};

export function resolveMatchup(player: ActionType, opponent: ActionType): MatchupResult {
  if (player === opponent) return "tie";
  return BEATS[player] === opponent ? "player" : "opponent";
}
