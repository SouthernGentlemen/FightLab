import { describe, expect, it } from "vitest";

import { MARKS } from "../../src/combat/adapter.ts";
import { CombatSimulation, debugBoxes, movePhase, px, validateContent } from "../../src/combat/kernel/index.ts";
import type { Command, FighterState, FrameReport, MoveDefinition } from "../../src/combat/kernel/index.ts";
import { FIGHTLAB_FIGHTER, JAB, OVERHEAD, PARRY } from "../../src/combat/moves.ts";

const move = (id: string): Command => ({ kind: "move", move: id });

function simulation(startX: readonly [number, number] = MARKS): CombatSimulation {
  return new CombatSimulation({ definitions: [FIGHTLAB_FIGHTER, FIGHTLAB_FIGHTER], startX });
}

/** One tick with the given commands, then `idle` ticks of nothing. Returns every report. */
function run(sim: CombatSimulation, commands: readonly [Command, Command], idle: number): FrameReport[] {
  const reports = [sim.step(commands)];
  for (let tick = 0; tick < idle; tick++) reports.push(sim.step([null, null]));
  return reports;
}

function events(reports: readonly FrameReport[], kind: string): FrameReport["events"] {
  return reports.flatMap((report) => report.events.filter((event) => event.kind === kind));
}

/** The same fighter seen from the other side of the stage. */
function mirrored(fighter: FighterState): FighterState {
  const other = fighter.id === "player" ? "opponent" : "player";
  return {
    ...fighter,
    id: other,
    x: -fighter.x,
    vx: fighter.vx === 0 ? 0 : -fighter.vx,
    facing: fighter.facing === 1 ? -1 : 1,
    hitTargets: fighter.hitTargets.map((gate) => gate.replace(/^(player|opponent)/, (id) => (id === "player" ? "opponent" : "player"))),
  };
}

describe("the combat kernel", () => {
  it("moves through exact startup, active and recovery boundaries", () => {
    const sim = simulation([px(-100), px(100)]);
    const player = sim.getState().fighters[0];
    sim.step([move("jab"), null]);
    expect(player).toMatchObject({ mode: "move", move: "jab", moveFrame: 0 });
    expect(movePhase(player, JAB)).toBe("startup");
    run(sim, [null, null], 3);
    expect(player.moveFrame).toBe(4);
    expect(movePhase(player, JAB)).toBe("startup");
    sim.step([null, null]);
    expect(player.moveFrame).toBe(5);
    expect(movePhase(player, JAB)).toBe("active");
    run(sim, [null, null], 2);
    expect(player.moveFrame).toBe(8);
    expect(movePhase(player, JAB)).toBe("recovery");
    const rest = run(sim, [null, null], 11);
    expect(player).toMatchObject({ mode: "idle", move: null, moveFrame: 0 });
    // Started on tick 0, so it ends on the tick numbered by its duration.
    expect(events(rest, "move-ended")).toMatchObject([{ fighter: "player", detail: "jab", frame: JAB.duration }]);
  });

  it("connects a jab once on frame 5: damage, hitstop, hitstun and knockback, then recovers", () => {
    const sim = simulation();
    const [player, opponent] = sim.getState().fighters;
    const reports = run(sim, [move("jab"), null], 5);
    expect(reports.at(-1)!.contacts).toMatchObject([{ source: "player", target: "opponent", hitboxId: "fist", damage: 12, parried: false }]);
    expect(opponent).toMatchObject({ health: 88, mode: "hitstun", stun: 16, hitstop: 8 });
    expect(player.hitstop).toBe(6);
    expect(opponent.vx).toBe(px(3.2));

    const later = run(sim, [null, null], 80);
    expect([...reports, ...later].filter((report) => report.contacts.length > 0)).toHaveLength(1);
    expect(opponent).toMatchObject({ health: 88, mode: "idle", vx: 0 });
    expect(player.mode).toBe("idle");
  });

  it("freezes a fighter in hitstop, move frame and all", () => {
    const sim = simulation();
    const player = sim.getState().fighters[0];
    run(sim, [move("jab"), null], 5);
    const frozenAt = player.moveFrame;
    for (let tick = 0; tick < 6; tick++) {
      sim.step([null, null]);
      expect(player.moveFrame).toBe(frozenAt);
    }
    sim.step([null, null]);
    expect(player.moveFrame).toBe(frozenAt + 1);
  });

  it("lands a hitbox once per target however many frames it overlaps", () => {
    // Pinned against the wall the opponent cannot be knocked out of reach, so the fist overlaps
    // it on every active frame; the gate is what keeps that to one hit.
    const wall = px(280) - px(15);
    const sim = simulation([wall - px(80), wall]);
    const reports = run(sim, [move("jab"), null], 40);
    expect(events(reports, "hit")).toHaveLength(1);
    expect(sim.getState().fighters[1].health).toBe(88);
  });

  it("trades when both fighters connect on the same tick", () => {
    const sim = simulation();
    const reports = run(sim, [move("jab"), move("jab")], 5);
    expect(reports.at(-1)!.contacts.map(({ source, damage }) => [source, damage])).toEqual([["player", 12], ["opponent", 12]]);
    const [player, opponent] = sim.getState().fighters;
    expect(player).toMatchObject({ health: 88, mode: "hitstun" });
    expect(opponent).toEqual(mirrored(player));
  });

  it("never lets the order fighters are listed in decide an exchange", () => {
    for (const [first, second] of [["jab", "overhead"], ["jab", "parry"], ["overhead", "parry"], ["overhead", "overhead"]]) {
      const forward = simulation();
      const backward = simulation();
      run(forward, [move(first), move(second)], 90);
      run(backward, [move(second), move(first)], 90);
      const [a, b] = forward.getState().fighters;
      const [c, d] = backward.getState().fighters;
      expect(c, `${first} against ${second}`).toEqual(mirrored(b));
      expect(d, `${first} against ${second}`).toEqual(mirrored(a));
    }
  });

  it("parries a jab and answers with a riposte that has to land on its own", () => {
    const sim = simulation();
    const [player, opponent] = sim.getState().fighters;
    const reports = run(sim, [move("jab"), move("parry")], 5);
    expect(reports.at(-1)!.contacts).toMatchObject([{ source: "player", target: "opponent", damage: 0, parried: true }]);
    expect(player).toMatchObject({ health: 100, mode: "hitstun", stun: PARRY.parry!.stun, move: null });
    expect(opponent).toMatchObject({ health: 100, mode: "move", move: "riposte", moveFrame: 0 });

    const answer = run(sim, [null, null], 60);
    expect(events(answer, "hit")).toMatchObject([{ source: "opponent", target: "player", detail: "riposte connected" }]);
    expect(player.health).toBe(86);
    expect(opponent.health).toBe(100);
  });

  it("lets an overhead through a parry", () => {
    const sim = simulation();
    const [player, opponent] = sim.getState().fighters;
    const reports = run(sim, [move("overhead"), move("parry")], 40);
    expect(events(reports, "parried")).toHaveLength(0);
    expect(events(reports, "hit")).toMatchObject([{ source: "player", target: "opponent", detail: "overhead connected", frame: OVERHEAD.startup }]);
    expect(opponent.health).toBe(84);
    expect(player.health).toBe(100);
  });

  it("interrupts an overhead still in startup, so it never becomes active", () => {
    const sim = simulation();
    const opponent = sim.getState().fighters[1];
    const reports = run(sim, [move("jab"), move("overhead")], 60);
    expect(events(reports, "hit")).toMatchObject([{ source: "player", frame: JAB.startup }]);
    expect(events(reports, "phase-changed").filter((event) => event.fighter === "opponent").map((event) => event.detail)).toEqual(["startup"]);
    expect(opponent.health).toBe(88);
  });

  it("knocks a fighter out at zero health and keeps it down with nothing left to hit", () => {
    const sim = simulation();
    const opponent = sim.getState().fighters[1];
    opponent.health = 12;
    const reports = run(sim, [move("jab"), null], 200);
    expect(events(reports, "defeated")).toMatchObject([{ fighter: "opponent" }]);
    expect(opponent).toMatchObject({ health: 0, mode: "defeated" });
    expect(debugBoxes(sim.getState(), [FIGHTLAB_FIGHTER, FIGHTLAB_FIGHTER]).hurtboxes[1]).toEqual([]);
    run(sim, [move("jab"), null], 40);
    expect(opponent.health).toBe(0);
  });

  it("walks at walk speed on command and stops dead without one", () => {
    const sim = simulation();
    const player = sim.getState().fighters[0];
    const start = player.x;
    sim.step([{ kind: "walk", direction: 1 }, null]);
    sim.step([{ kind: "walk", direction: 1 }, null]);
    expect(player).toMatchObject({ mode: "walk", x: start + 2 * FIGHTLAB_FIGHTER.walkSpeed });
    sim.step([null, null]);
    expect(player).toMatchObject({ mode: "idle", vx: 0, x: start + 2 * FIGHTLAB_FIGHTER.walkSpeed });
  });

  it("ignores commands while a fighter is committed", () => {
    const sim = simulation([px(-100), px(100)]);
    const player = sim.getState().fighters[0];
    sim.step([move("overhead"), null]);
    for (let tick = 0; tick < 5; tick++) sim.step([move("jab"), null]);
    expect(player).toMatchObject({ move: "overhead", moveFrame: 5 });
  });

  it("refuses frame data a move cannot honour", () => {
    const broken = (patch: Partial<MoveDefinition>, key = "jab") =>
      () => validateContent({ ...FIGHTLAB_FIGHTER, moves: { ...FIGHTLAB_FIGHTER.moves, [key]: { ...FIGHTLAB_FIGHTER.moves[key], ...patch } } });
    expect(() => validateContent(FIGHTLAB_FIGHTER)).not.toThrow();
    expect(broken({ recovery: 11 })).toThrow(/duration must equal/);
    expect(broken({ id: "punch" })).toThrow(/does not match its key/);
    expect(broken({ hitboxes: [{ ...JAB.hitboxes[0], startFrame: 4 }] })).toThrow(/begins during startup/);
    expect(broken({ hitboxes: [{ ...JAB.hitboxes[0], endFrame: 8 }] })).toThrow(/beyond active frames/);
    expect(broken({ parry: { ...PARRY.parry!, endFrame: 18 } }, "parry")).toThrow(/parry window/);
    expect(broken({ parry: { ...PARRY.parry!, counter: "headbutt" } }, "parry")).toThrow(/unknown move 'headbutt'/);
    expect(broken({ parry: { ...PARRY.parry!, counter: "parry" } }, "parry")).toThrow(/chain forever/);
    expect(() => new CombatSimulation({ definitions: [FIGHTLAB_FIGHTER, FIGHTLAB_FIGHTER], startX: MARKS }).step([move("headbutt"), null]))
      .toThrow(/no move 'headbutt'/);
  });

  it("keeps every position, velocity and timer an integer", () => {
    const sim = simulation();
    const programs: Array<[string, string]> = [["jab", "overhead"], ["parry", "jab"], ["overhead", "overhead"], ["parry", "parry"]];
    for (const [first, second] of programs) {
      run(sim, [move(first), move(second)], 70);
      for (const fighter of sim.getState().fighters) {
        for (const value of [fighter.x, fighter.vx, fighter.health, fighter.hitstop, fighter.stun, fighter.moveFrame, fighter.stateFrame]) {
          expect(Number.isInteger(value)).toBe(true);
        }
      }
    }
  });
});
