# Mix Up — Mods

**Status: built.** This is the contract for the live 64-mod system. A mod is **type + optional
affinity + shape + effect**. Placement and orthogonal adjacency are the build language; the combat
kernel still decides every exchange. [`RUN_DESIGN.md`](RUN_DESIGN.md) records the decisions around
the run, [`RUN_PLAN.md`](RUN_PLAN.md) records the slice as built, and
[`AGENTS.md`](../AGENTS.md) is the repository contract.

The retired port, tag, row-lane, material and energy-economy models are not part of the live mod
system.

## Type and affinity

Every definition has exactly one **type** and zero or one **affinity**.

| Type | Piece colour | Status |
| --- | --- | --- |
| Solar | orange | Burn |
| Arc | green | Shock |
| Void | purple | Poison |
| Neutral | slate | none |

Affinity is `Strike`, `Tech`, `Block`, or `null`. An affinity says **when the mod fires**:
Strike on Strike exchanges, Tech on Tech, Block on Block. A mod with no affinity fires every
exchange. Type never implies an action.

Status application follows type, not affinity:

- **Solar → Burn.** At round end, each stack deals 1 damage, then Burn halves, rounding down.
- **Arc → Shock.** Shock is exposure: the next damaging hit adds all stacks as damage and consumes
  all of them. A miss, parry or non-damaging contact consumes none.
- **Void → Poison.** At round end, Poison deals `floor(stacks / 2)` and persists.
- **Neutral.** It can deal damage, heal, boost neighbours or change run economy, but applies no
  status.

Strike and Tech status payoffs land only when that move hurts the opponent. Block status payoffs land
when the guard holds. Affinity-less status payoffs land regardless. Cleanses remove the owner's
stacks after the exchange settles. Status damage reaches the kernel as afflictions; Shock reaches it
as exposure.

## The eleven shapes

The board is **4 × 4**. Every shape has one canonical footprint; placement stores a top-left board
coordinate plus rotation in degrees.

| Shape id | Cells | Distinct orientations |
| --- | ---: | ---: |
| `tetromino-i` | 4 | 2 |
| `tetromino-o` | 4 | 1 |
| `tetromino-t` | 4 | 4 |
| `tetromino-s` | 4 | 2 |
| `tetromino-z` | 4 | 2 |
| `tetromino-j` | 4 | 4 |
| `tetromino-l` | 4 | 4 |
| `triomino-i` | 3 | 2 |
| `triomino-l` | 3 | 4 |
| `domino` | 2 | 2 |
| `single` | 1 | 1 |

Rotation is stored as `0 | 90 | 180 | 270` and normalised to the first distinct orientation, so an
O or single is always 0°, while I/S/Z, the straight triomino and domino collapse to 0° or 90°.
Turning a carried or placed piece is a clockwise quarter turn about an occupied board cell under the
cursor. The pivot stays fixed. A turn that would leave the board or overlap another piece is refused.
Banked pieces retain their normalised rotation.

## Adjacency

Two placed mods are adjacent when any occupied cell of one shares a **horizontal or vertical edge**
with any occupied cell of the other. Corner contact does not count. Several shared edges are still one
neighbour relationship, though the graph can report the edge count.

The program precomputes for every active mod:

- occupied-cell count;
- adjacent mod uids;
- number of adjacent mods with the same type;
- number with another type;
- boost received for each action.

This graph is the only build-to-build relationship. Rotation matters because adjacency is calculated
from the turned footprint.

## Effect vocabulary

Every one of the 64 definitions contains exactly one `ModEffect`.

```ts
type Per =
  | "flat" | "cell" | "adjacent" | "adjacent-same" | "adjacent-other"
  | "burn" | "shock" | "poison";

type Payoff =
  | { kind: "damage"; amount: Amount }
  | { kind: "heal"; amount: Amount }
  | { kind: "status"; amount: Amount }
  | { kind: "cleanse"; status: Status; amount: Amount };

type Condition =
  | { kind: "adjacent-to"; type: ModType }
  | { kind: "opponent-has"; status: Status };

type ModEffect =
  | { kind: "exchange"; payoffs: readonly Payoff[]; when?: Condition }
  | { kind: "boost"; amount: Scaled; to: "adjacent" | "adjacent-same" }
  | { kind: "perk"; perk: "income" | "free-reroll" | "style"; amount: Scaled };
```

An amount is a `[★, ★★, ★★★]` value multiplied by its `per` scale. Status scales read the
opponent's current stacks. A boost adds its star-scaled amount to each eligible adjacent mod's
amounts on the exchanges where the booster fires. Perks affect payday income, free rerolls or style
payouts and never touch exchange resolution.

`compileBuild(grid)` returns the program, an unconditional damage preview for Strike/Tech/Block,
and the run perks. The preview is informational; combat still resolves through the program and the
kernel.

## Rarity ladder

Rarity is fixed by the definition. It sets price, shop odds and which vocabulary a mod may use; it is
not an upgrade level.

| Rarity | Price | Scales | Conditions | Additional vocabulary |
| --- | ---: | --- | --- | --- |
| Common | $3 | `flat`, `cell` | — | one payoff |
| Uncommon | $4 | + `adjacent` | — | up to two payoffs; `cleanse` |
| Rare | $5 | + `adjacent-same`, `adjacent-other` | `adjacent-to` | — |
| Super Rare | $7 | + status-stack scales | + `opponent-has` | — |
| Legendary | $8 | all | all | `boost`; build-defining combinations |

Neutral affinity-less `perk` effects may appear at any rarity. The validator enforces the ladder.

## Stars

Stars are the upgrade level and nothing else.

| Level | Made from | ★ copies inside |
| --- | --- | ---: |
| ★ | bought copy | 1 |
| ★★ | 3 × ★ | 3 |
| ★★★ | 2 × ★★ | 6 |

Buying a copy that completes a recipe combines automatically. The oldest copy survives in place and
keeps its rotation. Every definition has at least one scaled value that grows from ★ to ★★ to ★★★.
Stars are neutral pips in the UI; rarity colour never paints them.

## The 64-mod catalogue

The registry contains exactly 64 definitions: 16 of each type and 16 of each affinity bucket
(None, Strike, Tech, Block), with four mods in every type × affinity pair. Catalogue order is type,
then affinity, then rarity.

The size split is **28 tetromino / 12 triomino / 16 domino / 8 single**. Every type has exactly one
of each tetromino, every tetromino appears four times total, and the triominoes split six straight /
six L. Rarity counts are **16 Common / 16 Uncommon / 16 Rare / 8 Super Rare / 8 Legendary**.

| Solar | Common | Uncommon | Rare | Top | | Arc | Common | Uncommon | Rare | Top |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| None | D2 | M1 | I3 | I4 · SR | | None | D2 | M1 | L3 | I4 · Leg |
| Strike | D2 | D2 | M1 | S4 · Leg | | Strike | D2 | D2 | M1 | Z4 · SR |
| Tech | I3 | L3 | L4 | Z4 · Leg | | Tech | I3 | L3 | J4 | S4 · Leg |
| Block | O4 | J4 | D2 | T4 · SR | | Block | O4 | T4 | D2 | L4 · SR |

| Void | Common | Uncommon | Rare | Top | | Neutral | Common | Uncommon | Rare | Top |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| None | D2 | M1 | I3 | S4 · SR | | None | D2 | M1 | L3 | I4 · Leg |
| Strike | D2 | D2 | M1 | Z4 · Leg | | Strike | D2 | D2 | M1 | L4 · SR |
| Tech | I3 | L3 | T4 | J4 · SR | | Tech | I3 | L3 | J4 | Z4 · SR |
| Block | O4 | L4 | D2 | I4 · Leg | | Block | O4 | T4 | D2 | S4 · Leg |

Legend: M1 single, D2 domino, I3/L3 triominoes, and I4/O4/T4/S4/Z4/J4/L4 tetrominoes. `SR`
means Super Rare and `Leg` Legendary.

The validator also requires unique ids, unique names of at most 16 characters, status-by-type,
rarity-vocabulary compliance and star growth.

## Colour

The live palette is one dark-surface system. **Type is dominant**, **action is secondary**, and
**rarity is tertiary**. Statuses reuse their type hue. Rarity colours names and rarity chips only.

| Group | Token | Swatch |
| --- | --- | --- |
| Type | `--mod-solar` | `#ff7a1a` |
| Type | `--mod-arc` | `#18c978` |
| Type | `--mod-void` | `#8b5cf6` |
| Type | `--mod-neutral` | `#b7c3d0` |
| Action | `--action-strike` | `#f43f5e` |
| Action | `--action-tech` | `#eaff5a` |
| Action | `--action-block` | `#3f83f8` |
| Rarity | `--rarity-common` | `#f8fafc` |
| Rarity | `--rarity-uncommon` | `#b8ef72` |
| Rarity | `--rarity-rare` | `#45d6ff` |
| Rarity | `--rarity-super-rare` | `#f27cff` |
| Rarity | `--rarity-legendary` | `#ffc247` |
| Surface | root / panel / card | `#080c12` / `#101722` / `#18212d` |
| Surface | card hover / selected | `#223041` / `#2d4054` |
| Border | subtle / strong | `#344657` / `#5a7087` |
| Border | selected / focus | `#ffcf4a` / `#5ac8ff` |
| Text | primary / secondary / disabled | `#f8fbff` / `#c0ccda` / `#8998a8` |
| Placement | valid / invalid | `#2de38c` / `#ff4f6d` |
| Piece | edge / icon backing / icon outline | `#080c12` / `#09111b` / `#f8fbff` |
| Piece | bevel light / bevel dark | `#ffffff40` / `#00000040` |
| Piece | star on / star off | `#f8fbff` / `#6b7b8e` |

The palette test holds WCAG contrast, all 12 type × affinity icon combinations, and OKLab separation
for the known confusion pairs at **ΔE ≥ 0.13**. The closest required pair is Solar / Strike at 0.140.
Mod UI colour literals live only in the root token block; action and status glyphs use
`currentColor`.

### Action icon rule

A piece carries at most one action icon. When it has an affinity, the icon sits on the **occupied cell
nearest the piece's centroid**. Equal-distance ties resolve top-to-bottom, then left-to-right.

The tasks-024 comparison checked all eleven shapes at card and board size. The centroid-cell rule won
because the backing disc stays on one solid type-coloured cell instead of straddling seams or shape
junctions. Cards, detail previews, board pieces, bank pieces and offers all use the same anchor rule.

## Catalogue UI

The Armory renders the same registry combat uses: a four-column grid and a selected detail pane.
Cards show the shape in its type colour, at most one affinity icon, the name in its rarity colour and
three small collection pips.

The filter modal has four groups: **Type, Action (including None), Size (1–4), Rarity**. Choices are
OR within a group and AND across groups; Clear empties every group. The selected detail can preview
★ / ★★ / ★★★ and turn through the shape's distinct orientations.

## Architecture

- `src/mods/catalogue.ts` authors the 64 definitions.
- `src/mods/registry.ts` is the one runtime registry. A definition is
  `{ id, name, rarity, type, affinity, shape, effect }`.
- `shapes.ts`, `grid.ts` and `adjacency.ts` own geometry, legal placement and the adjacency graph.
- `program.ts` compiles placed geometry into active mods and adjacency counts.
- `compile.ts` exposes the program, static action previews and run perks.
- `effectresolve.ts` resolves vocabulary contributions; `resolve.ts` owns only Burn, Shock and
  Poison state around the kernel.
- `src/game/modded.ts` is where the mod engine meets the battle arena.
- `src/mods/armory.ts` is the pure catalogue filter model.

The kernel knows none of these concepts. It receives only move bonuses, parry healing, exposure and
afflictions, preserving C9.
