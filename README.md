# FightLab

Build two plans. Read your opponent. Mix up.

A run is a string of days. Each day you buy **mods** — polyomino pieces typed Solar, Arc, Void or
Neutral, with an optional Strike, Tech or Block affinity — pack them into a **4 × 4 board**, and
program two **action bars** of three actions each: **Strike**, **Tech** or **Block**. They form a
strict cycle: Strike beats Tech, Tech beats Block, Block beats Strike.

A fight is a series of rounds. Each round plays the active bar once against the opponent's, slot for
slot, and between rounds you choose whether to **Mixup** to the other bar. The matchup decides who
*should* win an exchange; hitboxes, frame data and the parry decide how it actually lands. Win ten
fights before you lose five hearts.

The **64 mods** are a spatial build system. Shape and rotation decide what fits; orthogonal adjacency
decides which neighbours can amplify or scale one another. Solar applies **Burn**, Arc applies
**Shock**, Void applies **Poison**, and Neutral carries direct combat or run utility. An affinity says
which action fires a mod; a mod without one fires every exchange. Mods may change damage, parry
healing and statuses, but never the Strike › Tech › Block result or combat timing.

Three copies of a mod combine into ★★ and two ★★ into ★★★. Rarity is separate from stars: Common,
Uncommon, Rare, Super Rare and Legendary set price, shop odds and vocabulary complexity. The
**Armory** shows the same 64 definitions the fight uses, in a four-column catalogue with Type,
Action, Size and Rarity filters. [`docs/MODS.md`](docs/MODS.md) is the full mod contract.

**[`AGENTS.md`](AGENTS.md) is the contract.** [`docs/RUN_PLAN.md`](docs/RUN_PLAN.md) is the
source of truth for the slice: the rules, state machines, Boneyard dependency, measurements and
tests. [`docs/RUN_DESIGN.md`](docs/RUN_DESIGN.md) is the design and decision record.
[`implementation_plan.md`](implementation_plan.md) is the current/future process-parity queue.
[`CONTRIBUTING.md`](CONTRIBUTING.md) is the concise human workflow and command guide.

## Run it

FightLab draws its fighters from [Boneyard](../Boneyard/README.md), linked from a sibling checkout
and pinned by [`boneyard.pin.json`](boneyard.pin.json):

```
~/Documents/GitHub/Boneyard     at the pinned commit, with `npm run build` run once
~/Documents/GitHub/FightLab
```

```bash
npm install
npm run dev      # checks the pin, stops any FightLab server left on the port, then http://127.0.0.1:5190
npm run test:release-identity  # offline disposable-Git release identity/source-tree cases
npm run check    # canonical acceptance: pin, pure release/settings cases, typecheck, complete tests, one production build
npm run verify   # compatibility alias for npm run check
FIGHTLAB_RELEASE=v0.1.0 npm run check:release-identity  # validate an existing source tag only
```

`npm run check` is the canonical credential-free acceptance command; `npm run verify` delegates to it
for compatibility. Its offline release cases exercise disposable repositories and prove generated
`dist/` / copied Boneyard build assets are outside the source-release tree. Focused commands remain
useful during development, while pushing a branch, opening a PR, exact-head CI and merging are
separate GitHub actions. `check:release-identity` is read-only:
it requires an existing annotated semantic tag at exact `HEAD`, a matching private package version
and unchanged tracked repository content. It creates no tag or release and publishes nothing.
A pushed semantic annotated `vX.Y.Z` tag is the only provider release trigger. The source-only
release workflow reproduces the pinned toolchain and Boneyard input, runs canonical acceptance plus
the exact release-identity check, then creates the GitHub Release with `--verify-tag` and no
attachments. It never publishes `dist/`, generated Boneyard-derived assets, or deploys the game.
See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the change flow.

A FightLab server still running from another terminal, a preview pane or an ended session is stopped
first, so `npm run dev` always starts; anything else holding the port is named and left alone.

The game is one 16:9 composition that scales to fill the window; play it landscape. If the pin check
fails, Boneyard has changed underneath the game. It says which commit it expects and how to accept the
new one (`npm run pin:boneyard`) once `check` passes against it.

## Debug

Add `?seed=<n>` to start a new run on a chosen seed. Add `?debug`, or press the backtick key on a
development server, to see pushboxes, hurtboxes, hitboxes, contacts, the forward-kinematics skeleton
and a readout of the tick, round, slot, bars, clips, move phases, statuses and the matchup. The normal
game never shows any of it.

## What is here

| Path | What it is |
| --- | --- |
| `src/run/` | Seeded run: random streams, shop, economy, opponents, run state, autosave |
| `src/mods/` | Types and affinity, 11 shapes, 4 × 4 grid and bank, adjacency, 64-mod catalogue, effects, compile and Armory filters |
| `src/battle/` | Actions, matchup, action bars, mixup plans, round director and style |
| `src/combat/` | Sealed deterministic kernel, frame data, and the adapter between combat and battle rules |
| `src/render/` | Boneyard figures posed by Boneyard's sampler, FK and depth order, on the arena |
| `src/game/` | Combat sides from builds, the modded arena, one fight, fixed-step clock, roster and settings |
| `src/ui/` | Title, Settings, Armory, Prep, Fight, Payday and Run end — one 16:9 stage |
| `pipelines/` | Boneyard pinning, release identity, figure serving/emission and the tuning bot |

Licensing of the material a build carries is in [`LICENSE.md`](LICENSE.md).
