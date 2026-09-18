# FightLab

Build two plans. Read your opponent. Mix up.

A run is a string of days. Each day you buy **mods** — Tetris-shaped pieces typed Solar, Arc, Void or
Neutral, some also Strike, Tech or Block — pack them into a 3×3 grid, turning them so their ports feed
each other, and program two **action bars** of three actions each:
**Strike**, **Tech** or **Block**. They form a strict cycle: Strike beats Tech, Tech beats Block, Block
beats Strike. A fight is a series of rounds; each plays your active bar once against the opponent's,
slot for slot, and between rounds you choose whether to **Mixup** to your other bar. The matchup decides
who *should* win an exchange; hitboxes, frame data and a parry decide how it actually lands. Win ten
fights before you lose five hearts.

Mods are a build system. Solar makes Heat fast and burns it into **Burn**, which halves every round;
Arc stores Charge for a burst and sets up **Shock**, which one landed hit takes whole; Void leeches
what the opponent builds and turns it into **Poison**, which never fades. Three copies of a mod
combine into ★★, two ★★ into ★★★; rarity — Iron to Diamond — is the metal the stars are made of. The
**Armory** on the title screen shows every mod at every star. [`docs/MODS.md`](docs/MODS.md) has it
all.

**[`AGENTS.md`](AGENTS.md) is the contract.** [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) is the
source of truth for the slice: the rules, the state machines, what is consumed from Boneyard, what is a
placeholder, what has been measured and what is out of scope. [`docs/RUN_DESIGN.md`](docs/RUN_DESIGN.md)
is the design and the record of the decisions behind it; [`docs/MODS.md`](docs/MODS.md) is the mod
system.

## Run it

FightLab draws its fighters from [Boneyard](../Boneyard/README.md), linked from a sibling checkout
and pinned by [`boneyard.pin.json`](boneyard.pin.json):

```
~/Documents/GitHub/Boneyard     at the pinned commit, with `npm run build` run once
~/Documents/GitHub/FightLab
```

```bash
npm install
npm run dev      # checks the pin, then http://127.0.0.1:5190
npm run verify   # pin, typecheck, tests, production build
```

The game is one 16:9 composition that scales to fill the window; play it landscape. If the pin check
fails, Boneyard has changed underneath the game. It says which commit it expects and how to accept the
new one (`npm run pin:boneyard`) once `verify` passes against it.

## Debug

Add `?seed=<n>` to start a new run on a chosen seed. Add `?debug`, or press the backtick key on a
development server, to see pushboxes, hurtboxes, hitboxes, contacts, the forward-kinematics skeleton
and a readout of the tick, round, slot, bars, clips, move phases and the matchup. The normal game never
shows any of it.

## What is here

| Path | What it is |
| --- | --- |
| `src/run/` | The seeded run: random streams, shop, economy, opponents, the run state machine, the autosave |
| `src/mods/` | Tags, rarity, stars, ports, the one mod registry, the grid and bank, compile, the resource and debuff engine, the Armory's catalogue |
| `src/battle/` | The rules: actions, the matchup, action bars, mixup plans, the round director, style |
| `src/combat/` | The sealed deterministic kernel, the frame data, and the adapter between them and the rules |
| `src/render/` | Boneyard figures posed by Boneyard's sampler, forward kinematics and depth order, on an original arena |
| `src/game/` | Combat sides from builds, the modded arena, one fight, the fixed-step clock, the roster, settings |
| `src/ui/` | Title, Settings, Armory, Prep, Fight, Payday, Run end — one 16:9 stage |
| `pipelines/` | The Boneyard pin, the figure server that runs Boneyard's own loader, the tuning bot |

Licensing of the material a build carries is in [`LICENSE.md`](LICENSE.md).
