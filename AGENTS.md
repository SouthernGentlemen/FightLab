# Working in FightLab

FightLab is the game. Two fighters each run a repeating program of five actions — Strike, Tech
or Block — and every exchange is resolved by a deterministic hitbox simulation, not by a dice
roll or a health subtraction. The player's whole strategy is choosing the loop. The repository
exists to answer one question first: is programming a five-action loop and watching two properly
animated fighters resolve it actually fun?

This file is the contract. It describes the repository as it exists. When code and this file
disagree, one of them is a bug — say which. [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) is
the source of truth for what the MVP is and is not.

## Ownership

**FightLab owns gameplay. Boneyard owns reusable fighter rigs, art, clips, and animation
contracts.**

**FightLab may consume Boneyard. Boneyard must never import FightLab.** Boneyard knows nothing
about five-action programs, the matchup, opponents, matches, screens or this UI, and no change
here may require it to. If gameplay seems to need a bone, a part or a clip to be different, that
change is made in [Boneyard](../Boneyard/AGENTS.md), on Boneyard's terms, and reaches this
repository through the pin (C1).

[SVGLab](../SVGLab/AGENTS.md) is not a dependency. It is where the combat model comes from:
FightLab's kernel is derived from SVGLab's sealed kernel (see *Lineage*), not imported from it,
because Boneyard's contract keeps combat and move timing out of Boneyard and a laboratory
application is not a library.

## Three layers

```
battle rules   →   combat simulation   →   animation / rig rendering
src/battle/        src/combat/             src/render/
```

1. **Battle** decides. The two programs, the cursor through them, the matchup, the exchange
   cycle, the match lifecycle. Pure TypeScript that imports nothing outside `src/battle/`. It
   works against the `Arena` interface it declares, never against the kernel.
2. **Combat** resolves. `kernel/` is the sealed simulation; `moves.ts` is the frame data;
   `adapter.ts` implements the battle layer's `Arena` over the kernel and is the only file that
   turns an action into a move.
3. **Rendering** presents. It reads combat and battle state and draws Boneyard figures posed by
   Boneyard's sampler, forward kinematics and depth order. It never writes simulation state.

`src/game/` composes one match, owns the fixed-step clock and the settings. `src/ui/` is three
screens and nothing else.

## Contracts

Each one is testable, and something in `verify` tests it.

**C1 — Boneyard is upstream, pinned, and there is one of it.** The rig, the fighter art, the
clips and the functions that interpret them arrive through the `boneyard` package, a `file:` link
to the sibling checkout. Nothing here copies a part, a cosmetic, a rig or a clip into this tree,
and nothing here writes a second sampler, a second forward-kinematics pass or a second depth
order. `boneyard.pin.json` records the Boneyard commit FightLab was last verified against and a
digest of every Boneyard file FightLab reads. `check:boneyard` fails when the installed Boneyard
differs from that digest, and `dev`, `build`, `test` and `verify` all see it, so an upstream
change cannot silently alter the game. Accepting one is `npm run pin:boneyard`, which puts the new
digest in a diff where someone has to look at it. Boneyard has no remote, which is why the pin is
a digest rather than a git URL. The consumed surface is listed in
[`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md#boneyard-dependency-contract); a new import
from Boneyard belongs in that list and in the digest.

**C2 — The battle layer decides; the combat layer resolves.** `resolveMatchup` is the only
statement of the cycle Strike › Tech › Block › Strike. The director never touches health,
position or timing: it commits one action per fighter to the arena and advances only when combat
state says the exchange has settled — never on a browser timer. Damage exists only as hitbox
contact inside the kernel. The frame data is authored so the physics reproduces the matrix — a
jab lands while an overhead is still in startup, a parry absorbs a jab and answers it, an overhead
goes through a parry — and `tests/combat/exchange.test.ts` proves all nine pairs. When physics
and the matrix disagree the director records `agrees: false` rather than correcting the result.

**C3 — The kernel is sealed.** `src/combat/kernel/**` imports only itself, never touches the
DOM, a wall clock or `Math.random`, and keeps every position, velocity and timer an integer
(fixed point, `SCALE = 100`). `kernel/index.ts` is its public surface. Contacts are detected
against the state before any is applied, so the order fighters are listed in never decides a
trade.

**C4 — Strategy stays strategic.** `strike`, `tech` and `block` exist in `src/battle/`,
`src/combat/adapter.ts`, `src/game/` and `src/ui/`, and nowhere else. The kernel and the frame
data speak moves (`jab`, `overhead`, `parry`, `riposte`); rendering speaks clips. A move names
the clip that presents it, and every placeholder is listed beside the motion it stands in for
(`IMPLEMENTATION_PLAN.md`, *Animation mapping*), so replacing one is a content change no battle
rule can notice.

**C5 — Determinism, at every speed.** The same two programs from the same starting state
produce the same exchange history, event log and final state. Battle speed changes how many
60 Hz ticks are stepped per animation frame and nothing else; a match is run through the real
clock at 1×, 2× and 4× and must end identically. There is no randomness yet; when it arrives it
is seeded and part of the match configuration.

**C6 — Rendering consumes state.** A pose is Boneyard's `sampleClip`, then Boneyard's
`forwardKinematics`, painted in Boneyard's `visualPaintOrder`, applied to a figure that
Boneyard's own loader assembled (`loadFigure` and `assembleFigureBones`, serialised by
`pipelines/figures.ts` and served as `/fighters/<id>.json`). Art is fetched at runtime, never
bundled. Gameplay state never holds a bone transform, and the renderer never writes gameplay
state.

**C7 — The game screen is the game.** Three screens: Title, Settings, Play. Settings lists only
settings that work. Hitboxes, skeletons and timing readouts exist only behind `?debug`, or the
backtick key on a development server, and never in the normal game.

**C8 — Provenance follows what is distributed.** A build bundles Boneyard's clip catalog and
serves figure art from `dist/fighters/`. [`LICENSE.md`](LICENSE.md) says what that carries and
points at Boneyard's index for everything upstream of it. Nothing built here is published.

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
- **Dropped:** jump, crouch and air boxes, the input edge detector and the invulnerable dummy.

## Layout

```
AGENTS.md, IMPLEMENTATION_PLAN.md, README.md, LICENSE.md
boneyard.pin.json   the Boneyard commit and digest FightLab is verified against
index.html          the one page
pipelines/          Node only: the Boneyard pin and the figure server/emitter
src/battle/         actions, matchup, program, opponent, director — pure rules
src/combat/kernel/  the sealed simulation
src/combat/         frame data and the adapter implementing the battle Arena
src/game/           match composition, fixed-step clock, roster, settings
src/render/         Boneyard figures, poses, the stage and its debug overlay
src/ui/             title, settings, play and the stylesheet
src/main.ts         screen switching
tests/              arranged by the same layers
```

## Commands

```
npm run dev              check the pin, then serve the game at http://127.0.0.1:5190
npm run build            check the pin, then a production build in dist/
npm run preview          serve dist/
npm run check:boneyard   fail if the installed Boneyard differs from boneyard.pin.json
npm run pin:boneyard     accept the installed Boneyard: rewrite the pin
npm run typecheck        the strip-only TypeScript dialect
npm run test             every test
npm run verify           pin, typecheck, tests and the production build
```

Anything about the rig, the art or the clips themselves is a command in Boneyard —
`render:clip`, `render:figure`, `build:motions`, `verify`.

## Language

TypeScript everywhere, in the dialect the sibling repositories use: Node runs the pipelines with
native strip-only TypeScript, every relative import has an explicit `.ts`, and `enum`,
`namespace` and constructor parameter properties are outside it. No framework: the UI is a few
hundred lines of DOM.

## Working rules

- Small branches off `main`. `verify` before merge. Merge promptly, then delete the branch.
- Never edit a file that has uncommitted changes in it. Use a separate worktree.
- Comments explain *why*. No narration of what the code plainly does.
- When a number is tuned — a frame count, a reach, a damage value — measure it in the simulation
  and write the measurement into a test. Never encode a guess.
- Verify visually where the output is visual: run the game and look at it before calling
  anything done.
- Prefer deleting code to adding an abstraction. There are no directories for systems that do
  not exist yet.
