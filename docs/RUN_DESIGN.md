# FightLab — The Run

**Status: accepted, being built.** This is the design the run phase implements. It supersedes the
first design pass — the five-action loop, the lane colours, scouting and the interactive mockup that
went with them — and records every decision taken since. [`AGENTS.md`](../AGENTS.md) is the contract
the code is held to and [`IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md) tracks what exists and
what has been measured; this document says what the game is and why. Numbers marked *measured* come
from the simulation; every other number is a starting value to tune.

## The pitch in one paragraph

A run is a string of days. Each day you walk into a shop laid out like Batomon Showdown's: you buy
**mods** — Tetris-shaped pieces with an affinity — pack them into your fighter's 3×3 grid, and
program **two action bars** of three actions each. Then you fight. A fight is a series of rounds; each
round plays your active bar once, slot against slot, and hitboxes decide how every exchange lands.
Between rounds the fight pauses and you make one decision: stay on the bar your opponent just saw, or
**Mixup** to the other one. At the knockout you get paid — base income, interest, a victory bonus and
a **style** payout for the combos you strung together — and the next day starts. Ten trophies wins
the run; lose five hearts and it ends.

What stays sacred: **a mod changes how hard you hit, never who wins an exchange.** The
Strike › Tech › Block cycle, the frame timing that enforces it physically and the determinism tests
all carry over untouched.

## Decisions

| # | Question | Decision |
| --- | --- | --- |
| 1 | Hearts | **Five.** A defeat costs one. Fighter health is drawn as five hearts too, with partial fill over the granular health values, so a +1 or +2 damage mod visibly moves a heart (§5). |
| 2 | Style's reach | **Money only.** No damage bonus at any rank. Style is a parallel reward that never makes the winning fighter snowball. Other S-rank rewards can come later if it feels underpowered. |
| 3 | Opponent information | **Nothing is telegraphed before the fight.** The first answer — composition free, slot positions bought — was withdrawn by the shop rework: the next-opponent card, the scouting mod and the scouting item are gone. An opponent is read by fighting it (§3). |
| 4 | Merging duplicates | **None in v1.** Duplicates stay separate pieces. Lv. 1 → 3 can come later if the shop needs another progression axis. |
| 5 | Player figure | **The authored fighter.** No picker until figures have gameplay identity or the core run is proven fun. |
| 6 | Combat | **Two three-action bars and discrete rounds** replace the five-action loop, with a Mixup decision between rounds (§3). |
| 7 | Mod colours | **Solar, Void, Arc and Neutral** replace the action colours. An affinity is never an action (§6). |
| 8 | Display | **One fullscreen 16:9 composition,** scaled to the device (§1). |
| 9 | Shop layout | **Batomon's proportions.** The action bars sit in the right-hand negative space; there is no fighter card and no intel panel (§10). |

Constraints every rule below is held to:

- Mods never change which action beats which action.
- Mods may change damage, maximum health, healing and riposte damage. They never change startup,
  active or recovery frames, the order of actions in a bar, or which bar is active.
- "Parry hurts the attacker" is riposte damage. Nothing deals damage without hitbox contact.
- Style derives from resolved exchange wins, never from damage totals.
- The combo streak is defined exactly (§4) and tested exhaustively.
- Rotating a placed mod succeeds only when the rotated placement is legal.
- The sixteen mods are the catalogue. The shop shows five offers at a time.
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
| Fighter health | Full at the start of every fight; carried from round to round within it. Maximum health is 100 plus mods. |
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

Health stays granular underneath: 100 plus mods, integer damage from the kernel, exactly as now. On
screen each fighter's health is **five hearts**, each worth a fifth of that fighter's maximum health,
filled in proportion — a heart is not a unit of damage. A 12-damage jab against 100 health empties 60%
of one heart; with one +1 mod it empties 65%. The exact number is printed under the hearts.

The run's five hearts are lives and appear on the prep and payday screens; fighter hearts appear in
the fight. The two never share a screen.

## 6. The build

A fighter's build is its two bars (§3) and its **mod grid**, both edited only on the prep screen.

### Grid and lanes

```
            ┌───┬───┬───┐
  STRIKE ▸  │   │   │   │   powers the jab
            ├───┼───┼───┤
  TECH   ▸  │   │   │   │   powers the overhead
            ├───┼───┼───┤
  BLOCK  ▸  │   │   │   │   powers the riposte
            └───┴───┴───┘
```

The grid's rows are the three actions' **lanes**. Only placed mods are active.

- Every **Solar, Void or Arc** cell powers the action of its row by **+1** damage.
- A row whose three cells all share one affinity is **attuned**: each of its cells powers **+2**
  instead, +6 for the row.
- **Neutral** cells power nothing and never attune a row; they trade space for utility.

So a Solar I-piece laid along the Strike row attunes it (+6 on every jab), while the same piece
standing up across all three rows is +1 to each. Where a piece goes matters, and so does what sits
next to it in the row.

### Affinity

Affinity is a property of a mod, not an action, and it builds synergy **across** the triangle rather
than along it. Every three cells of one affinity on the grid is a **level** (0–3):

| Affinity | Identity | Per level |
| --- | --- | --- |
| **Solar** | power | every hit you land deals +1 damage |
| **Void** | endurance | +10 maximum health |
| **Arc** | volatility | in a round you entered with a Mixup, every hit you land deals +2 damage |
| **Neutral** | none | no level; the home of economy and rule-benders |

Solar is not Strike, Void is not Block and Arc is not Tech: a Solar level powers the jab, the overhead
and the riposte alike, and any affinity can attune any lane. Arc is the affinity that rewards the new
round structure — it reacts to a Mixup; it never causes one.

### Bank

A 1×4 strip above the grid holds mods out of play. Any mod fits one bank slot, drawn as a miniature of
its shape; pulled out, it blooms back to full size. Rotation is kept either way.

## 7. Mods

A mod is data — a shape, an affinity, a tier, a price and at most one perk. It has no code of its own;
everything it does is compiled into the fighter before the fight (§11).

### Shapes and rotation

Polyominoes of one to four cells that fit a 3×3 board (the I-tetromino does not, so it is not in the
set). Mods rotate in 90° steps; there is no flipping.

```
MONO  ▪        DUO  ▪▪        I3  ▪▪▪        L3  ▪·
                                                  ▪▪
O4  ▪▪        T4  ▪▪▪         L4  ▪··
    ▪▪            ·▪·             ▪▪▪
```

- A placement is legal when every cell is on the board and empty.
- While dragging, R, right-click or the wheel rotates the piece freely; the ghost is green where the
  drop would be legal and red where it would not, and an illegal drop returns the piece.
- A placed mod rotates in place — clockwise, keeping the top-left of its bounding box — **only if the
  rotated placement is legal.** Otherwise nothing moves and the piece shakes.

### Tiers

| Tier | Gem | Price | Typical shape | What it adds |
| --- | --- | --- | --- | --- |
| 1 | bronze | $3–4 | 1–2 cells | raw lane power, or a small economy perk |
| 2 | silver | $4–5 | 1–3 cells | power and a small perk |
| 3 | gold | $7 | 4 cells | power and a strong perk |
| 4 | diamond | $8 | 1 cell | a rule-bender |

Selling returns half the price, rounded down, at least $1.

### Catalogue — sixteen mods

| Mod | Affinity | Tier | Price | Shape | Perk |
| --- | --- | --- | --- | --- | --- |
| Ember | Solar | 1 | $3 | MONO | — |
| Sunburst | Solar | 1 | $4 | DUO | — |
| Flare | Solar | 2 | $5 | L3 | Jab +2 |
| Corona | Solar | 3 | $7 | T4 | Every hit +2 |
| Shade | Void | 1 | $3 | MONO | — |
| Nightfall | Void | 1 | $4 | DUO | — |
| Eclipse | Void | 2 | $5 | L3 | A successful parry heals 5 |
| Event Horizon | Void | 3 | $7 | O4 | Riposte +5 — the parry hurts the attacker through the counter |
| Spark | Arc | 1 | $3 | MONO | — |
| Coil | Arc | 1 | $4 | DUO | — |
| Static | Arc | 2 | $5 | I3 | Overhead +2 |
| Thunderclap | Arc | 3 | $7 | L4 | Every hit +3 in a round you entered with a Mixup |
| Piggy Bank | Neutral | 1 | $3 | MONO | +$1 every payday |
| Coupon | Neutral | 2 | $4 | MONO | The first reroll each day is free |
| Crowd Pleaser | Neutral | 2 | $5 | DUO | Style pays out once more — doubled with one, tripled with two |
| Overclock | Neutral | 4 | $8 | MONO | Each cell of every mod touching it powers +1 more |

There are no items in v1; the scouting report was the only one. Every perk that touches health
happens through a physical event in the kernel — a parry, a hit — never as a battle-layer adjustment.

### What a mod can never do (C9)

Compile may change damage, maximum health, parry healing and riposte damage. It never changes startup,
active or recovery frames, hitbox or parry windows, which hitboxes break guard, the order of a bar, or
which bar is active. A property test compiles random builds and fights all nine pairs for each; every
exchange must still agree with the matrix, and the compiled frame data must match the authored frame
data in every timing field.

Post-contact hitstun is also permitted, but no v1 mod uses it: every exchange ends before hitstun
could matter, so it would change pacing and nothing else.

## 8. Shop and economy

### The shop

| Action | Rule |
| --- | --- |
| Buy | Drag an offer onto the grid or into the bank, or click it to send it to the first free bank slot. Refused with a shake when you cannot afford it or have nowhere to put it. |
| Sell | Drag any owned mod onto the shop strip, which reads `SELL +$n` while you drag. |
| Reroll | $1 (Coupons make the first ones each day free). Five new offers from today's odds. |
| Lock | Keeps today's unsold offers into tomorrow; sold slots are refilled. Rerolling unlocks. |

Five offers, drawn with replacement from the catalogue by tier. The odds rise with the day and are
shown on the screen the way Batomon shows its rank line:

| Rank (days) | T1 | T2 | T3 | T4 |
| --- | --- | --- | --- | --- |
| 1 (1–2) | 80% | 20% | — | — |
| 2 (3–4) | 55% | 35% | 10% | — |
| 3 (5–7) | 30% | 40% | 25% | 5% |
| 4 (8+) | 15% | 35% | 35% | 15% |

### Payday

After every fight that does not end the run:

| Line | Amount |
| --- | --- |
| Base | $5 |
| Result | victory +$2, draw +$1, defeat $0 |
| Interest | +$1 per $5 held when the fight began, up to +$2 |
| Style | peak C / B / A / S → $0 / $1 / $2 / $3, paid once more per Crowd Pleaser |
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
  grows by day, packed greedily into the lanes its bars use most.

The archetype is never shown; it is only how the opponent was made. No networking and no ghosts of
other players: asynchronous multiplayer stays out of scope.

## 10. Screens

The interface is the Batomon Showdown look — bright teal shop, grassy arena, chunky outlined type,
bevelled buttons — built from original art. Every screen is a 1600 × 900 composition (§1).

### Prep — `DAY n`

The shop takes Batomon's proportions box for box. The left-hand card is gone; the action bars fill the
negative space on the right.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          ♥ 5      DAY 4      🏆 3/10                   ⚙  ⏏   │
│                 ┌─ BANK ───────────────────────────┐                          │
│                 │  [ ▪ ]  [ ▪▪ ]  [    ]  [    ]    │  ┌─ ACTION BARS ──────┐  │
│                 └───────────────────────────────────┘  │ BAR A  starts       │  │
│                  ┌─ MODS ─────────── ☀1  ◐0  ⚡0 ─┐     │ [STRIKE][TECH][BLOCK]│ │
│                  │ STRIKE +4 ▸ ▪ ▪ ·               │     │    16    16    14   │  │
│                  │ TECH   +0 ▸ · · ·               │     │ BAR B               │  │
│                  │ BLOCK  +2 ▸ ▪ · ·               │     │ [BLOCK][BLOCK][STRIKE]│ │
│                  └──────────────────────────────────┘     │ HEALTH 100          │  │
│      RANK 2  ◆55%  ◆35%  ◆10%      ( $14 )                 [LOCK]               │
│ ┌────────┐ ┌─────────────────────────────────────────────┐ ┌────────┐           │
│ │ REROLL │ │  [mod]   [mod]   [mod]   [mod]   [mod]       │ │ FIGHT! │           │
│ └────────┘ └─────────────────────────────────────────────┘ └────────┘           │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Region | Batomon (of 526 × 296) | FightLab (of 1600 × 900) |
| --- | --- | --- |
| Top bar: hearts, day, trophies; settings and leave on the right | y 0–30 | y 0–92 |
| Left card | x 5–100 | removed — negative space |
| Bank (Batomon's "Box"), 1×4 | x 140–380, y 35–95 | x 425–1155, y 100–260 |
| Grid (Batomon's "My Team"), 3×3 with lane labels | x 170–350, y 100–210 | x 470–1110, y 272–660 |
| **Action bars** in the right negative space | x 385–526, y 35–215 (empty) | x 1175–1585, y 100–660 |
| Rank odds, money pill, Lock | y 213–235 | y 668–720 |
| Reroll, five offers, Fight | y 240–296 | y 730–892 |

- **Grid:** lane labels in the action colours with each lane's live total (`STRIKE +4`), an attuned
  lane marked with its affinity; the affinity levels in the panel header.
- **Action bars:** Bar A over Bar B, three slots each; each slot shows its action and the damage the
  grid gives it (Block shows the riposte). Clicking a slot opens the Strike / Tech / Block picker. The
  panel ends with the fighter's maximum health.
- **Shop strip:** Reroll on the left in orange, five offers, Fight on the right in red, money in a pink
  pill and Lock in yellow above — Batomon's arrangement, kept deliberately.
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

Title: `CONTINUE` when a run is saved, `NEW RUN`, `SETTINGS`. Settings: battle speed 1× / 2× / 4×, reset,
return.

### Interaction and access

- Everything a drag does has a tap and keyboard path: tap an offer to bank it; tap an owned mod (or
  focus it and press Enter) to pick it up, then tap a cell to put its icon cell there — or arrows to
  move it, R to rotate, Enter to place, B to bank, S to sell, Escape to cancel. Hovering or focusing
  any mod shows its name, affinity, lane effect, perk and sell price.
- Colour is never the only signal: lanes are labelled, actions carry icons (fist, hammer, shield),
  affinities carry icons (sun, crescent, bolt), tiers carry gems.
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

**Compile is the only bridge from mods to combat.** `compileBuild(grid)` returns plain numbers: each
lane's power, each affinity's level, the bonus damage per action, the Arc surge, bonus health, parry
healing and the run perks. The game layer turns that into a `CombatSide`: the fighter definition with
its maximum health and its parry's heal, and a bonus per action that the adapter attaches when it
commits a move. The kernel still only ever hears move names.

**Kernel additions, both generic and sealed:** a move command may carry an integer damage bonus that
every hit of that move — and the counter its parry starts — adds; and a parry may heal its owner. The
kernel never learns what a mod, a lane, an affinity or a round is.

**Determinism.** One integer PRNG, seeded per purpose: every draw is keyed by the run seed, a purpose
and its indices — `shop / day / reroll`, `opponent / day` — so rerolling the shop can never shift
tomorrow's opponent, and nothing depends on the order things were generated in. The fight itself has
no randomness at all.

**Persistence.** The run autosaves to `localStorage` after every change, as a versioned document:
`{ version: 1, run, fight }`, where `fight` holds the player's Mixup decisions in the fight in progress.
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
- Rotating a placed mod succeeds exactly when the rotated placement is legal, for every mod, rotation,
  position and neighbour.
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
- Merging duplicates into levels.
- Fighter selection.
- Mods that change hitstun.
- Round-start or round-end healing.
- A bundled pixel typeface: the UI uses the platform's rounded face until one is fetched and
  licensed into the tree.
