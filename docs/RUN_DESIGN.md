# FightLab — The Run

**Status: accepted, being built.** This is the design the run phase implements. It supersedes the
first design pass — the five-action loop, the lane colours, scouting and the interactive mockup that
went with them — and records every decision taken since. [`AGENTS.md`](../AGENTS.md) is the contract
the code is held to and [`RUN_PLAN.md`](RUN_PLAN.md) tracks what exists and
what has been measured; this document says what the game is and why. Numbers marked *measured* come
from the simulation; every other number is a starting value to tune.

## The pitch in one paragraph

A run is a string of days. Each day you walk into a shop laid out like Batomon Showdown's: you buy
**mods** — coloured polyominoes with one type and an optional action affinity — pack them into your
fighter's **4 × 4 board**, and program **two action bars** of three actions each. Shape, rotation and
orthogonal adjacency make the build spatial; type determines Burn, Shock or Poison, while affinity
says which action fires a mod. Then you fight. A fight is a series of rounds; each round plays your
active bar once, slot against slot, and hitboxes decide how every exchange lands. Between rounds the
fight pauses and you make one decision: stay on the bar your opponent just saw, or **Mixup** to the
other one. At the knockout you get paid — base income, interest, a victory bonus and a **style**
payout for the combos you strung together — and the next day starts. Ten trophies wins the run; lose
five hearts and it ends.

What stays sacred: **a mod changes how hard you hit, never who wins an exchange.** The
Strike › Tech › Block cycle, the frame timing that enforces it physically and the determinism tests
all carry over untouched.

## Decisions

The numbered rows are the run decisions; D2–D11 are the confirmed decisions from the 64-mod rebuild.

| # | Question | Decision |
| --- | --- | --- |
| 1 | Hearts | **Five.** A defeat costs one. Fighter health is drawn as five hearts too, with partial fill over the granular health values, so a +1 or +2 damage mod visibly moves a heart (§5). |
| 2 | Style's reach | **Money only.** No damage bonus at any rank. Style is a parallel reward that never makes the winning fighter snowball. |
| 3 | Opponent information | **Nothing is telegraphed before the fight.** The next opponent is read by fighting it (§3). |
| 4 | Merging duplicates | **Superseded by row 11:** copies combine into ★★ and ★★★. |
| 5 | Player figure | **The authored fighter.** No picker until fighters have gameplay identity or the core run is proven fun. |
| 6 | Combat | **Two three-action bars and discrete rounds** with a Mixup decision between rounds (§3). |
| 7 | Mod colours | **Type and affinity split each occupied cell diagonally; rarity owns the name colour and a neutral outline pattern.** The FL-020 refresh restores two-colour art without action glyphs on mods. |
| 8 | Display | **One fullscreen 16:9 composition,** scaled to the device (§1). |
| 9 | Shop layout | **Batomon's proportions.** The action bars sit in the right-hand negative space; there is no fighter card or intel panel (§10). |
| 10 | What a mod is | **One data definition:** id, name, rarity, type, optional affinity, one of 11 shapes and one effect. Placement and orthogonal adjacency are the build relationships. |
| 11 | Upgrades | **Stars, ★ / ★★ / ★★★.** Three ★ copies combine into ★★, two ★★ into ★★★. A star is the upgrade level and nothing else. |
| 12 | Rarity | **Five rarities, separate from stars:** Common, Uncommon, Rare, Super Rare, Legendary. Rarity sets price, shop odds, vocabulary complexity and the name colour. |
| 13 | Damage outside contact | **Burn and Poison hurt at the end of a round.** Damage still exists only inside the kernel: by hitbox contact, exposure or an affliction reported by the arena. |
| 14 | Affinity | **A mod may have Strike, Tech or Block affinity.** It fires on that action; no affinity means every exchange. Type never means an action. |
| 15 | Title, Armory and save | **Play / Armory / Settings.** The Armory browses the live 64-definition registry. Save version 4 discards older registry formats. |
| D2 | Board and action rows | **4 × 4 board.** Action rows and their lane power retired; action preview comes from the placed mods' effects. |
| D3 | Energy economy | **Retired.** Burn, Shock and Poison remain as statuses; resource pools, capacity and routing do not. |
| D4 | Type and status | **Exactly one type per mod.** Solar → Burn, Arc → Shock, Void → Poison, Neutral → none. Affinity is optional. |
| D5 | Rarity presentation | **Material rarity retired.** Rarity colours the name/chips; stars are neutral pips. |
| D6 | Mod surfaces | **Dark.** Catalogue, board, bank, offers and tooltip use the shared dark mod palette. |
| D7 | Registry and persistence | **Fresh 64-mod registry with new ids; save version 4.** Older registry saves are discarded. |
| D8 | Catalogue filters | **Type, Action (including None), Size and Rarity.** OR within a group, AND across groups; Clear empties all. |
| D9 | Rotation | **Degrees and cursor pivot.** Stored as 0/90/180/270, normalised to distinct orientations; turns pivot about the occupied cell under the cursor. |
| D10 | Catalogue UI tests | **happy-dom.** DOM rendering, selection, rotation and filtering are tested in Vitest. |
| D11 | Shape weight | **28 / 12 / 16 / 8 by size.** Every type has one of each tetromino; tetrominoes are deliberately more common on the 4 × 4 board. |

Constraints every rule below is held to:

- Mods never change which action beats which action.
- Mods may change damage, healing and riposte damage, and put Burn, Shock and Poison on the
  opponent. They never change startup, active or recovery frames, the order of actions in a bar, or
  which bar is active, and nothing reduces a hit that lands.
- "Parry hurts the attacker" is riposte damage. Nothing deals damage without hitbox contact except
  Burn and Poison, and those only as kernel afflictions at the end of a round (row 13).
- Style derives from resolved exchange wins, never from damage totals.
- The combo streak is defined exactly (§4) and tested exhaustively.
- Rotating a placed mod succeeds only when the rotated placement is legal.
- The registry is the catalogue: exactly 64 mods ([`MODS.md`](MODS.md)). The shop shows five offers at a time.
- Everything the run generates — opponents, their switching, shops, rerolls — is a pure function of
  the run seed.
- The autosave format is versioned from the first release.

## 1. Display

FightLab is designed for one presentation: a fullscreen, landscape, **16:9 playfield**.

- The playfield fills the largest 16:9 rectangle the display allows, letterboxed on whatever side is
  left over. There are no desktop, tablet and phone layouts — one composition, scaled.
- Every screen is authored on a **1600 × 900 design grid**. Type, panels, the grid, the fighters and the
  HUD all scale together, so their proportions never change.
- Rendering is at the device's native resolution. The UI is DOM and SVG, which the browser rasterises
  at the device pixel ratio; nothing is drawn into a fixed-size bitmap and nothing is capped at 1080p,
  1440p or any other resolution.
- A portrait display, or one whose largest 16:9 rectangle is too small to read, is an **unsupported
  presentation state**: the game shows a single "turn your device sideways" (or "make the window
  larger") card instead of rearranging itself into a vertical UI. Rotating or resizing resumes the game
  exactly where it was.
- Where the browser allows it, a fullscreen control takes the page fullscreen.

## 2. The run

```
Title ─► New run ─► ┌─► Prep (DAY n) ─► Fight ─► Payday ─┐
                    └──────────────────────────────────────┘
                     until 10 trophies (Champion) or 0 hearts (Knocked out)
```

| Rule | Value |
| --- | --- |
| Hearts | 5. A defeat costs one. |
| Trophies | 10 win the run. A victory earns one. |
| Draw (double knockout, stalemate, round limit) | No trophy, no heart. |
| Fighter health | Full at the start of every fight; carried from round to round within it. Maximum health is 100. |
| Starting money | $10 |
| Run length | 10–14 days. |

Every run has a **seed**. Shops, rerolls, opponents and how opponents switch bars all come from it,
so the same seed and the same choices replay the same run — the existing determinism contract,
extended one level up.

## 3. The fight

### Two action bars

Each fighter owns two bars of exactly three actions:

```ts
type ActionBar = readonly [ActionType, ActionType, ActionType];

interface ActionLoadout {
  primary: ActionBar;   // "Bar A" on screen
  secondary: ActionBar; // "Bar B"
}
```

Both bars are programmed in prep, every slot independently Strike, Tech or Block, free to change
every day. A new run starts with Bar A `Strike Tech Block` and Bar B `Block Block Strike`. Once a
fight begins no slot of either bar can change.

### Rounds

A fight is a series of rounds. **A round plays the active bar exactly once:** slot 1 meets the
opponent's slot 1, then slot 2 meets slot 2, then slot 3 meets slot 3, and the round ends.

```
ROUND 1:  1 → 2 → 3      PAUSE (Mixup?)
ROUND 2:  1 → 2 → 3      PAUSE (Mixup?)
ROUND 3:  1 → 2 → 3      …   until a knockout
```

There is no wrap from slot 3 back to slot 1 inside a round. Every exchange still resolves the way it
always has: the matchup (Strike beats Tech, Tech beats Block, Block beats Strike) decides who *should*
win, and the real combat simulation — hitboxes, frame data, the parry — decides what lands. **Round 1
always starts on the primary bar**, for both fighters.

The fight moves through four phases:

| Phase | What happens |
| --- | --- |
| `round-intro` | `ROUND n`. Both fighters walk back to their marks and stand ready for a beat. |
| `fighting` | Exchanges for slots 1, 2 and 3, each opened, committed on one tick and closed only when combat says it has settled. |
| `round-pause` | The simulation is stopped. The decision state (below). |
| `ko` | A fighter is down. Nothing else executes. |

- Health persists between rounds. A new round heals nobody unless a mod explicitly says so (none in
  v1 does).
- The pause begins only after slot 3 has completely settled.
- A knockout in slot 1 or 2 ends the fight at once; the rest of the bar never executes.

### The pause and Mixup

The pause is a deliberate decision state, not an animation delay. The arena stays visible, frozen;
both bars are shown with the active one marked; health and style stay on screen; so does everything
the player has seen the opponent do.

The one decision: **MIXUP** swaps the active bar, primary ↔ secondary. The button says what it will
do — `MIXUP · Switch to Bar B` — so nobody has to remember which bar is live. Pressing it again swaps
back. **FIGHT** (`Round n`) leaves the pause; leaving without pressing Mixup keeps the same bar.

During the pause the player cannot buy, move, rotate or sell mods, edit a slot, reroll or change
anything else: those are prep activities. Mixup never edits a bar; it only chooses which of the two
planned bars runs next.

### Knockout, stalemate and the round limit

| End | Rule | Result |
| --- | --- | --- |
| Knockout | An exchange settles with one fighter down | Victory or defeat |
| Double knockout | Both down in the same exchange (a trade) | Draw |
| Stalemate | A round in which nobody was hurt, followed by a round that would run the same two bars again | Draw — it would repeat forever |
| Round limit | 30 rounds | Draw — a backstop, not a rule of play |

A round in which nobody is hurt can only be three guards against three guards. The pause after one
says so — "nobody was hurt; the same bars again is a draw" — and the player can still Mixup out of it.
Nothing random is ever added to force a winner.

### Opponents use the same contract

An opponent owns exactly the player's two-bar loadout plus a **mixup plan**:

```ts
interface OpponentPlan {
  primary: ActionBar;
  secondary: ActionBar;
  mixup: MixupPlan;
}

type MixupPlan =
  | { kind: "steady" }                              // never switches
  | { kind: "alternate" }                           // switches at every pause
  | { kind: "reactive" }                            // switches after a round in which it lost more exchanges than it won
  | { kind: "scripted"; rounds: readonly number[] } // switches before exactly these rounds
```

The plan is generated from the run seed with the opponent, so no decision is ever made with runtime
randomness. The opponent's decision is fixed the moment the pause begins, from the rounds fought so
far, and applied when the next round starts — it never sees the player's choice in the same pause.
Replaying the same seed, loadouts, mods and player Mixups replays the same decisions.

### What the player sees of the opponent

Nothing before the fight. The prep screen has no opponent card: no figure, no name, no composition,
no revealed slots. The opponent walks out when the fight starts, and from then on each exchange
reveals the opponent's action for that slot when both moves commit. Every round's revealed actions
stay on screen for the rest of the fight, so by the second pause a player who is paying attention
knows one bar outright and has seen whether the opponent's next round looked different. Whether the
opponent switched is never announced; it is read.

## 4. Style

Style measures one thing: whether you read this opponent. Each fighter has a meter.

**Outcomes.** Every settled exchange is, from one fighter's side:

| Outcome | When |
| --- | --- |
| **win** | You hurt the opponent and were not hurt. |
| **loss** | You were hurt and did not hurt the opponent. |
| **trade** | Both fighters were hurt. |
| **even** | Nobody was hurt (both guarded). |

Outcomes come from what resolved physically — who was hurt — never from how much damage was dealt,
so a damage mod can never buy style.

**The meter.** A rank — C, B, A, S — and a chain, both starting at C and 0 at the start of every fight:

| Outcome | Chain | Rank |
| --- | --- | --- |
| win | +1 | if the chain is now 2 or more, the win is a **combo** and the rank rises one step (S is the cap) |
| loss | reset to 0 | falls one step (C is the floor) |
| trade | reset to 0 | falls one step (C is the floor) |
| even | unchanged | unchanged |

So the first win of a chain is never a combo, every later one is, and a guard exchange neither
extends nor breaks a chain. **Round boundaries mean nothing to style:** a chain carries from slot 3
of one round into slot 1 of the next. A Mixup that breaks the opponent's momentum does it by winning
exchanges, not through any round bonus. The **peak** rank reached in the fight is what pays.

**Payday:** peak C / B / A / S pays $0 / $1 / $2 / $3. Style never touches damage, health or any
other combat number.

## 5. Health on screen

Health stays granular underneath: 100, with integer damage from the kernel. On
screen each fighter's health is **five hearts**, each worth a fifth of that fighter's maximum health,
filled in proportion — a heart is not a unit of damage. A 12-damage jab against 100 health empties 60%
of one heart; with one +1 mod it empties 65%. The exact number is printed under the hearts.

The run's five hearts are lives and appear on the prep and payday screens; fighter hearts appear in
the fight. The two never share a screen.

## 6. The build

A fighter's build is its two bars (§3) and its **mod grid**, both edited only on the prep screen.

### Board and adjacency

The active build lives on a **4 × 4 board**. Only placed mods are active.

```
┌───┬───┬───┬───┐
│   │   │   │   │
├───┼───┼───┼───┤
│   │   │   │   │
├───┼───┼───┼───┤
│   │   │   │   │
├───┼───┼───┼───┤
│   │   │   │   │
└───┴───┴───┴───┘
```

A placement is legal when every occupied cell is on the board and empty. Two mods are adjacent when
their turned footprints share at least one horizontal or vertical cell edge; corner contact does not
count. Effects can scale from occupied cells, all neighbours, same-type neighbours or other-type
neighbours, and boosts can affect adjacent mods. The board has no action rows: Strike, Tech and Block
remain in the two action bars, while the build's per-action preview is compiled from the effects that
can fire for that action.

### Types and status

A mod has exactly one type: **Solar, Arc, Void or Neutral**. Type is never an action. Solar status
payoffs apply Burn, Arc applies Shock, Void applies Poison and Neutral applies none. An optional
Strike, Tech or Block affinity says which exchange fires the mod; no affinity means every exchange.

### Bank

A 1×4 strip above the grid holds mods out of play. Any mod fits one bank slot, drawn as a miniature of
its shape; pulled out, it blooms back to full size. Rotation is kept either way.

## 7. Mods

A mod is data: `{ id, name, rarity, type, affinity, shape, effect }`. There is no per-mod code.
The live registry contains 64 definitions and is the same source read by the shop, Armory, compile
and combat integration.

### Shapes and rotation

The shape library has eleven canonical footprints: I/O/T/S/Z/J/L tetrominoes, straight and L
triominoes, domino and single. Rotation is stored as degrees — 0, 90, 180 or 270 — and symmetrical
duplicates normalise to the first distinct orientation. A clockwise turn pivots about an occupied
board cell; if the turned footprint would overlap or leave the 4 × 4 board, it is refused.

### Adjacency and effects

Orthogonal adjacency is the only relationship between placed mods. The program records each mod's
cell count, neighbours, same-type neighbours and other-type neighbours, then applies adjacent boost
effects before an exchange.

The effect vocabulary is deliberately small: exchange payoffs (damage, heal, the mod type's status,
cleanse), scales (flat, cell, adjacency or opponent status), two conditions (adjacent type or opponent
status), adjacent boosts, and three run perks (income, free reroll, style). Strike/Tech payoffs that
need contact land when the move hurts; Block payoffs land when its guard holds.

### Rarity, stars and the catalogue

Rarity sets price, shop odds and vocabulary complexity: Common $3, Uncommon $4, Rare $5, Super Rare
$7, Legendary $8. Rarity colours the name and filter/odds chips only.

Stars are the upgrade level: three ★ combine into ★★, two ★★ into ★★★. Stars use neutral pips. Selling
returns half the price of every ★ copy inside the mod, rounded down, at least $1.

The catalogue is exactly 64 mods: 16 of every type, 16 in every affinity bucket (None included), and
four of every type × affinity pair. Its size split is 28 tetrominoes / 12 triominoes / 16 dominoes /
8 singles. [`MODS.md`](MODS.md) is the full model, matrix, vocabulary and palette.

### What a mod can never do (C9)

Mods may change bonus damage, parry healing and statuses. They never change startup, active or
recovery frames, hitbox or parry windows, guard-break rules, bar order or the active bar. The C9
property test builds a thousand random boards from the 64 on 4 × 4 at random stars and degree
rotations, loads statuses, and checks all nine action pairs without changing a winner or timing field.

## 8. Shop and economy

### The shop

| Action | Rule |
| --- | --- |
| Buy | Drag an offer onto the grid or into the bank, or click it to send it to the first free bank slot. Refused with a shake when you cannot afford it or have nowhere to put it. |
| Sell | Drag any owned mod onto the shop strip, which reads `SELL +$n` while you drag. |
| Reroll | $1 (Coupons make the first ones each day free). Five new offers from today's odds. |
| Lock | Keeps today's unsold offers into tomorrow; sold slots are refilled. Rerolling unlocks. |

Five offers, drawn with replacement from the registry by rarity. The odds rise with the day and are
shown on the screen the way Batomon shows its rank line, each rarity as a labelled colour chip:

| Rank (days) | Common | Uncommon | Rare | Super Rare | Legendary |
| --- | --- | --- | --- | --- | --- |
| 1 (1–2) | 70% | 30% | — | — | — |
| 2 (3–4) | 45% | 35% | 20% | — | — |
| 3 (5–7) | 25% | 35% | 25% | 12% | 3% |
| 4 (8+) | 10% | 25% | 30% | 25% | 10% |

Every offer is a ★ copy. Buying a copy that completes a set combines it on the spot (§7).

### Payday

After every fight that does not end the run:

| Line | Amount |
| --- | --- |
| Base | $5 |
| Result | victory +$2, draw +$1, defeat $0 |
| Interest | +$1 per $5 held when the fight began, up to +$2 |
| Style | peak C / B / A / S → $0 / $1 / $2 / $3, paid again once per Crowd Pleaser star |
| Piggy Bank | +$1 each |

A typical day pays $7–11. Interest is capped low on purpose: saving should be a choice, not the
dominant strategy.

## 9. Opponents

Day *n*'s opponent is a pure function of the run seed and *n*:

- **A figure** from Boneyard's roster other than the player's — Barst, Kiran or Yuliya — never the
  same one two days running. Its name is the figure's name.
- **An archetype** that shapes its bars: Brawler (Strike-heavy), Breaker (Tech-heavy), Wall
  (Block-heavy) or Trickster (whose secondary bar beats whatever beats its primary).
- **A mixup plan** (§3), weighted by archetype.
- **A build** bought from the same catalogue and odds a player would see that day, with a budget that
  grows by day, packed greedily by affinity weight and same-type adjacency.

The archetype is never shown; it is only how the opponent was made. No networking and no ghosts of
other players: asynchronous multiplayer stays out of scope.

## 10. Screens

The interface is the Batomon Showdown look — bright teal shop, grassy arena, chunky outlined type,
bevelled buttons — built from original art. Every screen is a 1600 × 900 composition (§1).

### Prep — `DAY n`

The shop keeps Batomon's broad proportions: top status bar, bank and board in the centre, the two
action bars in the right-hand negative space, then rarity odds / money / Lock and the five-offer shop
strip along the bottom.

- **Board:** a dark 4 × 4 surface with the largest cells that fit. Pieces keep their saturated type
  colour. A valid carried placement gets a thin valid outline; an invalid one keeps its silhouette
  under the invalid hatch/outline.
- **Bank:** four dark slots above the board. Rotation is preserved.
- **Action bars:** Bar A over Bar B, three slots each. Each slot shows its action and the build's
  compiled unconditional damage preview for that action.
- **Shop strip:** Reroll on the left, five offers, Fight on the right, with money and Lock above.
  Offers show the two-colour shape, compact effect badges, rarity-coloured name and price.
- **Controls:** left click/tap picks up and places; right click turns clockwise about the cell under
  the pointer; R is the keyboard turn; Escape cancels the carry. Illegal placement is refused.
- Nothing on this screen describes the next opponent.

### Fight

```
[STYLE B]  YOU ♥♥♥♥♡ 88            ROUND 3             KIRAN ♥♥♥♡♡ 64  [STYLE C]
                                   ▶▶ 2×
                  sky · pines · grass, the two Boneyard fighters
BAR A  [S][T][B]            STRIKE vs TECH — STRIKE WINS          KIRAN  [S][?][?]
                                                                  R2     [T][B][S]
```

- Health as hearts along the top with the number under them; `ROUND n` in the centre with the speed
  control under it; style meters in the two top corners (a large outlined rank letter, a four-step
  ladder and a combo counter).
- The player's active bar bottom-left with the resolving slot raised; the opponent's revealed actions
  bottom-right, this round over every earlier one.
- The current exchange between them: both actions once they commit, and the verdict.

### Round pause

The arena stays visible behind it; the planning information takes over the centre:

```
            BAR A    [S] [T] [B]    ACTIVE
            BAR B    [B] [B] [S]

                  [ MIXUP ]
               Switch to Bar B

                  [ FIGHT ]
                   Round 4
```

It is a fighting-game round break, not another prep screen: fast, readable, one decision. Keys: M
mixes up, Enter or Space fights.

### Payday

The outcome, the trophy or heart change, then the income lines tallying into the money pill — base,
result, interest, style, Piggy Bank — and `NEXT DAY`.

### Run end

`CHAMPION` or `KNOCKED OUT`, the record, the best style reached, the final build, `NEW RUN` and
`TITLE`.

### Title and settings

Title: `PLAY` (continuing a saved run, or starting one), `ARMORY`, `SETTINGS`, and a small `NEW RUN`
while a run is saved. Settings: battle speed 1× / 2× / 4×, reset, return.

### Armory

The whole 64-mod catalogue on one screen: a selected detail pane on the left and a four-column,
scrolling card grid on the right. `FILTER: NONE` opens Type, Action (including None), Size and
Rarity groups; choices are OR inside a group and AND across groups. Cards are shape-first: type
and affinity colours split each cell diagonally, a small effect value sits on the centroid-nearest
occupied cell, and effect badges sit below the artwork. The name alone takes the rarity colour; a
neutral outline pattern also varies by rarity. The detail pane previews ★ / ★★ / ★★★ and can turn
through the shape's distinct orientations. [`MODS.md`](MODS.md#catalogue-ui) is the contract.

### Interaction and access

- Every drag has a click/tap and keyboard path. Pick a piece up, move it, rotate with R, place with
  Enter, bank with B, sell with S, or cancel with Escape.
- Every card, piece, offer and bank slot has a `modLabel` naming type, affinity, shape, rarity and
  stars. Filter chips carry text; keyboard focus reaches the complete catalogue and modal.
- Colour is never the only signal: pieces have accessible labels, actions carry icons, rarity is
  labelled in filters, and placement validity uses outline/pattern as well as colour.
- Dragging uses pointer events, so touch works.

## 11. Architecture

The layers from AGENTS.md hold; two pure layers join them above combat.

```
src/run/     the seeded run: days, hearts, trophies, money, shop, opponents, autosave
src/mods/    shapes, grid and bank, the catalogue, compile
src/battle/  bars, the matchup, the director (rounds, pause, Mixup), mixup plans, style
src/combat/  the sealed kernel; frame data; the adapter
src/render/  Boneyard figures on an original arena
src/game/    composition: a compiled build becomes a combat side; one fight; clock; settings
src/ui/      the screens, in one 16:9 composition
```

**Compile is the only bridge from a board to combat.** `compileBuild(grid)` returns the active
program, an unconditional per-action damage preview and the run perks. The program contains each
placed mod at its stars with its occupied-cell and adjacency counts; boosts are resolved from that
graph. `ModdedArena` runs the status engine around each combat exchange and round end. The kernel
still only ever hears move names, bonuses, heals, exposure and afflictions.

**Kernel additions, all generic and sealed:** a move command may carry an integer damage bonus that
every hit of that move — and the counter its parry starts — adds, and an integer heal its parry
adds; a fighter may carry *exposure* that the next hit landing on it adds and clears; and an
*affliction* takes health between ticks, reported as an event, and can knock a fighter out. The
kernel never learns what a mod, type, affinity, adjacency relationship, status rule or round is.

**Determinism.** One integer PRNG, seeded per purpose: every draw is keyed by the run seed, a purpose
and its indices — `shop / day / reroll`, `opponent / day` — so rerolling the shop can never shift
tomorrow's opponent, and nothing depends on the order things were generated in. The fight itself has
no randomness at all.

**Persistence.** The run autosaves to `localStorage` after every change as
`{ version: 4, run, fight }`, where `fight` holds the player's Mixup decisions in the fight in
progress. Version 4 is the 64-mod registry format; older registry saves are discarded whole.
Resuming a fight replays those decisions headlessly to the same pause, so reloading cannot re-roll a
fight. A save that fails validation, or has a version the game does not read, is discarded rather
than half-loaded. Nothing leaves the machine.

## 12. Acceptance tests

Headless, before any combat UI changes:

- An action bar is exactly three valid actions; each fighter has exactly two bars.
- Round 1 starts on the primary bar; exactly three exchanges occur before a pause unless a knockout
  comes first; slots progress 0 → 1 → 2; slot 3 settles before the pause begins.
- A knockout in slot 1 or 2 ends the fight at once and nothing after it executes.
- Health persists between rounds.
- Leaving the pause without Mixup keeps the active bar; Mixup toggles primary ↔ secondary; Mixup is
  refused while an exchange is running; no slot can be edited once combat begins.
- Opponent Mixup decisions replay identically from the same seed.
- The nine matchup results are unchanged; the physics agree with the matrix in every exchange; mods
  cannot alter a winner (C9).
- The same seed, loadouts, mods and player Mixups produce the same fight, byte for byte, at 1×, 2× and
  4×.
- The style rules above, checked against every sequence of outcomes up to length eight.
- Every canonical shape and degree rotation is legal exactly where its turned cells fit; pivoted turns
  keep the occupied cursor cell fixed, and adjacency uses the turned footprint.
- Opponents, shops and rerolls are pure functions of the seed; a recorded run replays to the same
  paydays; a save round-trips, and anything malformed or of another version is refused.

## 13. Build order

1. **Rules, headless.** Bars, rounds, pause and Mixup in the director; mixup plans; style; shapes,
   grid and bank; the catalogue; compile; the PRNG; shop and economy; opponents; the run state
   machine; the save format. Tests for each.
2. **Combat.** The kernel's bonus and parry heal; the adapter; compiled sides; the C9 property test;
   determinism across speeds and replays.
3. **UI.** The 16:9 stage; the Batomon kit; prep; the fight with its pause; payday; run end; title.
4. **Tuning.** Bot runs across many seeds; the numbers in this document get replaced by measured ones.

## 14. Not in v1

- **Scouting** of any kind, and items. If information ever returns it should be earned in the fight
  and cost something, never be a free readout in the shop.
- Fighter selection.
- Mods that change hitstun.
- Round-start or round-end healing.
- A bundled pixel typeface: the UI uses the platform's rounded face until one is fetched and
  licensed into the tree.
