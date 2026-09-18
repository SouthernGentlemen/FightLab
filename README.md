# FightLab

Program a loop of five actions. Watch two fighters resolve it.

Each slot is **Strike**, **Tech** or **Block**, and they form a strict cycle: Strike beats Tech,
Tech beats Block, Block beats Strike. Your five slots meet the opponent's hidden five, slot for
slot, then both loops wrap and repeat until someone is knocked out. The matchup decides who
*should* win an exchange; hitboxes, frame data and a parry decide how it actually lands.

**[`AGENTS.md`](AGENTS.md) is the contract.** [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) is
the source of truth for the MVP: the rules, the state machine, what is consumed from Boneyard,
what is a placeholder and what is out of scope.

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

If the pin check fails, Boneyard has changed underneath the game. It says which commit it expects
and how to accept the new one (`npm run pin:boneyard`) once `verify` passes against it.

## Debug

Add `?debug` to the URL, or press the backtick key on a development server, to see pushboxes,
hurtboxes, hitboxes, contacts, the forward-kinematics skeleton and a readout of the tick, clips,
move phases, both actions and the matchup. The normal game never shows any of it.

## What is here

| Path | What it is |
| --- | --- |
| `src/battle/` | The rules: actions, the matchup, programs, the opponent, the director |
| `src/combat/` | The sealed deterministic kernel, the frame data, and the adapter between them and the rules |
| `src/render/` | Boneyard figures posed by Boneyard's sampler, forward kinematics and depth order |
| `src/game/` | One match, the fixed-step clock, settings |
| `src/ui/` | Title, Settings, Play |
| `pipelines/` | The Boneyard pin, and the figure server that runs Boneyard's own loader |

Licensing of the material a build carries is in [`LICENSE.md`](LICENSE.md).
