# Working in FightLab

FightLab is the game. A run is a string of days: each day the player buys mods in a shop, packs them
into a 4 × 4 board and programs two action bars of three actions — Strike, Tech or Block — then fights.
A fight is a series of rounds, each playing the active bar once, slot against slot, and every exchange
is resolved by a deterministic hitbox simulation, not by a dice roll or a health subtraction. Between
rounds the player may Mixup to the other bar. After the knockout comes payday, then the next day. The
repository exists to answer one question: is building two plans, packing a grid and choosing when to
mix up — then watching two properly animated fighters resolve it — actually fun?

This file is the contract. When code and this file disagree, one of them is a bug — say which.
[`docs/RUN_PLAN.md`](docs/RUN_PLAN.md) is the source of truth for what the slice is, what exists
and what has been measured; [`docs/RUN_DESIGN.md`](docs/RUN_DESIGN.md) is the design and the record
of every decision behind it. [`implementation_plan.md`](implementation_plan.md) is now the active
current/future process-parity queue; the completed mod-catalogue task history is in Git.

## Ownership

**FightLab owns gameplay. Boneyard owns reusable fighter rigs, art, clips, and animation
contracts.**

**FightLab may consume Boneyard. Boneyard must never import FightLab.** Boneyard knows nothing about
action bars, rounds, the matchup, mods, runs, opponents, screens or this UI, and no change here may
require it to. If gameplay seems to need a bone, a part or a clip to be different, that change is made
in [Boneyard](../Boneyard/AGENTS.md), on Boneyard's terms, and reaches this repository through the pin
(C1).

[SVGLab](../SVGLab/AGENTS.md) is not a dependency. It is where the combat model comes from:
FightLab's kernel is derived from SVGLab's sealed kernel (see *Lineage*), not imported from it,
because Boneyard's contract keeps combat and move timing out of Boneyard and a laboratory
application is not a library.

## Layers

```
run and build          battle rules    →   combat simulation   →   animation / rig rendering
src/run/  src/mods/    src/battle/         src/combat/             src/render/
```

1. **Run** decides the day. The seeded run — days, hearts, trophies, money, the shop, opponents,
   payday, the autosave — as pure TypeScript over `src/mods/` and `src/battle/`. It never runs a
   fight; it is told how one ended.
2. **Mods** decide the build. Type, affinity, rarity, stars, the 11 shapes, the 4 × 4 grid and bank,
   orthogonal adjacency, the 64-definition registry, `compileBuild`, the effect vocabulary and the
   Burn / Shock / Poison status engine. Pure TypeScript over `src/battle/`'s vocabulary.
3. **Battle** decides the fight. The two bars, the rounds, the cursor through them, the pause and
   Mixup, opponents' mixup plans, the matchup, the exchange cycle and style. Pure TypeScript that
   imports nothing outside `src/battle/`. It works against the `Arena` interface it declares, never
   against the kernel.
4. **Combat** resolves. `kernel/` is the sealed simulation; `moves.ts` is the frame data;
   `adapter.ts` implements the battle layer's `Arena` over the kernel and is the only file that turns
   an action into a move.
5. **Rendering** presents. It reads combat state and draws Boneyard figures posed by Boneyard's
   sampler, forward kinematics and depth order on an original arena. It never writes simulation
   state.

`src/game/` composes: a compiled build becomes a combat side, the engine runs around the combat arena
(`ModdedArena`), a run's day becomes a fight, and it owns the fixed-step clock, the roster and the
settings. `src/ui/` is the screens and nothing else.

## Contracts

Each one is testable, and something in the canonical `check` gate tests it.

**C1 — Boneyard is upstream, pinned, and there is one of it.** The rig, the fighter art, the
clips and the functions that interpret them arrive through the `boneyard` package, a `file:` link
to the sibling checkout. Nothing here copies a part, a cosmetic, a rig or a clip into this tree,
and nothing here writes a second sampler, a second forward-kinematics pass or a second depth
order. `boneyard.pin.json` records the Boneyard commit FightLab was last verified against and a
digest of every Boneyard file FightLab reads. `check:boneyard` fails when the installed Boneyard
differs from that digest, and `dev`, `build`, canonical `check` and compatibility `verify` all see it,
so an upstream change cannot silently alter the game. Accepting one is `npm run pin:boneyard`, which puts the new
digest in a diff where someone has to look at it. Boneyard's remote source is
`SouthernGentlemen/Boneyard`, but FightLab still consumes it as the sibling checkout; the commit
plus digest pin makes both remote CI and local development verify the exact consumed files instead
of trusting a mutable branch. The consumed surface is listed in
[`docs/RUN_PLAN.md`](docs/RUN_PLAN.md#boneyard-dependency-contract); a new import
from Boneyard belongs in that list and in the digest.

**C2 — The battle layer decides; the combat layer resolves.** `resolveMatchup` is the only
statement of the cycle Strike › Tech › Block › Strike. A round plays the active bar exactly once,
slot 1 against slot 1, 2 against 2, 3 against 3, and never wraps inside a round; the pause begins only
after slot 3 has settled, and a knockout ends the fight wherever it lands. The director never touches
health, position or timing: it commits one action per fighter to the arena and advances only when
combat state says the exchange has settled — never on a browser timer. Damage exists only inside the
kernel: as hitbox contact, or as an affliction (Burn, Poison) the arena applies once, after a
round's slot 3 has settled, reported as a kernel event and able to knock a fighter out. Healing
exists only as a kernel event. The frame data is authored so the
physics reproduces the matrix — a jab lands while an overhead is still in startup, a parry absorbs a
jab and answers it, an overhead goes through a parry — and `tests/combat/exchange.test.ts` proves all
nine pairs. When physics and the matrix disagree the director records `agrees: false` rather than
correcting the result.

**C3 — The kernel is sealed.** `src/combat/kernel/**` imports only itself, never touches the
DOM, a wall clock or `Math.random`, and keeps every position, velocity, timer, health value and
damage bonus an integer (fixed point, `SCALE = 100`). `kernel/index.ts` is its public surface.
Contacts are detected against the state before any is applied, so the order fighters are listed in
never decides a trade. Its generic extensions — a damage bonus a committed move carries into its
hits and its parry's counter, a parry that heals by its own amount plus a committed one, exposure
that the next landed hit adds and clears, and an affliction between ticks — know nothing of mods.

**C4 — Strategy stays strategic.** `strike`, `tech` and `block` exist in `src/battle/`,
`src/mods/`, `src/run/`, `src/combat/adapter.ts`, `src/game/` and `src/ui/`, and nowhere else. The
kernel and the frame data speak moves (`jab`, `overhead`, `parry`, `riposte`); rendering speaks clips.
A move names the clip that presents it, and every placeholder is listed beside the motion it stands in
for (`docs/RUN_PLAN.md`, *Animation mapping*), so replacing one is a content change no battle rule
can notice. A mod has exactly one type — `solar`, `arc`, `void` or `neutral` — and an optional
affinity — `strike`, `tech` or `block`. Type determines the status family (Solar → Burn, Arc →
Shock, Void → Poison, Neutral → none); affinity only says which action makes the mod fire. A mod with
no affinity fires every exchange.

**C5 — Determinism, at every level and every speed.** A run is its seed plus the player's inputs.
Every generated thing — shop offers and rerolls, opponents, their bars, builds and mixup plans — is
a pure function of the run seed and the indices of the draw (`shop / day / reroll`,
`opponent / day`), so drawing one never shifts another. There is no other randomness: the fight has
none, and the one call that picks a fresh seed for a new run is the only unseeded value in the game.
The same seed, loadouts, mods and player Mixup decisions produce the same exchange history, event log
and final state. Battle speed changes how many 60 Hz ticks are stepped per animation frame and nothing
else; a fight is run through the real clock at 1×, 2× and 4× and must end identically.

**C6 — Rendering consumes state.** A pose is Boneyard's `sampleClip`, then Boneyard's
`forwardKinematics`, painted in Boneyard's `visualPaintOrder`, applied to a figure that
Boneyard's own loader assembled (`loadFigure` and `assembleFigureBones`, serialised by
`pipelines/figures.ts` and served as `/fighters/<id>.json`). Art is fetched at runtime, never
bundled. Gameplay state never holds a bone transform, and the renderer never writes gameplay
state.

**C7 — The game screens are the game.** Title (Play, Armory, Settings), Settings, Armory, Prep,
Fight (with its round pause), Payday and Run end. The Armory reads the same registry the fight runs
on. Settings lists only settings that work. The prep screen never describes the next
opponent. Hitboxes, skeletons and timing readouts exist only behind `?debug`, or the backtick key on a
development server, and never in the normal game.

**C8 — Provenance follows what is distributed.** A build bundles Boneyard's clip catalog and
serves figure art from `dist/fighters/`. [`LICENSE.md`](LICENSE.md) says what that carries and
points at Boneyard's index for everything upstream of it. Nothing built here is published.

**C9 — Mods never decide an exchange.** A mod may add damage to a move and its riposte, healing to a
parry, and Burn, Shock and Poison to the opponent. It never changes startup, active or recovery
frames, hitbox or parry windows, which hitboxes break guard, the order of a bar or which bar is
active, and nothing it does reduces a hit that lands; Mixup is only ever the player's decision or an
opponent's seeded plan. `compileBuild` is the only bridge from a grid to combat and `ModdedArena` the
only place its engine meets the arena; the property test builds a thousand random boards from the 64
on the 4 × 4 grid, at random stars and degree rotations with statuses loaded, and runs all nine action
pairs without changing a winner or timing field.

**C10 — One 16:9 composition.** Every screen is authored on a 1600 × 900 design grid inside the
largest 16:9 rectangle the display allows, scaled as a whole and rendered at the device's native
resolution — no per-device layouts, no fixed-resolution bitmaps, no resolution cap. A portrait or
too-small display gets an unsupported-state card, never a rearranged UI.

**C11 — Saves are versioned.** The autosave is `{ version, run, fight }`. A document with a version
the game does not read, or one that fails validation, is discarded whole. Changing the saved shape
means a new version and, if old saves are to survive, a migration with a test. The current format is
**version 4**, introduced with the replacement 64-mod registry; versions 1–3 are discarded because
their mod ids and/or placement model are not the current catalogue.

## Lineage

`src/combat/kernel/` descends from SVGLab's `src/kernel/` at SVGLab `fb233da`, which descends
from Hexframe (SVGLab's `docs/HEXFRAME_COMBAT_AUDIT.md`). It is a reduction around the
autobattler, not a fork kept in sync.

- **Kept as it was:** AABB overlap, intersection and facing mirroring; the fixed 60 Hz tick
  and `SCALE = 100` fixed point; startup/active/recovery phase arithmetic; hitstop that freezes
  a fighter, hitstun that counts down after it, pushback decayed by ground friction; the
  single-hit gate per hitbox and target; pushbox separation with the integer split and stage
  clamp; the step order (timers → commands → movement → facing → pushboxes → contacts →
  events).
- **Changed, because two fighters now fight each other:** fighters are `player` and `opponent`;
  moves are a per-fighter table keyed by id rather than a closed union; the step takes a command
  per fighter rather than input bits; contact detection is simultaneous (in SVGLab the second
  fighter could never trade, which did not matter against a dummy); a move may carry a parry
  window that turns a contact into a counter; a hitbox may break guard.
- **Added for the run:** a move command may carry an integer damage bonus, inherited by the counter
  its parry starts; a parry may heal its owner, never past maximum health.
- **Dropped:** jump, crouch and air boxes, the input edge detector and the invulnerable dummy.

## Layout

```
AGENTS.md, CONTRIBUTING.md, SECURITY.md, implementation_plan.md, README.md, LICENSE.md
docs/RUN_PLAN.md    the run slice as built: rules, state machines, tests, what has been measured
docs/RUN_DESIGN.md  the design and the record of its decisions
docs/MODS.md        the mod system: type, affinity, shapes, adjacency, effects, statuses, stars, rarity, colour, Armory
boneyard.pin.json   the Boneyard commit and digest FightLab is verified against
index.html          the one page
pipelines/          Node only: Boneyard pin, dev teardown, release identity, figures, tuning, controlled-change validation
src/run/            seeded run: random streams, shop, economy, opponents, run state, save, collection
src/mods/           type and affinity, rarity, stars, shapes, 4 × 4 grid and bank, adjacency,
                    64-mod registry, effects, status engine, compile and Armory filters — pure rules
src/battle/         actions, matchup, bars, mixup plans, director, style — pure rules
src/combat/kernel/  the sealed simulation
src/combat/         frame data and the adapter implementing the battle Arena
src/game/           combat sides from builds, one fight, fixed-step clock, roster, settings
src/render/         Boneyard figures, the arena and its debug overlay
src/ui/             the screens, the 16:9 stage and the stylesheet
src/main.ts         screen switching and the autosave
tests/              arranged by the same layers
```

## Commands

The repository toolchain is Node **26.9.0** from `.node-version` and npm **11.19.1** from
`package.json#packageManager`. `package.json#engines` carries the supported Node 26/npm 11 policy,
and `.npmrc` enables strict engine enforcement. GitHub workflows consume `.node-version` directly
and verify both exact runtime versions before `npm ci`.

```
npm run dev              check the pin, stop any FightLab server left on the port, then serve the game
                         at http://127.0.0.1:5190 (`npm run dev -- --port <n>` serves elsewhere)
npm run build            check the pin, then a production build in dist/
npm run preview          the same teardown, then serve dist/ at http://127.0.0.1:5191
npm run check:boneyard   fail if the installed Boneyard differs from boneyard.pin.json
npm run pin:boneyard     accept the installed Boneyard: rewrite the pin
npm run typecheck        the strip-only TypeScript dialect
npm run test             every test
npm run tune             bot runs across many seeds: win rates and money by day
npm run test:github-settings    pure, deterministic, credential-free settings normalization/comparison/apply-plan cases
npm run check            canonical credential-free acceptance: pin, pure settings cases, typecheck, all tests, one production build
npm run verify           compatibility alias for npm run check
FIGHTLAB_RELEASE=vX.Y.Z npm run check:release-identity
                         read-only source identity: semantic annotated tag at exact HEAD, matching
                         private package version and unchanged tracked repository content
npm run verify:github-settings  read live GitHub settings and compare them with committed desired policy;
                                networked/read-only and intentionally outside canonical check
npm run apply:github-settings   the only explicit GitHub settings mutation path; apply committed policy, then independently
                                re-read and verify provider state; never part of canonical check
```

`FIGHTLAB_RELEASE=vX.Y.Z npm run check:release-identity` never creates or mutates a tag, GitHub
Release or provider setting. It validates only an already-created source identity and must never be
used to justify publishing `dist/` or Boneyard-derived build artifacts.

`?seed=<n>` starts a new run on a chosen seed; `?debug` shows the lab tooling.

Anything about the rig, the art or the clips themselves is a command in Boneyard —
`render:clip`, `render:figure`, `build:motions`, `verify`.

Human contribution and command guidance lives in [`CONTRIBUTING.md`](CONTRIBUTING.md); this file remains the authoritative repository and controlled-change contract.

## Language

TypeScript everywhere, in the dialect the sibling repositories use: Node runs the pipelines with
native strip-only TypeScript, every relative import has an explicit `.ts`, and `enum`,
`namespace` and constructor parameter properties are outside it. No framework: the UI is DOM and
SVG built by hand.

## Controlled development loop

`implementation_plan.md` is the active current/future queue. A **controlled change** delivers exactly one
open `FL-NNN` task from that queue.

**`do needful` means one complete controlled turn:** re-fetch authoritative `main`, open PRs and the
CI attached to their current heads; read this file and the active plan; finish an already-open,
authoritative PR for the first task when it is current, green and in scope, otherwise branch from
current `main` and deliver only the first open task. Do not infer provider state from a handoff.

- **Selection is first-open and blocked-first.** Dependencies and explicit gates on the first open task
  must be satisfied before work starts. If that task is blocked, stop on the blocker and ask for the
  owner/provider action; never skip ahead to a later task without owner direction.
- **Same-delivery purge is mandatory.** The PR that delivers an `FL-NNN` task removes that task from
  `implementation_plan.md` and updates future blocks when the delivery changes their assumptions.
  A task accepted on `main` must not remain in the active queue.
- **Queue exhaustion is a mode change.** The PR delivering the last queued task deletes
  `implementation_plan.md`. The next turn re-audits current state and writes a fresh small-task plan;
  it does not invent or start implementation merely because the old queue is empty.
- **One task, one branch, one controlled identity.** Use
  `fl-NNN-<kebab-summary>`. The commit subject and PR title are
  `[FL-NNN] [TYPE] Summary`, where `TYPE` is the task's declared primary type. Controlled primary
  types are `BUILD`, `DOCS`, `FIX`, `OPS`, `REFACTOR`, `SEC` and `TEST`. Prospective identity
  validation starts after immutable legacy tip `9904541df5f99d239cf02bd6a568e02a05c749f8`; its first
  accepted controlled commit is FL-001 at `7516db0a366128fbace6da2370920ab6f5a8bcf1`. Earlier
  history stays outside this contract. Keep the delivering branch to one controlled commit unless
  provider mechanics require otherwise. Its body records:
  `Change:`, `Reason:`, `Impact:`, `Risk:`, `Controls:`, `Validation:`, `Evidence:`, and
  `Source:`.
  The delivery sequence is branch → implementation → validation → one controlled branch commit →
  PR → exact-head CI → squash of that exact head → one controlled commit retained on `main` →
  verify `main` → branch cleanup. Do not use a merge commit or rebase merge for controlled work.
- **Validate before merge.** Run the task's focused checks, canonical `npm run check`, and
  `git diff --check`. `npm run verify` is a compatibility alias to that same gate. After push,
  require the existing provider `verify` check for the PR's exact current head to pass. Re-fetch `main` and PR mergeability immediately before merge;
  if the head or base moved, re-establish currency and re-validate rather than merging stale evidence.
- **Provider actions are literal facts.** Only say a branch was pushed, a PR opened, CI passed, a
  setting matched, a merge completed or a branch was deleted after the provider confirms that action.
  Local tests and committed expectations are not provider state. `npm run test:github-settings` is the pure, credential-free settings contract and may run inside
  canonical `npm run check`. `npm run verify:github-settings` is a separate networked, read-only
  provider check; it may use an already-present runtime `GH_ADMIN_TOKEN` or
  `GH_TOKEN`, otherwise public provider reads run anonymously. `npm run apply:github-settings`
  is the only explicit settings mutation path: it reads the same committed desired-state authority,
  fails closed when required provider access is unavailable, mutates only that bounded policy and
  independently re-reads provider state after writes. Neither live command belongs to canonical
  `check`. Never print or persist a credential, and never classify `Resource not accessible by
  integration` as a plan/tier failure. An unauthorized or unavailable provider action is a blocker to
  report, not an action to imply. PR exact-head CI and merged-`main`
  CI are separate evidence; when a delivery changes CI, confirm the workflow run attached to the
  actual merged `main` SHA rather than substituting the PR run.
- **Merge and hand off, then stop.** Merge when the exact current head is green, current and mergeable
  under the repository's existing provider rules; confirm the resulting `main` SHA and branch state.
  Return a complete kickoff prompt for the new first task, including authoritative merged `main`,
  task/branch/title, scope, non-goals, validation and provider gates. Do not start that next task in
  the same turn.

## Working rules

- Small branches off `main`; keep each controlled branch scoped to its one task.
- Never edit a file that has uncommitted changes in it. Use a separate worktree.
- Comments explain *why*. No narration of what the code plainly does.
- When a number is tuned — a frame count, a reach, a damage value, a price — measure it in the
  simulation and write the measurement into a test. Never encode a guess.
- Verify visually where the output is visual: run the game and look at it before calling
  anything done.
- Prefer deleting code to adding an abstraction. There are no directories for systems that do
  not exist yet.
