export type FighterId = "player" | "opponent";
export type Facing = -1 | 1;
export type FighterMode = "idle" | "walk" | "move" | "hitstun" | "defeated";
export type MovePhase = "startup" | "active" | "recovery";

/** Fighter-local geometry. X points forward and Y points up from the ground origin. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Aabb {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface HitboxDefinition {
  id: string;
  box: Box;
  startFrame: number;
  endFrame: number;
  damage: number;
  hitstun: number;
  hitstopAttacker: number;
  hitstopDefender: number;
  pushbackAttacker: number;
  pushbackDefender: number;
  /** A parry cannot absorb this hit. */
  breaksGuard: boolean;
}

/**
 * Frames in which a move absorbs any hit that does not break guard, and what it does next. A
 * parry is active defence: the attacker is left stunned and the defender moves straight into
 * `counter`, whose own hitbox has to land for anyone to be hurt.
 */
export interface ParryDefinition {
  startFrame: number;
  endFrame: number;
  counter: string;
  /** Hitstun the parried attacker suffers once the freeze ends. */
  stun: number;
  hitstopAttacker: number;
  hitstopDefender: number;
  pushbackAttacker: number;
  /** Health the parry restores to its owner, never past maximum health. */
  heal: number;
}

export interface MoveDefinition {
  id: string;
  name: string;
  /** The clip that presents this move. The kernel never reads it. */
  animation: string;
  startup: number;
  active: number;
  recovery: number;
  duration: number;
  hitboxes: readonly HitboxDefinition[];
  parry: ParryDefinition | null;
}

export interface FighterDefinition {
  id: string;
  name: string;
  maxHealth: number;
  walkSpeed: number;
  groundFriction: number;
  pushbox: Box;
  hurtboxes: readonly Box[];
  moves: Readonly<Record<string, MoveDefinition>>;
}

export interface FighterState {
  id: FighterId;
  x: number;
  vx: number;
  facing: Facing;
  mode: FighterMode;
  stateFrame: number;
  /** The move running while `mode` is `move`, otherwise null. */
  move: string | null;
  moveFrame: number;
  /** Damage every hit of the running move adds, carried into the counter its parry starts. */
  bonus: number;
  /** Health the running move's parry restores on top of its own heal. */
  heal: number;
  /** Damage the next hit that lands on this fighter adds; that hit clears it. */
  exposure: number;
  health: number;
  hitstop: number;
  stun: number;
  hitTargets: string[];
}

export interface SimulationState {
  tick: number;
  fighters: [FighterState, FighterState];
}

/**
 * What a fighter is told to do this tick. A move starts only if the fighter can act, and may be
 * committed with an integer damage bonus that every one of its hits adds and an integer heal its
 * parry adds.
 */
export type Command =
  | { readonly kind: "move"; readonly move: string; readonly bonus?: number; readonly heal?: number }
  | { readonly kind: "walk"; readonly direction: Facing }
  | null;

export type CombatEventKind =
  | "move-started"
  | "phase-changed"
  | "move-ended"
  | "hit"
  | "damage-received"
  | "parried"
  | "healed"
  | "afflicted"
  | "defeated"
  | "state-changed"
  | "recovered";

export interface CombatEvent {
  frame: number;
  kind: CombatEventKind;
  fighter?: FighterId;
  source?: FighterId;
  target?: FighterId;
  detail: string;
}

export interface ContactEvent {
  source: FighterId;
  target: FighterId;
  hitboxId: string;
  overlap: Aabb;
  damage: number;
  parried: boolean;
  /** Health the target regained through this contact: a parry's heal, as actually applied. */
  heal: number;
  /** The exposure this hit added and cleared on its target. */
  exposed: number;
}

export interface FrameReport {
  frame: number;
  contacts: ContactEvent[];
  events: CombatEvent[];
}

export interface DebugBoxes {
  origins: Array<{ x: number; y: number }>;
  pushboxes: Aabb[];
  hurtboxes: Aabb[][];
  hitboxes: Aabb[][];
  parrying: boolean[];
}

export interface SimulationConfig {
  definitions: readonly [FighterDefinition, FighterDefinition];
  startX: readonly [number, number];
}
