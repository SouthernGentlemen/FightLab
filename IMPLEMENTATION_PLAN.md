# FightLab — MVP implementation plan

This is the source of truth for the first playable vertical slice. [`AGENTS.md`](AGENTS.md) is
the contract every path is held to; this file says what is being built inside it, what was
decided and why, and what is deliberately left out.

## Product goal

The smallest clean autobattler in which the player programs a repeating five-action combat
sequence and watches it resolve.

- Three actions: **Strike** (red), **Tech** (yellow), **Block** (blue).
- A strict cycle: Strike beats Tech, Tech beats Block, Block beats Strike.
- The player chooses exactly five actions. The opponent owns another five.
- Slot `i` meets slot `i`; after slot 5 both programs wrap to slot 1 and repeat until a fighter
  reaches zero health.
- The strategy is choosing the loop. The animation and collision system physically resolves the
  result.

The one question this slice answers: *is programming a five-action loop and watching two
properly animated fighters resolve it actually fun?* Everything else waits.

## What the survey found

The brief described Boneyard as the home of the rig, the art, the clips *and* the reusable combat
primitives. Reading both repositories (Boneyard `604f903`, SVGLab `fb233da`) shows the line is
drawn differently, and this plan follows the code:

| Concern | Where it lives | What FightLab does with it |
| --- | --- | --- |
| Rig contract, validation, FK | Boneyard `src/rig/` (`validateRig`, `forwardKinematics`) | Imports it |
| The one sampler, the clip shape | Boneyard `src/rig/sample.ts`, `src/clips/types.ts` | Imports it |
| Depth profile per clip | Boneyard `src/rig/depth.ts` (`depthProfileName`) | Imports it |
| Depth order for world-space bone groups | Boneyard `pipelines/render/depth.ts`, exported as `boneyard/render/depth` (`visualPaintOrder`, pure) | Imports it |
| Figure loading, part and cosmetic assembly | Boneyard `pipelines/render/sheet.ts`, exported as `boneyard/render/sheet` (`loadFigure`, `assembleFigureBones`; Node only) | Runs it at serve/build time |
| Clip catalog, rigs, figures, parts, cosmetics | Boneyard asset directories | Reads them through the loader and the catalog export |
| Contact frames of retargeted clips | Boneyard `motions/bandai-namco-motiondataset-1.json` | Tests bind move windows to them |
| **Combat kernel** | **SVGLab `src/kernel/`** — not Boneyard. Boneyard's contract puts "no combat" and "move timing" explicitly out of its scope | Derived into `src/combat/kernel/` (see AGENTS.md *Lineage*) |
| DOM figure assembly (nested hierarchy) | SVGLab `src/render/assemble.ts`, `place.ts` | Not used. FightLab draws flat world-space bone groups the way Boneyard's own contact sheets do, so every transform comes from Boneyard's FK |
| Preview shell, sidecar, Worker | SVGLab `src/shell/`, `pipelines/dev/` | Not used |

Consequences:

- **No upstream Boneyard change is required.** Every function and file FightLab needs is already
  a declared export of the `boneyard` package.
- **The combat kernel is FightLab's.** It is the same model — the same tick domain, fixed point,
  boxes, frame phases, hitstop, hitstun, pushback and single-hit gate — reduced for two fighters
  that fight each other. Moving it into Boneyard would contradict Boneyard's contract and turn it
  toward being the game; importing it from SVGLab would make a laboratory application a runtime
  dependency and would not remove the changes an autobattler needs (string move tables,
  simultaneous contact, parry).
- SVGLab keeps its own lab kernel. If the two ever need to converge, the answer is a shared
  combat package, not Boneyard.

## Architectural boundaries

```
Boneyard ──► FightLab          (never the reverse)

src/battle   ── declares Arena ──┐
src/combat/adapter ── implements Arena over src/combat/kernel
src/render   ── reads combat + battle state, draws Boneyard figures
src/game     ── composes battle + combat into a match; clock; settings
src/ui       ── three screens
```

Import rules, each enforced by `tests/architecture.test.ts`:

| Directory | May import |
| --- | --- |
| `src/battle/` | only `src/battle/` |
| `src/combat/kernel/` | only `src/combat/kernel/`; no DOM, wall clock or `Math.random` |
| `src/combat/` | the kernel; `src/battle/` (the adapter only); the type of Boneyard's clip catalog (the frame data only, because a move names its clip) |
| `src/render/` | the kernel, `boneyard`, `boneyard/render/depth`, Boneyard's clip catalog |
| `src/game/` | battle and combat |
| `src/ui/`, `src/main.ts` | anything above |
| `src/**` | never `pipelines/` |

And from the other side: nothing under Boneyard's `src/` or `pipelines/` mentions FightLab, and
`boneyard` is FightLab's only runtime dependency.

## Action rules

```ts
type ActionType = "strike" | "tech" | "block";
type ActionProgram = readonly [ActionType, ActionType, ActionType, ActionType, ActionType];
type MatchupResult = "player" | "opponent" | "tie";
```

- A new player program is `strike, strike, strike, strike, strike`.
- Every slot is independent: setting slot 3 returns a new program in which only slot 3 differs.
- The opponent's program has exactly the same type and validation.
- An action definition separates the strategic action from its implementation:

| Action | Colour | Combat move |
| --- | --- | --- |
| `strike` | red `#e5484d` | `jab` |
| `tech` | yellow `#f2c94c` | `overhead` |
| `block` | blue `#4c8df6` | `parry` |

The table is per side (`ActionTable`), so a future fighter can map Strike to a different move
without the battle layer noticing.

## Matchup matrix

`resolveMatchup(player, opponent)` is a pure function; the table below is its complete
behaviour and `tests/battle/matchup.test.ts` checks every cell.

| player ↓ / opponent → | strike | tech | block |
| --- | --- | --- | --- |
| **strike** | tie | player | opponent |
| **tech** | opponent | tie | player |
| **block** | player | opponent | tie |

Ties are a rule, not an accident:

- Same action against same action: both actions resolve. Strike/Strike and Tech/Tech trade —
  both hitboxes connect on the same tick and both fighters take damage, because contact is
  detected simultaneously.
- Block against Block: nothing offensive exists, both guards lower, and the loop advances.

## How an exchange resolves physically

Each slot opens one exchange. The director decides who *should* win; the kernel makes it happen
through contact, and a test proves the two always agree.

| Move | Action | Startup / active / recovery | Hitbox or window | Effect |
| --- | --- | --- | --- | --- |
| `jab` | strike | 5 / 3 / 12 | fist, frames 5–7, reach 76 px | 12 damage, 16 hitstun |
| `overhead` | tech | 14 / 4 / 12 | overhead, frames 14–17, reach 86 px, **breaks guard** | 16 damage, 20 hitstun |
| `parry` | block | 2 / 16 / 10 | parry window, frames 2–17, no hitbox | a jab that touches it is absorbed: the jabber is stunned 28 ticks, the parrier answers with `riposte` |
| `riposte` | (block's answer) | 5 / 3 / 12 | fist, frames 5–7 | 14 damage, 20 hitstun |

- **Strike beats Tech** because the jab connects on frame 5, while the overhead is still in
  startup until frame 14; hitstun cancels the overhead, so it never becomes active.
- **Tech beats Block** because the overhead's hitbox breaks guard: the parry window cannot absorb
  it, and a parry has no hitbox with which to hurt anyone.
- **Block beats Strike** as a counter, not a passive guard: the jab's contact is absorbed, the
  jabber recoils into hitstun, and the riposte lands through its own hitbox.
- The loser never deals damage because its animation began: the overhead is interrupted, the
  parry has nothing to hit with, and the jab is absorbed.

Exchange pacing, all in ticks:

1. **Approach.** After an exchange, knockback has moved the fighters. Each walks back to its mark
   (±40 px from centre) once both have settled.
2. **Beat.** Both fighters stand ready at their marks for 24 ticks (45 before the first
   exchange) so the slot highlight and the reveal can be read.
3. **Clash.** Both moves are committed on the same tick.
4. **Settle.** The exchange closes when both fighters are actionable (or defeated), out of
   hitstop and motionless. Only then does the cursor advance.

## Battle state machine

```
planning ──fight()──► fighting ──(a fighter defeated, exchange settled)──► ko
   ▲                     │                                                  │
   └────────rematch()────┴──────────────────────────────────────────────────┘
```

```ts
interface BattleState {
  phase: "planning" | "fighting" | "ko";
  actionIndex: number;      // 0..4, the slot being resolved
  cycle: number;            // 0-based loop count, shown as "loop n + 1"
  playerProgram: ActionProgram;
  opponentProgram: ActionProgram;
  exchange: Exchange | null;
  history: ExchangeRecord[];
  outcome: MatchOutcome | null;
  tick: number;
}
```

- **planning:** the player program is editable. No simulation runs; fighters idle at their
  marks on a presentation clock.
- **fighting:** programs are locked. Each tick the director opens an exchange for the current
  slot if none is open, commits it after the beat, steps the arena, and closes it when the arena
  reports it settled. Closing records the damage each side took, whether the physics agreed with
  the matrix, and advances `0 → 1 → 2 → 3 → 4 → 0`, incrementing `cycle` on the wrap.
- **ko:** entered when an exchange settles with a fighter defeated. The simulation stops; no
  further action executes. Outcome is `victory`, `defeat`, or `draw` for a double knockout.
- **Termination guards**, deterministic and visible, never random damage:
  - *stalemate* — a whole cycle in which nobody took damage will repeat forever, so it ends the
    match as a draw;
  - *limit* — 30 cycles is a backstop that ends the match as a draw.
- **rematch:** a fresh simulation, cursor and history; the player's program is kept.

## Opponent

A fixed five-slot program, the same `ActionProgram` type as the player's:

```
[Tech] [Block] [Strike] [Tech] [Strike]
```

It is hidden during combat. The only opponent action ever shown is the one in the exchange being
resolved, revealed when both moves commit. The program comes from the match configuration, so a
seeded generator can replace the constant without touching the director; there is no randomness
in this slice.

## Boneyard dependency contract

`package.json` declares `"boneyard": "file:../Boneyard"`, the consumption rule Boneyard's own
`AGENTS.md` documents. `boneyard.pin.json` holds the commit and a SHA-256 digest of every
consumed file; `pipelines/pin.ts` recomputes it. `npm run check:boneyard` runs before `dev` and
`build`, inside `verify`, and as a test.

Consumed at runtime, in the browser:

| Import | From | Used for |
| --- | --- | --- |
| `validateRig`, `Rig` | `boneyard` (`src/rig/contract.ts`) | validate the rig delivered with each figure |
| `sampleClip`, `Clip`, `Pose` | `boneyard` (`src/rig/sample.ts`, `src/clips/types.ts`) | the pose at a tick |
| `forwardKinematics`, `inBone`, `Placed` | `boneyard` (`src/rig/fk.ts`) | bone placement; the debug skeleton |
| `depthProfileName` | `boneyard` (`src/rig/depth.ts`) | which depth profile a clip is drawn with |
| `visualPaintOrder` | `boneyard/render/depth` | the order bone groups paint in |
| `catalog/clips.json` | `boneyard/catalog/clips.json` | every clip, bundled |

Consumed at serve and build time, in Node:

| Import | From | Used for |
| --- | --- | --- |
| `BONEYARD_ROOT` | `boneyard/paths` | locating the checkout |
| `loadFigure`, `assembleFigureBones` | `boneyard/render/sheet` | figure manifest → validated rig, parts and cosmetics → per-bone depth layers, served as `/fighters/<id>.json` |

Consumed by tests only: `motions/bandai-namco-motiondataset-1.json` (`contactTargetFrame`), to
bind each retargeted clip's contact pose inside its move's active window.

Figures used: `figures/fighter.json` for the player and `figures/barst.json` for the opponent,
both on `rigs/fighter.rig.json`.

What would require an upstream change, and would be made in Boneyard: new authored clips
(below), a new figure, or a rig change. `visualPaintOrder` lives under Boneyard's `pipelines/`
although it is pure runtime logic; if Boneyard later moves it beside `depthProfileName` in
`src/rig/depth.ts`, FightLab changes one import.

## Animation mapping

Strategy picks an action, the action table picks a move, the move names its clip. Battle rules
never see a clip name.

| Presents | Clip | Status |
| --- | --- | --- |
| `jab` (Strike) | `bnrStrikeNormal` | Authored for this timing: contact pose at tick 6 inside frames 5–7 |
| `overhead` (Tech) | `bnrSwordSlashNormal` | **Placeholder.** A sword cut played unarmed; its contact pose (tick 15) sits inside frames 14–17. Missing: an authored unarmed guard-break or throw |
| `parry` (Block) | `bnrSwordGuardNormal` | **Placeholder.** A two-handed ready stance stands in for the guard. Missing: an authored parry/deflect |
| `riposte` (Block's answer) | `bnrStrikeNormal` | **Placeholder.** Reuses the jab. Missing: an authored counter |
| walking to the mark | `bnrWalkNormal` | Correct |
| idle | `bnrIdleNormal` | Correct |
| hitstun | `bnrCrouchNormal` | **Placeholder.** The bow descent reads as a flinch. Missing: a hit reaction |
| defeated | `bnrCrouchNormal`, held | **Placeholder.** Missing: a knockdown |
| victory | `labWave` | Original authored wave |

## Rendering flow

1. `pipelines/figures.ts` runs Boneyard's `loadFigure` + `assembleFigureBones` for a roster
   figure and serialises the result as `{ contract, figure, name, rig, bones }` — the rig exactly
   as Boneyard wrote it and each bone's `under`, `part`, `over`, `outer` markup. The plugin in
   `vite.config.ts` serves it as `/fighters/<id>.json` in development and emits it into
   `dist/fighters/` in a build.
2. The browser fetches it, runs `validateRig`, and builds one `<g data-bone>` per bone with its
   four depth layers.
3. Every rendered frame, for each fighter: pick a clip from combat state (a move's clip at
   `moveFrame`, otherwise the mode's clip at `stateFrame`), `sampleClip`, `forwardKinematics`,
   set each bone group's transform, and reorder the groups by `visualPaintOrder` when facing or
   depth profile changes.
4. Health bars, the highlighted slot and the revealed opponent action read battle and combat
   state; they are never written by the renderer.
5. With `?debug`, the stage also draws pushboxes, hurtboxes (blue while parrying), active
   hitboxes, contacts and the FK skeleton, and a panel shows tick, clip, frame, move phase, both
   actions, the matchup result, the slot and the loop.

## MVP screens

- **Title** — `FIGHTLAB`, `Play`, `Settings`. Nothing else.
- **Settings** — Battle speed `1x / 2x / 4x`, `Reset settings`, `Return`. Stored in
  `localStorage`, and the page works without it.
- **Play** — both health bars; a large stage with both fighters; the current exchange line; five
  slots; `FIGHT`.
  - *planning:* slots open a three-button picker (Strike / Tech / Block) that replaces the slot
    immediately; the one-line rule reminder is visible; a small back control returns to Title.
  - *fighting:* slots are locked; the resolving slot is highlighted; the opponent's action for
    that exchange is revealed; health moves only when contact lands.
  - *ko:* `VICTORY`, `DEFEAT` or `DRAW`, with `Rematch` (same program) and `Title`.
- Desktop first; below 640 px the five slots shrink into one row of equal columns.

## Testing requirements

Run with `npm test`; all headless.

| Requirement | Test |
| --- | --- |
| All nine matchups | `tests/battle/matchup.test.ts` |
| Program defaults, slot isolation, validation, `0→1→2→3→4→0` with cycle increment | `tests/battle/program.test.ts` |
| Opponent uses the same five-action contract | `tests/battle/opponent.test.ts` |
| Director lifecycle: locked program while fighting, exchange ordering, KO stops the loop, no sixth action after KO, stalemate and limit draws, rematch keeps the program | `tests/battle/director.test.ts` |
| Kernel frame boundaries, simultaneous trades, parry → riposte, guard break, single-hit gate, content validation | `tests/combat/kernel.test.ts` |
| Every one of the nine pairs resolves physically as the matrix says, damage arrives only through contact, and the loser deals none | `tests/combat/exchange.test.ts` |
| Clip contact poses inside move windows; every named clip exists in the catalog | `tests/combat/frame-data.test.ts` |
| Same programs → same result; 1×/2×/4× identical; every one of the 243 player programs terminates against the opponent and agrees with the matrix | `tests/game/determinism.test.ts` |
| Default program, no simulation while planning, locked program, combat stops at KO, rematch from a clean simulation with the program kept; clock and settings | `tests/game/match.test.ts` |
| Figures assemble from Boneyard's loader; the renderer's clip choice is total | `tests/render/figures.test.ts` |
| Layer import rules, kernel seal, vocabulary boundary, Boneyard never imports FightLab | `tests/architecture.test.ts` |
| Installed Boneyard matches the pin | `tests/boneyard-pin.test.ts` |

## Measured

From the simulation, not estimated. The first three are also asserted by
`tests/game/determinism.test.ts`, so a change to frame data or to the opponent shows up in a diff.

- Across all 243 possible player programs against the opponent: **107 victories, 117 defeats,
  19 draws** (every draw a double knockout from a trade). No exchange in any of them disagreed
  with the matrix.
- The default five strikes win: 11 exchanges, 762 ticks (12.7 s at 1×), 24 health left.
- The counter-program `Strike Tech Block Strike Block` wins every exchange; its mirror
  `Block Strike Tech Block Tech` loses every one.
- Matches run 7 to 21 exchanges. One exchange is 29–52 ticks of clash plus the walk back and a
  24-tick beat, roughly a second at 1×.
- All 243 matches simulate in about 65 ms.

## Out of scope

Character progression, equipment stats, inventory, campaign, matchmaking, networking, accounts,
cloud persistence, monetisation, a large AI system, procedural moves, a character creator,
complicated settings, audio, a frontend framework, a Worker or any deployment. There are no
directories for any of them.

## Future work

Hooks the contracts already leave room for, none of them implemented:

- Different fighters with different action tables and frame data (`ActionTable` and
  `FighterDefinition` are per side already).
- Several Strike, Tech or Block moves; action upgrades; action replacement; action speed — all
  changes to a move table or an action table, not to `resolveMatchup`.
- Authored motion to replace the placeholders above, made in Boneyard and accepted through the pin.
- Damage and balance per fighter; status effects.
- Scouting, partial reveals and prediction: the opponent program is already hidden behind the
  exchange being resolved.
- Enemy archetypes and seeded procedural opponent programs; any randomness joins the match
  configuration as a seed.
- Best-of-N matches and draft/build phases above the director.

## Vertical slice checklist

1. FightLab is its own repository.
2. It consumes a Boneyard figure and rig without copying the upstream rig or art.
3. Title has Play and Settings.
4. Play opens the planning screen.
5. Both fighters render.
6. The player sees a five-slot action program.
7. Every slot defaults to Strike.
8. Each slot can independently become Strike, Tech or Block.
9. Fight locks the program and starts combat.
10. The opponent has its own deterministic five-action sequence.
11. Slot matchup follows the exact matrix.
12. Exchanges resolve through the deterministic combat and hitbox system.
13. The active slot is visually highlighted.
14. Programs wrap from slot 5 back to slot 1.
15. Combat stops on KO.
16. Victory or Defeat appears.
17. Rematch works.
18. Battle speed does not alter the deterministic outcome.
19. Debug hitbox and skeleton information remains available outside the normal game UI.
20. Automated tests cover the battle rules and the combat integration.
