import { describe, expect, it } from "vitest";

import { actionBar, actionLoadout, BAR_IDS } from "../../src/battle/bars.ts";
import { opponentPlan } from "../../src/battle/mixup.ts";
import { fightFor, resumeFight } from "../../src/game/fight.ts";
import { Match } from "../../src/game/match.ts";
import { compileBuild } from "../../src/mods/compile.ts";
import { BOARD_HEIGHT, BOARD_WIDTH, turnAbout } from "../../src/mods/grid.ts";
import { MOD_IDS } from "../../src/mods/registry.ts";
import { decodeSave, encodeSave } from "../../src/run/save.ts";
import { beginFight, buy, move, newRun, sell, setAction } from "../../src/run/run.ts";

function snapshot(match: Match): unknown {
  return JSON.parse(JSON.stringify({
    battle: match.battle,
    combat: match.arena.state,
    decisions: match.decisions,
    mods: match.mods.states,
  }));
}

function untilPause(match: Match): void {
  for (let guard = 0; !match.paused && !match.over && guard < 100_000; guard++) match.step();
}

describe("a whole catalogue run, headless", () => {
  it("buys, places, turns, moves, banks, sells, saves, resumes and lands adjacency Burn", () => {
    expect([BOARD_WIDTH, BOARD_HEIGHT]).toEqual([4, 4]);
    expect(MOD_IDS).toHaveLength(64);

    const run = newRun(8080);
    run.money = 100;
    run.shop = {
      ...run.shop,
      offers: ["searpoint", "kiln-shield", "hardpoint", "flashpoint", null],
    };

    // Buy and place Searpoint, then use the pure turnAbout geometry before moving it.
    expect(buy(run, 0, { grid: { x: 0, y: 0, rotation: 0 } })).toBeNull();
    const searpointUid = run.grid[0].uid;
    const turned = turnAbout(run.grid[0], { x: 0, y: 0 });
    expect(turned).toMatchObject({ x: 0, y: 0, rotation: 90 });
    expect(move(run, { piece: searpointUid }, {
      grid: { x: turned!.x, y: turned!.y, rotation: turned!.rotation },
    })).toBeNull();
    expect(move(run, { piece: searpointUid }, {
      grid: { x: 1, y: 0, rotation: turned!.rotation },
    })).toBeNull();

    // Bank a Solar Block neighbour, then move it beside Searpoint. It will not fire on Strike.
    expect(buy(run, 1)).toBeNull();
    const kilnUid = run.bank[0]!.uid;
    expect(move(run, { bank: 0 }, { grid: { x: 2, y: 0, rotation: 0 } })).toBeNull();

    // Exercise a separate bank-and-sell path, then leave another real catalogue mod banked.
    expect(buy(run, 2)).toBeNull();
    const beforeSell = run.money;
    expect(sell(run, { bank: 0 })).toBeNull();
    expect(run.money).toBeGreaterThan(beforeSell);
    expect(buy(run, 3)).toBeNull();
    expect(run.bank[0]?.mod).toBe("flashpoint");

    const prepSave = decodeSave(encodeSave(run, null));
    expect(prepSave).not.toBeNull();
    expect(prepSave!.run).toEqual(run);
    expect(prepSave!.fight).toBeNull();

    for (const bar of BAR_IDS) {
      for (const slot of [0, 1, 2] as const) expect(setAction(run, bar, slot, "strike")).toBeNull();
    }
    expect(beginFight(run)).toBeNull();

    const config = fightFor(run).config;
    const searpoint = config.programs[0].mods.find(({ uid }) => uid === searpointUid);
    expect(searpoint?.definition.id).toBe("searpoint");
    expect(searpoint?.adjacent).toEqual([kilnUid]);
    expect(searpoint?.adjacentSame).toBe(1);

    // Fight saves store decisions, then rebuild exactly through fightFor + resumeFight.
    const decisions = [true] as const;
    const beforeReload = resumeFight(config, decisions);
    expect(beforeReload.over).toBe(false);

    const fightSave = decodeSave(encodeSave(run, { decisions }));
    expect(fightSave).not.toBeNull();
    expect(fightSave!.run).toEqual(run);
    expect(fightSave!.fight).toEqual({ decisions: [true] });

    const afterReload = resumeFight(fightFor(fightSave!.run).config, fightSave!.fight!.decisions);
    expect(snapshot(afterReload)).toEqual(snapshot(beforeReload));

    // Searpoint's Burn scales with its adjacent Solar neighbour. Force a landed Strike round.
    const tech = actionBar("tech", "tech", "tech");
    const landed = new Match({
      ...fightFor(fightSave!.run).config,
      opponent: opponentPlan(actionLoadout(tech, tech), { kind: "steady" }),
    });
    untilPause(landed);
    expect(landed.paused || landed.over).toBe(true);
    expect(compileBuild(fightSave!.run.grid).program.mods.find(({ uid }) => uid === searpointUid)?.adjacent)
      .toEqual([kilnUid]);
    expect(landed.mods.states[1].burn).toBeGreaterThan(0);
  });
});
