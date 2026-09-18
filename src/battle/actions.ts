/**
 * The whole strategic vocabulary: three actions and what each one means underneath.
 *
 * Nothing below the battle layer sees these names. An action is performed by a combat move; which
 * move is data in an `ActionTable`, and the battle layer passes it through without reading it.
 */

export const ACTION_TYPES = ["strike", "tech", "block"] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

export function isActionType(value: unknown): value is ActionType {
  return typeof value === "string" && (ACTION_TYPES as readonly string[]).includes(value);
}

export interface CombatActionDefinition<K extends ActionType = ActionType> {
  readonly id: K;
  readonly label: string;
  /** The combat move this action performs. Opaque here; the combat adapter resolves it. */
  readonly move: string;
  readonly color: string;
}

/** One definition per action. A table is per fighter, so a future fighter can strike differently. */
export type ActionTable = { readonly [K in ActionType]: CombatActionDefinition<K> };

export const DEFAULT_ACTIONS: ActionTable = {
  strike: { id: "strike", label: "Strike", move: "jab", color: "#e5484d" },
  tech: { id: "tech", label: "Tech", move: "overhead", color: "#f2c94c" },
  block: { id: "block", label: "Block", move: "parry", color: "#4c8df6" },
};
