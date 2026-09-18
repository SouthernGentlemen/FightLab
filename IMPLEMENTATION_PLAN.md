# FightLab — implementation plan: the run

This is the source of truth for the slice being built: a seeded run of days, each a prep → fight →
payday → next-day loop, fought with two three-action bars in discrete rounds. [`AGENTS.md`](AGENTS.md)
is the contract every path is held to; [`docs/RUN_DESIGN.md`](docs/RUN_DESIGN.md) is the design and
the record of every decision behind it. This file says what is built, in what shape, how it is tested,
what has been measured and what is deliberately left out.

The first slice — a single match of two five-action loops — proved that exchanges resolve physically
and agree with the matchup. Its kernel, frame data, Boneyard pipeline and determinism guarantees carry
over unchanged in spirit; its five-action program, planning phase and single fixed opponent do not.

## Product goal

The smallest clean run-based autobattler in which the player programs two three-action plans, packs
a mod grid, reads an opponent over a few rounds and chooses when to mix up.

- Three actions: **Strike**, **Tech**, **Block**, in a strict cycle: Strike beats Tech, Tech beats
  Block, Block beats Strike.
- Each fighter owns two **action bars** of exactly three actions. One is active at a time; a round
  plays it once, slot against slot; between rounds the player may **Mixup** to the other.
- A **run** of days: prep (shop, grid, bars) → fight → payday. Ten trophies win it; five hearts lose it.
- **Mods** change how hard a fighter hits, how much health it has and how much a parry heals —
  never who wins an exchange.
- Everything generated comes from the run seed; the fight has no randomness.

## Status

| Step | Content | State |
| --- | --- | --- |
| Design | `docs/RUN_DESIGN.md`, this plan, `AGENTS.md` | done |
| 1. Rules, headless | bars, rounds, pause, Mixup, mixup plans, style; shapes, grid, bank, catalogue, compile; PRNG streams, shop, economy, opponents, run, save | done |
| 2. Combat | kernel bonus and parry heal, adapter, compiled sides, C9 property test, determinism, the tuning bot and replays | done |
| 3. UI | 16:9 stage, prep, fight and pause, payday, run end, title, settings | done |
| 4. Tuning | bot runs, measured numbers below | first measurements in; balancing to follow |

## What the survey found

The first slice's survey (Boneyard `604f903`, SVGLab `fb233da`) still holds and this plan follows it:

| Concern | Where it lives | What FightLab does with it |
| --- | --- | --- |
| Rig contract, validation, FK | Boneyard `src/rig/` (`validateRig`, `forwardKinematics`) | Imports it |
| The one sampler, the clip shape | Boneyard `src/rig/sample.ts`, `src/clips/types.ts` | Imports it |
| Depth profile per clip | Boneyard `src/rig/depth.ts` (`depthProfileName`) | Imports it |
| Depth order for world-space bone groups | Boneyard `pipelines/render/depth.ts`, exported as `boneyard/render/depth` (`visualPaintOrder`, pure) | Imports it |
| Figure loading, part and cosmetic assembly | Boneyard `pipelines/render/sheet.ts`, exported as `boneyard/render/sheet` (`loadFigure`, `assembleFigureBones`; Node only) | Runs it at serve/build time |
| Clip catalog, rigs, figures, parts, cosmetics | Boneyard asset directories | Reads them through the loader and the catalog export |
| Contact frames of retargeted clips | Boneyard `motions/bandai-namco-motiondataset-1.json` | Tests bind move windows to them |
| **Combat kernel** | **SVGLab `src/kernel/`** — not Boneyard, whose contract puts combat and move timing out of scope | Derived into `src/combat/kernel/` (AGENTS.md *Lineage*) |

No upstream Boneyard change is required by the run: the three opponent figures (Barst, Kiran,
Yuliya) are already figures Boneyard's loader assembles.

## Architectural boundaries

```
Boneyard ──► FightLab          (never the reverse)

src/run      ── seeded run over mods and battle; told how each fight ended
src/mods     ── grid, catalogue, compile over battle's vocabulary
src/battle   ── declares Arena ──┐
src/combat/adapter ── implements Arena over src/combat/kernel
src/render   ── reads combat state, draws Boneyard figures on the arena
src/game     ── compiled build → combat side; a run's day → a fight; clock; roster; settings
src/ui       ── the screens
```

Import rules, each enforced by `tests/architecture.test.ts`:

| Directory | May import |
| --- | --- |
| `src/battle/` | only `src/battle/` |
| `src/mods/` | `src/mods/`, `src/battle/` |
| `src/run/` | `src/run/`, `src/mods/`, `src/battle/` |
| `src/combat/kernel/` | only `src/combat/kernel/`; no DOM, wall clock or `Math.random` |
| `src/combat/` | the kernel; `src/battle/` (the adapter only); the type of Boneyard's clip catalog (the frame data only, because a move names its clip) |
| `src/render/` | the kernel, `boneyard`, `boneyard/render/depth`, Boneyard's clip catalog |
| `src/game/` | battle, combat, mods, run |
| `src/ui/`, `src/main.ts` | anything above |
| `src/**` | never `pipelines/` |

`Math.random` and wall clocks are also kept out of `src/battle/`, `src/mods/` and `src/run/`: the one
fresh seed a new run needs is picked in `src/main.ts`. Nothing under Boneyard's `src/` or `pipelines/`
mentions FightLab, and `boneyard` is FightLab's only runtime dependency.

## Action rules

```ts
type ActionType = "strike" | "tech" | "block";
type ActionBar = readonly [ActionType, ActionType, ActionType];
type BarId = "primary" | "secondary";
interface ActionLoadout { readonly primary: ActionBar; readonly secondary: ActionBar }
type MatchupResult = "player" | "opponent" | "tie";
```

- A new run's loadout is Bar A `strike, tech, block` and Bar B `block, block, strike`.
- Bars are frozen; setting a slot returns a new bar in which only that slot differs, and a new
  loadout in which only that bar differs.
- The opponent's loadout has exactly the same type and validation.
- The action table is unchanged and per side:

| Action | Colour | Combat move |
| --- | --- | --- |
| `strike` | red `#e5484d` | `jab` |
| `tech` | yellow `#f2c94c` | `overhead` |
| `block` | blue `#4c8df6` | `parry` |

## Matchup matrix

`resolveMatchup(player, opponent)` is a pure function; the table below is its complete behaviour and
`tests/battle/matchup.test.ts` checks every cell. It is unchanged from the first slice.

| player ↓ / opponent → | strike | tech | block |
| --- | --- | --- | --- |
| **strike** | tie | player | opponent |
| **tech** | opponent | tie | player |
| **block** | player | opponent | tie |

- Strike/Strike and Tech/Tech trade: both hitboxes connect on the same tick.
- Block against Block: nothing offensive exists, both guards lower, and the round moves on.

## How an exchange resolves physically

Unchanged frame data. The director decides who *should* win; the kernel makes it happen through
contact, and a test proves the two always agree.

| Move | Action | Startup / active / recovery | Hitbox or window | Effect |
| --- | --- | --- | --- | --- |
| `jab` | strike | 5 / 3 / 12 | fist, frames 5–7, reach 76 px | 12 damage, 16 hitstun |
| `overhead` | tech | 14 / 4 / 12 | overhead, frames 14–17, reach 86 px, **breaks guard** | 16 damage, 20 hitstun |
| `parry` | block | 2 / 16 / 10 | parry window, frames 2–17, no hitbox | a jab that touches it is absorbed: the jabber is stunned 28 ticks, the parrier answers with `riposte` and may heal |
| `riposte` | (block's answer) | 5 / 3 / 12 | fist, frames 5–7 | 14 damage, 20 hitstun |

Mods reach an exchange two ways, neither of which touches a frame count:

- **Bonus damage.** The adapter commits each move with an integer bonus — the compiled bonus for
  that action, plus the Arc surge in a round the fighter entered with a Mixup. Every hit the move
  lands adds it, and a parry passes its bonus to the riposte it starts, so Block's bonus is riposte
  damage.
- **Parry heal.** The parry move of a compiled fighter carries `heal`; a successful parry restores that
  much, never past maximum health, and the kernel reports it.

Pacing, in ticks:

1. **Round intro.** Both fighters walk back to their marks (±40 px from centre) and stand ready for
   40 ticks.
2. **Beat.** Before each exchange both fighters stand ready for 24 ticks so the slot highlight and the
   reveal can be read.
3. **Clash.** Both moves are committed on the same tick.
4. **Settle.** The exchange closes when both fighters are actionable (or defeated), out of hitstop
   and motionless. After slot 3, that is when the pause begins.

## Fight state machine

```
round-intro ──ready──► fighting ──slot 3 settled──► round-pause ──nextRound()──► round-intro …
                          │                              │ mixup() toggles the player's bar
                          └──── an exchange settles with a fighter down ────► ko
```

```ts
type FightPhase = "round-intro" | "fighting" | "round-pause" | "ko";

interface BattleState {
  phase: FightPhase;
  round: number;                      // 1-based
  bars: [BarId, BarId];               // the active bar of each side
  mixedUp: [boolean, boolean];        // whether each side entered this round by switching
  playerLoadout: ActionLoadout;       // frozen
  opponentLoadout: ActionLoadout;     // frozen
  opponentMixup: MixupPlan;
  actionIndex: 0 | 1 | 2;
  exchange: Exchange | null;
  history: ExchangeRecord[];          // every exchange: round, slot, bars, actions, damage, healing, winner, agrees
  rounds: RoundRecord[];              // every finished round: bars, damage, exchange wins
  outcome: { result: MatchOutcome; reason: OutcomeReason; tick: number } | null;
  tick: number;
}
```

- **`createBattle(playerLoadout, opponentPlan)`** validates both loadouts, freezes them and starts in
  `round-intro` of round 1 on both primary bars. There is no planning phase and no API that edits a
  slot: a battle exists only once combat has begun.
- **round-intro:** the arena steps (fighters walk to their marks); after 40 consecutive ready ticks
  the round's first exchange opens.
- **fighting:** each tick the director opens the exchange for the current slot if none is open,
  commits it after the beat, steps the arena and closes it when the arena reports it settled. Closing
  records damage, healing, the physical winner and whether the physics agreed with the matrix, then
  either ends the fight (a knockout), enters the pause (slot 3) or advances `0 → 1 → 2`.
- **round-pause:** nothing is simulated. The opponent's decision for the next round is fixed on
  entry from its plan and the rounds so far. `mixup(state)` toggles the player's active bar and throws
  in any other phase. `nextRound(state)` applies both decisions and starts the next round's intro —
  unless the last round hurt nobody and the next would run the same two bars (stalemate), or the
  round limit (30) is reached, both draws.
- **ko:** the simulation stops; no further action executes. Outcome is `victory`, `defeat`, or `draw`
  for a double knockout, a stalemate or the limit.

## Opponent plans

```ts
interface OpponentPlan { primary: ActionBar; secondary: ActionBar; mixup: MixupPlan }
type MixupPlan =
  | { kind: "steady" } | { kind: "alternate" } | { kind: "reactive" }
  | { kind: "scripted"; rounds: readonly number[] };
```

`decideMixup(plan, rounds)` is a pure function of the plan and the finished rounds; all randomness
happened when the run generated the plan. `REFERENCE_OPPONENT` — `tech, block, strike` / `tech,
strike, strike`, steady — is what the combat and determinism tests measure against.

## Style

`src/battle/style.ts` reads exchange records, never damage amounts: an exchange is a **win** for the
side that hurt and was not hurt, a **loss** for the other, a **trade** when both were hurt and **even**
when nobody was. A win adds one to the chain and, from the second win of a chain on, is a combo that
raises the rank one step (C → B → A → S, capped); a loss or trade resets the chain and drops a rank
(floored at C); even changes nothing. Rounds are invisible to it. The peak rank pays at payday.

## Mods and compile

```ts
type ModAffinity = "solar" | "void" | "arc" | "neutral";
type Rotation = 0 | 1 | 2 | 3;
interface OwnedMod { uid: number; mod: ModId; rotation: Rotation }
interface PlacedMod extends OwnedMod { x: number; y: number }
```

- **Shapes** (`src/mods/shapes.ts`): MONO, DUO, I3, L3, O4, T4, L4; clockwise rotation, normalised to
  the top-left of the bounding box.
- **Grid** (`src/mods/grid.ts`): 3×3, rows are the Strike, Tech and Block lanes top to bottom. A
  placement is legal when every cell is on the board and empty. `rotateInPlace` keeps the top-left of
  the bounding box and succeeds only if the result is legal; otherwise the grid is unchanged. The bank
  is four slots holding any mod.
- **Catalogue** (`src/mods/catalog.ts`): the sixteen mods of `RUN_DESIGN.md` §7 as data.
- **`compileBuild(grid)`** (`src/mods/compile.ts`) returns plain numbers: lane power (+1 per affinity
  cell, +2 in an attuned row, +1 per cell touching Overclock), affinity cells and levels, the bonus
  damage per action (lane + Solar level + perks), the Arc surge (2 per Arc level + Thunderclap),
  bonus health (10 per Void level), parry heal, and the run perks: income, free rerolls and the style
  multiplier.
- **`combatSide(build)`** (`src/game/sides.ts`) is the bridge: the fighter definition with maximum
  health `100 + health` and its Block move's parry `heal`, the action table, and the bonus table the
  adapter commits with. It copies every timing field untouched, which C9's test checks.

## The run

`src/run/run.ts` is a state machine over a plain, serialisable `RunState` — seed, day, phase, hearts,
trophies, money, loadout, grid, bank, shop, the fight in progress and the last payday — with one
function per player action. Each returns `null` on success or a refusal the UI can show; none throws
on a legal-but-refused request (can't afford, no room).

| Phase | Actions |
| --- | --- |
| `prep` | `buy`, `sell`, `move`, `rotate`, `reroll`, `toggleLock`, `setAction`, `beginFight` |
| `fight` | none — the game layer runs the fight and reports it with `finishFight` |
| `payday` | `nextDay` |
| `over` | none — Champion or Knocked out |

- **Random streams** (`src/run/random.ts`): mulberry32 seeded by a hash of the run seed, a purpose
  and indices. `shop / day / reroll` gives a shop roll; `opponent / day` an opponent.
- **Shop** (`src/run/shop.ts`): five offers with replacement by tier odds per rank; reroll $1; Coupons'
  free rerolls; lock keeps unsold offers into tomorrow and refills sold slots from tomorrow's roll.
- **Economy** (`src/run/economy.ts`): start $10; sell for half, at least $1; payday base $5, result
  +$2 / +$1 / $0, interest +$1 per $5 held at the start of the fight (cap $2), style $0–$3 (doubled by
  Crowd Pleaser), Piggy Bank +$1 each.
- **Opponents** (`src/run/opponents.ts`): figure, archetype, two bars, a mixup plan and a build, all
  from `opponent / day`; the build is bought from that day's odds with a budget growing by day and
  packed greedily into the lanes its bars use most.
- **Save** (`src/run/save.ts`): `{ version: 1, run, fight: { decisions } | null }` in `localStorage`
  under `fightlab.run`. Decoding validates everything — version, integers in range, known mods, legal
  placements, a valid loadout — and returns `null` for anything else.

`src/game/fight.ts` builds the day's `Match` from a run (the player's compiled side and loadout
against the day's opponent), replays recorded Mixup decisions to resume one, and plays a whole fight
headlessly for tests and the bot.

## Boneyard dependency contract

`package.json` declares `"boneyard": "file:../Boneyard"`, the consumption rule Boneyard's own
`AGENTS.md` documents. `boneyard.pin.json` holds the commit and a SHA-256 digest of every consumed
file; `pipelines/pin.ts` recomputes it. `npm run check:boneyard` runs before `dev` and `build`, inside
`verify`, and as a test.

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

Figures used: `figures/fighter.json` for the player; `figures/barst.json`, `figures/kiran.json` and
`figures/yuliya.json` for opponents; all on `rigs/fighter.rig.json`.

What would require an upstream change, and would be made in Boneyard: new authored clips (below), a
new figure, or a rig change. `visualPaintOrder` lives under Boneyard's `pipelines/` although it is
pure runtime logic; if Boneyard later moves it beside `depthProfileName` in `src/rig/depth.ts`,
FightLab changes one import.

## Animation mapping

Strategy picks an action, the action table picks a move, the move names its clip. Battle rules never
see a clip name.

| Presents | Clip | Status |
| --- | --- | --- |
| `jab` (Strike) | `bnrStrikeNormal` | Authored for this timing: contact pose at tick 6 inside frames 5–7 |
| `overhead` (Tech) | `bnrSwordSlashNormal` | **Placeholder.** A sword cut played unarmed; its contact pose (tick 15) sits inside frames 14–17. Missing: an authored unarmed guard-break or throw |
| `parry` (Block) | `bnrSwordGuardNormal` | **Placeholder.** A two-handed ready stance stands in for the guard. Missing: an authored parry/deflect |
| `riposte` (Block's answer) | `bnrStrikeNormal` | **Placeholder.** Reuses the jab. Missing: an authored counter |
| walking to the mark | `bnrWalkNormal` | Correct |
| idle, and the frozen pause | `bnrIdleNormal` | Correct |
| hitstun | `bnrCrouchNormal` | **Placeholder.** The bow descent reads as a flinch. Missing: a hit reaction |
| defeated | `bnrCrouchNormal`, held | **Placeholder.** Missing: a knockdown |
| victory | `labWave` | Original authored wave |

## Rendering flow

1. `pipelines/figures.ts` runs Boneyard's `loadFigure` + `assembleFigureBones` for every roster
   figure and serialises the result as `{ contract, figure, name, rig, bones }`. The plugin in
   `vite.config.ts` serves it as `/fighters/<id>.json` in development and emits it into
   `dist/fighters/` in a build.
2. The browser fetches the player's figure and the day's opponent, runs `validateRig`, and builds one
   `<g data-bone>` per bone with its four depth layers.
3. Every rendered frame, for each fighter: pick a clip from combat state (a move's clip at
   `moveFrame`, otherwise the mode's clip at `stateFrame`, or the presentation clock while the fight
   is paused or over), `sampleClip`, `forwardKinematics`, set each bone group's transform, and reorder
   the groups by `visualPaintOrder` when facing or depth profile changes.
4. The arena — sky, pines, grass — is original SVG drawn in code on the same 1600 × 900 grid as the
   HUD. Health hearts, the bars, the reveal and the style meters read battle and combat state; the
   renderer never writes it.
5. With `?debug`, the stage also draws pushboxes, hurtboxes (blue while parrying), active hitboxes,
   contacts and the FK skeleton, and a panel shows tick, round, slot, bars, clips, move phases and the
   matchup.

## Screens

All inside the 16:9 stage (C10). Layouts and proportions are in `RUN_DESIGN.md` §10.

- **Title** — `FIGHTLAB`, `Continue` (when a run is saved), `New run`, `Settings`, fullscreen where the
  browser allows it.
- **Settings** — Battle speed `1x / 2x / 4x`, `Reset settings`, `Return`. Stored in `localStorage`; the
  page works without it.
- **Prep** — top bar (hearts, day, trophies, settings, leave); bank and grid in the centre; the two
  action bars in the right negative space; rank odds, money and Lock; Reroll, five offers and Fight.
  No opponent information. Drag to buy, move and sell; tap an offer to bank it; tap an owned mod to
  pick it up and tap where it goes (or arrows, R, Enter, B to bank, S to sell); right-click or R turns
  a placed mod in place; hover or focus explains anything.
- **Fight** — hearts and health numbers, round, speed, style meters, the active bar, the opponent's
  revealed actions, the current exchange; the **round pause** overlay with both bars, `Mixup` (M) and
  `Fight` (Enter or Space); the knockout result. The clock holds while the display is unsupported.
- **Payday** — outcome, trophy or heart change, the tally, `Next day`.
- **Run end** — `Champion` or `Knocked out`, the record, best style, the final build, `New run`,
  `Title`.
- **Unsupported** — portrait or too small: one card, nothing rearranged.

## Testing requirements

Run with `npm test`; all headless.

| Requirement | Test |
| --- | --- |
| All nine matchups | `tests/battle/matchup.test.ts` |
| Bars are three valid actions, loadouts two bars, slot isolation, freezing, defaults | `tests/battle/bars.test.ts` |
| Mixup plans: each kind's decisions, purity, replay | `tests/battle/mixup.test.ts` |
| Director: round 1 on primary, three exchanges per round, `0 → 1 → 2`, slot 3 settles before the pause, KO in slot 1 or 2 ends it, nothing after KO, Mixup toggles and is refused outside the pause, leaving without Mixup keeps the bar, the opponent's decision is fixed at the pause, stalemate and limit draws, locked loadouts | `tests/battle/director.test.ts` |
| Style against an independent oracle for every outcome sequence up to length 8, plus the named cases | `tests/battle/style.test.ts` |
| Shapes, rotation, legal placement, rotate-in-place for every mod, rotation, position and neighbour; the bank | `tests/mods/grid.test.ts` |
| Catalogue integrity; compile: lanes, attunement, levels, Overclock, perks | `tests/mods/compile.test.ts` |
| Random streams are pure and independent; shop odds, rerolls, lock; economy; opponents from the seed | `tests/run/*.test.ts` |
| The run state machine and its refusals; a recorded run replays to the same paydays; saves round-trip and malformed or foreign-version saves are refused | `tests/run/run.test.ts`, `tests/run/save.test.ts`, `tests/game/replay.test.ts` |
| Kernel frame boundaries, trades, parry → riposte, guard break, single-hit gate, bonus damage and its inheritance, parry heal and its cap, content validation | `tests/combat/kernel.test.ts` |
| Every pair resolves physically as the matrix says, damage only through contact, healing only through a parry | `tests/combat/exchange.test.ts` |
| C9: random builds never change a winner or a timing field | `tests/combat/mods-never-decide.test.ts` |
| Clip contact poses inside move windows; every named clip exists | `tests/combat/frame-data.test.ts` |
| Health persists between rounds; same inputs → same fight; 1×/2×/4× identical; every loadout terminates against the reference opponent and agrees with the matrix | `tests/game/determinism.test.ts`, `tests/game/match.test.ts` |
| Resuming a fight from recorded decisions reaches the same pause | `tests/game/fight.test.ts` |
| Figures assemble from Boneyard's loader; the renderer's clip choice is total | `tests/render/figures.test.ts` |
| Heart fill; the 16:9 scale, no resolution cap, and one unsupported-display query shared by the stylesheet and the fight clock | `tests/ui/hearts.test.ts`, `tests/ui/display.test.ts` |
| Layer import rules, kernel seal, no randomness in rules, vocabulary boundary, Boneyard never imports FightLab | `tests/architecture.test.ts` |
| Installed Boneyard matches the pin | `tests/boneyard-pin.test.ts` |

## Measured

From the simulation, not estimated. The first two are asserted by `tests/game/determinism.test.ts`,
so a change to frame data, the rules or the reference opponent shows up in a diff.

- Every one of the 729 loadouts against the reference opponent, bare builds, the player mixing up
  after any round it lost on exchanges: **428 victories, 244 defeats, 57 draws** — every draw a double
  knockout from a trade. No exchange in any of them disagreed with the matrix.
- The default loadout wins in 3 rounds (exchanges 3–0, 2–1, 3–0), 793 ticks, with 88 health left.
- Across those 729 fights: 3 to 6 rounds (median 4), 8 to 17 exchanges (median 10), 694 to 1604
  ticks (median 877, about 15 s at 1× without the pauses). A clash lasts 24 to 52 ticks.
- C9: a thousand random builds, nine pairs each, with and without a surge — 9,000 exchanges, none
  disagreeing with the matrix, none healing without a parry.
- Opponent generation takes about 0.25 ms; the 729 fights simulate in about 0.4 s.
- The tuning bot (`npm run tune 1000`: fresh random bars every day, buys the dearest affordable mod
  that fits, Mixups after a lost round, never sells) wins **9%** of runs; runs last a median 10 days
  (5–19); it wins about half its fights on days 1–5 and about a third after day 8, when a grid it
  never upgrades meets opponents still buying. Peak style: **C 58%, B 26%, A 8%, S 8%** — the same
  shape the first design pass calibrated. Fights last 3.1–3.7 rounds on average.

## Out of scope

Merging duplicates, fighter selection, scouting and items, hitstun mods, round-start or round-end
healing, matchmaking, networking, accounts, cloud persistence, monetisation, a large AI system,
procedural moves, a character creator, audio, a frontend framework, a Worker or any deployment. There
are no directories for any of them.

## Future work

- Authored motion to replace the placeholders above, made in Boneyard and accepted through the pin.
- Different fighters with different action tables and frame data (`ActionTable` and
  `FighterDefinition` are per side already), then a picker.
- Lv. 1 → 3 merging if the shop needs another progression axis.
- Other S-rank rewards if style feels underpowered — never damage.
- In-fight information mods, earned and costly.
- A bundled, licensed pixel typeface.

## Slice checklist

1. The design, the contract and this plan describe the run before any of it is built.
2. A new run starts from a seed; Continue resumes a saved one, even mid-fight.
3. Prep matches Batomon's proportions with the bars on the right and no opponent information.
4. Mods can be bought, dragged, rotated, banked and sold; illegal moves are refused.
5. Both bars are programmed in prep and locked in the fight.
6. Rounds play the active bar once; the pause offers Mixup and Fight.
7. Opponents are generated from the seed and switch bars by seeded plans.
8. Exchanges resolve through the deterministic combat and hitbox system; mods never change a winner.
9. Health is five hearts with partial fill over the granular value.
10. Style pays at payday and nowhere else.
11. Payday tallies; hearts and trophies end the run.
12. Every screen is one scaled 16:9 composition; portrait is refused.
13. Battle speed does not alter the deterministic outcome.
14. Debug hitbox and skeleton information remains available outside the normal game UI.
15. Automated tests cover every rule above.
