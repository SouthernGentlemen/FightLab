# FightLab — Mods as a build system

**Status: built.** This is the design of the mod system: types, the three elemental resource loops,
the combat debuffs, ports and rotation, ★ upgrades, rarity, the registry and the Armory.
[`RUN_DESIGN.md`](RUN_DESIGN.md) is the run around it and records the decisions (rows 10–15) that
replaced the first catalogue; [`AGENTS.md`](../AGENTS.md) is the contract. Every number here is
**provisional**: a starting value in `src/mods/balance.ts` or the registry, to be tuned with the bot.

## The three elements

| Element | Identity | Resource | Debuff |
| --- | --- | --- | --- |
| **Solar** | **fast build / low sustained payoff** | Heat: made quickly, spent aggressively, half of it vents every round | **Burn** |
| **Arc** | **setup / burst** | Charge: made steadily, stored up to a capacity, spent in one big window | **Shock** |
| **Void** | **slow build / persistent high payoff** | Void: leeched from the opponent's Heat and Charge, never vents | **Poison** |
| Neutral | none | none | none — the run's utility mods |

Solar comes online first and fades: Heat halves at every round's end and Burn halves after dealing
its damage, so nothing Solar does compounds. Arc rewards preparing: Charge persists but is capped by
capacity, and Shock waits for one hit that takes all of it. Void starts weak — it has nothing of its
own and drains what the opponent builds — but Void persists and Poison never fades, so a fight that
goes long belongs to it.

## Types and tags

A mod has one or two **tags** from two families:

- **Elements**: Solar (orange), Arc (green), Void (purple), Neutral (grey).
- **Actions**: Strike (red), Tech (yellow), Block (blue).

Valid: an element alone (`SOLAR`), an element and an action (`SOLAR / STRIKE`, `NEUTRAL / STRIKE`), or
two different elements (`VOID / ARC` — a hybrid). Never an action alone, never two actions, never a
repeat, and Neutral pairs with no other element. An element is never an action: Solar is not Strike.
An **action tag says when a mod fires** — in an exchange where its fighter plays that action. A mod
with no action tag fires in every exchange.

A single-typed mod is drawn in its colour. A dual-typed mod is **split half and half on the
diagonal** — a `SOLAR / STRIKE` block is half orange, half red. Colour is never the only signal: the
type is always written out (`SOLAR / STRIKE`) and every tag has its own glyph.

## Resources

Each fighter has, from the start of every fight:

| State | Starts | Limit |
| --- | --- | --- |
| Heat | 0 | none; half vents (rounded down) at each round's end |
| Charge | 0 | capacity: `BASE_CHARGE_CAPACITY` (3) plus Batteries; Charge beyond it is lost as it is made |
| Void | 0 | none; persists |
| Burn, Shock, Poison | 0 | **none — there is no stack cap anywhere** |

Effects are data (`src/mods/effects.ts`), read by one engine (`src/mods/resolve.ts`):
**generate** (make Heat or Charge), **leech** (drain the opponent's Heat or Charge into Void),
**convert** (move your own resource into another), **spend** (pay an exact cost for payoffs),
**sink** (remove up to an amount, a payoff per unit removed), **refund** (Charge back when a linked
mod spends), **accrue** (Void at round end), **capacity**, **lane-boost**, and the run perks
**income**, **free-reroll** and **style**. Payoffs are **damage** (on this exchange's move — a
parry passes it to its riposte), **heal** (on this exchange's parry), a **debuff** on the opponent,
or a **cleanse** of your own.

## One deterministic resolution order

Per exchange, for both fighters:

1. **Generate.** Every firing mod makes its Heat or Charge.
2. **Leech / convert.** Leeches drain the opponent's pools as they stood after step 1 — both sides
   at once, so the order the fighters are listed in never matters — then conversions run.
3. **Consume.** Spends pay if they can; sinks remove what there is; refunds follow. Resources made
   in steps 1–2 can be spent here.
4. **Resolve the action.** The kernel runs the exchange: the move carries the bought damage and
   heal, and the defender's Shock as *exposure*.
5. **Apply resulting debuffs.** A Strike or Tech mod's debuffs land if its move hurt the opponent; a
   Block mod's payoffs land if its guard held (its fighter took no damage); an untagged mod's land
   regardless. Debuffs go on first, then cleanses.

After slot 3 settles, once per round:

6. **End-of-round debuffs.** Burn deals its damage and halves; Poison deals its damage and stays;
   Heat vents; Void accrues. The damage goes through the kernel as an **affliction** and can knock a
   fighter out — a double knockout is a draw. This takes no simulation ticks.

Nothing is timed by frames, the DOM, `requestAnimationFrame` or timeouts: the engine counts
exchanges and rounds, and the renderer only draws what the combat state already holds.

## Debuffs

| Debuff | Element | Rule | Balance (provisional) |
| --- | --- | --- | --- |
| **Burn** | Solar | At round end, deals `stacks × BURN_DAMAGE_PER_STACK`, then **halves, rounding down**: 8 → 4 → 2 → 1 → **0** | 1 damage per stack |
| **Shock** | Arc | No passive damage. The next **successful damaging hit** adds `stacks × SHOCK_BONUS_PER_STACK` and **consumes all Shock stacks** — Shock becomes 0 | 1 damage per stack |
| **Poison** | Void | At round end, deals `floor(stacks / POISON_DIVISOR)` and **persists**: it never decays | divisor 2: 1 → 0, 2 → 1, 3 → 1, 4 → 2, 6 → 3, 10 → 5 |

Shock is integrated with the kernel's hit resolution, not approximated: before each commit the
defender's Shock becomes the kernel's `exposure`; the first hit that deals damage adds all of it and
clears it, and the contact report says so. A parried, blocked or missed attack consumes nothing.
**Debuffs have no artificial global stack cap.**

## Ports and rotation

A port sits on one cell of a mod, on one side, and feeds a resource **out** or takes it **in**.
Ports are authored at rotation 0 (0°) and turn clockwise with the piece: 90°, 180°, 270°. Rotation
is part of the mod's state on the grid, not decoration. A **link** is an out-port facing a matching
in-port of another mod across a shared edge; a linked producer makes `LINK_BONUS` (1) more of what it
feeds. Chain Circuit makes more for every link it is part of; Feedback Loop refunds Charge each time
a mod linked to it spends Charge. On screen a solid pill is an out-port and a hollow one an in-port,
coloured by resource; only the blocks turn — nothing written on a mod is ever rotated.

## Stars and rarity

**There is no T1 / T2 / T3.** **Star count is the upgrade level, and only that:**

| Level | Made from |
| --- | --- |
| ★ | one copy, bought |
| ★★ | 3 × ★ |
| ★★★ | 2 × ★★ — six ★ copies |

Combining is automatic when a purchase completes a set: the oldest copy becomes the upgraded mod
where it stands, turned as it was. Every scalable number in a mod is a `[★, ★★, ★★★]` triple, and
every mod has at least one that grows at each level. A mod is one registry record at every level.

**Rarity is separate** and never changes when a mod upgrades. It sets the price, the shop odds and
the power budget, and it is the **material the stars are cast in**:

| Rarity | Material | Price |
| --- | --- | --- |
| Common | Iron | $3 |
| Uncommon | Bronze | $4 |
| Rare | Silver | $5 |
| Super Rare | Gold | $7 |
| Legendary | Diamond | $8 |

A Common ★ is one iron star; a Rare ★★ two silver stars; a Legendary ★★★ three diamond stars. Selling
returns half of every copy inside a mod, rounded down, at least $1.

## Architecture

- `src/mods/registry.ts` — **the one registry**: 29 frozen records (id, name, description, rarity,
  tags, shape, ports, effects, glyph). The shop, the grid, compile, the engine and the Armory all
  read these same objects; there is no per-mod code and no second catalogue.
- `tags.ts`, `rarity.ts`, `stars.ts`, `ports.ts`, `effects.ts`, `balance.ts` — the vocabulary, and
  every tuning constant in one place.
- `program.ts` / `compile.ts` — a placed grid becomes lane power, run perks and a **program**: each
  mod at its stars with the links its ports make where it stands.
- `resolve.ts` — the pure engine: `prepareExchange` (steps 1–3), `settleExchange` (step 5),
  `endRound` (step 6).
- `src/game/modded.ts` — `ModdedArena`, the battle layer's `Arena` over the combat arena with the
  engine around each commit, each settled exchange and each round's end.
- The kernel's three generic hooks: a parry committed with extra `heal`, fighter `exposure`, and
  `afflict`. It never learns what a mod is.
- Instance layers stay apart: definition (registry) → `OwnedMod` {uid, mod, stars, rotation} →
  `PlacedMod` (+ x, y) → engine `ModState` in a fight.

## The Armory

Title → **Armory**: one screen in Batomon's collection layout. The right side lists the whole
registry as tiles — split square, stars in the rarity's material, name, type, rarity, copies owned —
under filters for **element** (All, Solar, Arc, Void, Neutral), **action** (All, Strike, Tech,
Block), **rarity**, **owned only** and a **text search**, with the collection count under them. The
left card shows the selected mod: name, rarity and material, the large split square, tag chips,
description, the rules at the previewed star level, a **★ / ★★ / ★★★ preview** whatever is owned, a
table of every number at every star, what it makes, spends, applies and cleanses, its piece with
its ports and a **rotate** control showing the orientation, the copies owned and what combining
needs. Ownership is read through `CollectionRepository` (`src/run/collection.ts`); nothing persists
it yet, so the game injects a seeded development collection.

## The seed catalogue

The spec's twenty-five mods, plus four Neutral utility mods kept from the first catalogue so the
Neutral filter and the run perks survive. The first catalogue's Neutral **Overclock** is now
**Amplifier**, because the spec names an Arc / Tech **Overclock**. Generated from the registry:

| Mod | Rarity | Type | Shape | Fires | Numbers at ★ / ★★ / ★★★ |
| --- | --- | --- | --- | --- | --- |
| Heat Coil | Common · Iron | SOLAR | MONO | every exchange | Heat made 1/2/3 |
| Basic Sink | Common · Iron | SOLAR / BLOCK | MONO | on Block | Heat sunk, at most 2/3/5; Parry heal per unit 1/1/1 |
| Arc Dynamo | Common · Iron | ARC | MONO | every exchange | Charge made 1/2/3 |
| Battery Cell | Common · Iron | ARC | MONO | always on | Charge capacity 2/3/5 |
| Void Tap | Common · Iron | VOID | MONO | every exchange | Drained into Void 1/2/3 |
| Cinder Edge | Uncommon · Bronze | SOLAR / STRIKE | DUO | on Strike | Heat spent 1/1/1; Damage 2/3/4; Burn applied 2/3/5 |
| Thermal Relay | Uncommon · Bronze | SOLAR / TECH | MONO | on Tech | Heat made 2/3/5 |
| Live Wire | Uncommon · Bronze | ARC / STRIKE | DUO | on Strike | Charge spent 1/1/1; Damage 1/2/3; Shock applied 2/3/4 |
| Capacitor Guard | Uncommon · Bronze | ARC / BLOCK | MONO | on Block | Charge spent 2/2/2; Parry heal 3/5/8; Riposte damage 2/3/5 |
| Venom Tap | Uncommon · Bronze | VOID / STRIKE | DUO | on Strike | Void spent 1/1/1; Poison applied 1/2/3 |
| Furnace | Rare · Silver | SOLAR | DUO | every exchange | Heat made 2/3/5 |
| Cooling Array | Rare · Silver | SOLAR / BLOCK | DUO | on Block | Heat sunk, at most 3/4/6; Parry heal per unit 1/1/1; Burn removed per unit 1/1/2 |
| Chain Circuit | Rare · Silver | ARC / TECH | I3 | on Tech | Charge made 1/1/2; More per link 1/2/3 |
| Storm Cell | Rare · Silver | ARC / STRIKE | DUO | on Strike | Charge spent 2/2/2; Shock applied 4/6/9 |
| Null Reservoir | Rare · Silver | VOID | L3 | every exchange | Drained into Void 1/2/3; Void each round 1/2/3 |
| Afterburner | Super Rare · Gold | SOLAR / STRIKE | L3 | on Strike | Heat spent 3/3/3; Damage 5/8/12; Burn applied 4/6/9 |
| Phoenix Sink | Super Rare · Gold | SOLAR / BLOCK | L3 | on Block | Heat sunk, at most 5/7/10; Parry heal per unit 1/1/1; Riposte damage per unit 1/1/1 |
| Overclock | Super Rare · Gold | ARC / TECH | DUO | on Tech | Charge spent 3/3/3; Damage 6/9/13 |
| Feedback Loop | Super Rare · Gold | ARC | MONO | every exchange | Charge given back 1/2/3 |
| Event Horizon | Super Rare · Gold | VOID / TECH | L3 | on Tech | Drained into Void 2/3/4; Void spent 2/2/2; Poison applied 2/3/5 |
| Solar Flare | Legendary · Diamond | SOLAR / STRIKE | T4 | on Strike | Heat made 2/3/4; Heat spent 4/4/4; Damage 6/9/14; Burn applied 6/9/14 |
| Thunderhead | Legendary · Diamond | ARC / STRIKE | L4 | on Strike | Charge spent 4/4/4; Damage 4/6/9; Shock applied 6/9/14 |
| Singularity | Legendary · Diamond | VOID / TECH | O4 | on Tech | Drained into Void 2/3/4; Void spent 4/4/4; Damage 8/12/18; Poison applied 2/3/4 |
| Black Battery | Legendary · Diamond | VOID / ARC | L3 | every exchange | Charge capacity 2/3/4; Drained into Void 2/3/4; Void into Charge 1/2/3 |
| Heat Death | Legendary · Diamond | VOID / SOLAR | L3 | every exchange | Drained into Void 2/3/4; Heat into Void 2/3/4; Void spent 3/3/3; Poison applied 2/3/5 |
| Piggy Bank | Common · Iron | NEUTRAL | MONO | always on | Dollars each payday 1/2/3 |
| Coupon | Uncommon · Bronze | NEUTRAL | MONO | always on | Free rerolls each day 1/2/3 |
| Crowd Pleaser | Uncommon · Bronze | NEUTRAL | DUO | always on | Extra style payouts 1/2/3 |
| Amplifier | Legendary · Diamond | NEUTRAL | MONO | always on | Lane power per cell 1/2/3 |

## Provisional numbers

All of these are first guesses, to be replaced by measurements from `npm run tune`:
`BURN_DAMAGE_PER_STACK` 1, `SHOCK_BONUS_PER_STACK` 1, `POISON_DIVISOR` 2, `BASE_CHARGE_CAPACITY` 3,
`LINK_BONUS` 1, Heat halving at round end, lane power 1 per elemental cell (2 attuned), the shop's
rarity odds, every registry number, and prices by rarity.
