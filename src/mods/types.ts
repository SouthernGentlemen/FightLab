import type { ActionType } from "../battle/actions.ts";

export const MOD_TYPES = ["solar", "arc", "void", "neutral"] as const;
export type ModType = (typeof MOD_TYPES)[number];

export const TYPE_LABEL: Readonly<Record<ModType, string>> = {
  solar: "Solar",
  arc: "Arc",
  void: "Void",
  neutral: "Neutral",
};

export const AFFINITY_LABEL: Readonly<Record<ActionType, string>> = {
  strike: "Strike",
  tech: "Tech",
  block: "Block",
};

export function isModType(value: unknown): value is ModType {
  return typeof value === "string" && (MOD_TYPES as readonly string[]).includes(value);
}
