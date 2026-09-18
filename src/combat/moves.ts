import type catalog from "boneyard/catalog/clips.json";

import { px } from "./kernel/index.ts";
import type { Box, FighterDefinition, MoveDefinition } from "./kernel/index.ts";

type ClipName = keyof typeof catalog.clips;

/** A move names its clip from Boneyard's catalog, so a clip that does not exist fails tsc. */
function clip(name: ClipName): string {
  return name;
}

const FIST: Box = { x: px(24), y: px(44), w: px(52), h: px(26) };

/**
 * Strike performs this: SVGLab's basic strike, frame for frame. Its hitbox is out on frame 5,
 * while an overhead is still winding up, and a parry can absorb it.
 */
export const JAB: MoveDefinition = {
  id: "jab",
  name: "Jab",
  animation: clip("bnrStrikeNormal"),
  startup: 5,
  active: 3,
  recovery: 12,
  duration: 20,
  hitboxes: [{
    id: "fist",
    box: FIST,
    startFrame: 5,
    endFrame: 7,
    damage: 12,
    hitstun: 16,
    hitstopAttacker: 6,
    hitstopDefender: 8,
    pushbackAttacker: px(-0.8),
    pushbackDefender: px(3.2),
    breaksGuard: false,
  }],
  parry: null,
};

/**
 * Tech performs this: a committed overhead on SVGLab's sword-slash timing, played unarmed until
 * Boneyard has an authored guard-break. Nine frames slower than the jab, so a jab interrupts it;
 * it breaks guard, so a parry cannot absorb it.
 */
export const OVERHEAD: MoveDefinition = {
  id: "overhead",
  name: "Overhead",
  animation: clip("bnrSwordSlashNormal"),
  startup: 14,
  active: 4,
  recovery: 12,
  duration: 30,
  hitboxes: [{
    id: "overhead",
    box: { x: px(20), y: px(26), w: px(66), h: px(52) },
    startFrame: 14,
    endFrame: 17,
    damage: 16,
    hitstun: 20,
    hitstopAttacker: 8,
    hitstopDefender: 11,
    pushbackAttacker: px(-1),
    pushbackDefender: px(4.2),
    breaksGuard: true,
  }],
  parry: null,
};

/**
 * Block performs this. Not a passive guard: the parry window absorbs a jab, leaves the jabber
 * stunned, and turns straight into the riposte, which still has to connect. The guard stance is
 * Boneyard's sword-ready loop until an authored parry exists.
 */
export const PARRY: MoveDefinition = {
  id: "parry",
  name: "Parry",
  animation: clip("bnrSwordGuardNormal"),
  startup: 2,
  active: 16,
  recovery: 10,
  duration: 28,
  hitboxes: [],
  parry: {
    startFrame: 2,
    endFrame: 17,
    counter: "riposte",
    stun: 28,
    hitstopAttacker: 10,
    hitstopDefender: 10,
    pushbackAttacker: px(1.6),
  },
};

/** The parry's answer. It reuses the jab's clip until an authored counter exists. */
export const RIPOSTE: MoveDefinition = {
  id: "riposte",
  name: "Riposte",
  animation: clip("bnrStrikeNormal"),
  startup: 5,
  active: 3,
  recovery: 12,
  duration: 20,
  hitboxes: [{
    id: "riposte",
    box: FIST,
    startFrame: 5,
    endFrame: 7,
    damage: 14,
    hitstun: 20,
    hitstopAttacker: 8,
    hitstopDefender: 10,
    pushbackAttacker: px(-0.8),
    pushbackDefender: px(3.6),
    breaksGuard: false,
  }],
  parry: null,
};

/** Both sides fight on this in the first slice. Body geometry is SVGLab's standing lab fighter. */
export const FIGHTLAB_FIGHTER: FighterDefinition = {
  id: "fightlab-fighter",
  name: "FightLab fighter",
  maxHealth: 100,
  walkSpeed: px(1.8),
  groundFriction: px(0.35),
  pushbox: { x: px(-15), y: 0, w: px(30), h: px(78) },
  hurtboxes: [
    { x: px(-16), y: 0, w: px(32), h: px(48) },
    { x: px(-18), y: px(48), w: px(36), h: px(42) },
  ],
  moves: { jab: JAB, overhead: OVERHEAD, parry: PARRY, riposte: RIPOSTE },
};
