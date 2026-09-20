# Mix Up — mod catalogue simplification, 64-mod rebuild and heavy colour pass

**Status: planned.** `tasks-001` (the audit, §4) and `tasks-002` (the decisions, §3) are done. This is the plan for the next pass over
Mix Up's mods — the game in this repository, FightLab. [`AGENTS.md`](AGENTS.md) is the contract every
task is held to; [`docs/RUN_PLAN.md`](docs/RUN_PLAN.md) records what is built and measured today;
[`docs/MODS.md`](docs/MODS.md) describes the mod system this pass replaces.

The pass takes the mods toward the philosophy of Batomon's collection screen: visual first, minimal
text, a strong colour language, a clean collection grid, and details shown on selection instead of
repeated on every card. It makes **type + shape + action + placement** the whole language of a mod. A
player should read a card as *a purple L-shaped piece with a red Strike icon*, never as
*Void / Strike / x4 / Legendary / Port A+B / Consumer / Tier 2*.

The Batomon references (collection grid; filter modal) are the target for information density,
hierarchy, filtering, the selected-item pane and readability — not something to copy literally.

## 1. How to work this plan

- **GitHub is the working copy and remote `main` is authoritative.** Do not assume or require a
  checkout at `~/Documents/GitHub/FightLab`, a local worktree, a later push, or any other state that
  exists only on one machine. Start every task by re-reading current remote `main`, `AGENTS.md`,
  this plan and the task's prerequisites, then create its remote branch from that exact `main`.
- Every task has an id, `tasks-NNN`. Work happens on a small remote branch (normally
  `tasks-NNN`, or the task's explicitly named branch), in small commits whose body contains the task
  id. Open a pull request to `main`, merge it remotely once its gates are satisfied, then delete the
  remote branch. **There is no separate push step.**
- **Branch/commit/merge is the workflow.** `push` is only transport. A task that says "don't push" still creates its branch, commits, verifies, merges, and deletes the branch; never stop or skip the lifecycle because pushing is unavailable or forbidden.
- **Remote verification is a hard prerequisite for implementation work.** `npm run verify` remains
  the canonical executable gate. FightLab keeps `boneyard: file:../Boneyard`; the remote source for
  that sibling is `SouthernGentlemen/Boneyard`, and `boneyard.pin.json` names the exact commit and
  digest FightLab accepts. CI checks out FightLab and that exact Boneyard commit as sibling
  directories, gives the private Boneyard checkout a credential with read access, installs FightLab,
  and runs `npm run verify`. If the remote verify workflow is absent when an implementation task
  starts, add that workflow first on its own remote ops change. No implementation branch merges until
  the remote verify check is green.
- A task lists the files it touches, what it deletes and when it is done. Done always includes the
  tests the task names. A task that changes what is drawn also needs **remote** visual evidence at
  1920 × 1080 (`AGENTS.md`: verify visually), from a GitHub-hosted preview, artifact or equivalent
  remote browser target. If no remote preview exists, the visual task stops before merge rather than
  silently falling back to a local machine.
- Task prompts must describe the remote workflow above. Do not instruct an agent to `git pull`,
  work in a Mac path, use a local worktree, "don't push", or fast-forward a local branch. The remote
  branch, its commits, pull request, checks and merge are the work.
- Tasks run in order within a pass, and passes run in order, unless a task says it can move. A task
  gated by a decision in §3 waits for that decision.
- Write files in pieces of about 250 lines at most and extend them with edits.
- Delete rather than deprecate. Git keeps the old implementation, so leave no dead UI, no optional
  `ports?` field and no second model kept "for later". A short-lived bridge inside a pass is fine
  when the task that removes it is named.
- When a task lands, mark it `done` in §11.
- References: a bare §N is a section of this plan. "Spec §N" is a section of the brief this plan
  answers (its 45 numbered sections), and "Cn" is a contract in `AGENTS.md`.

## 2. What finished looks like

1. The Armory is a clean **mod catalogue** of exactly 64 mods in a four-column grid. A card is a
   large shape in its type colour, at most one action icon, and the name in its rarity colour.
2. Selecting a card fills a large detail pane with the name, the big shape, the icon, the ★ level and
   a few lines of rules.
3. `FILTER: NONE` opens a compact modal with Type, Action, Rarity and Clear.
4. Mods interact only through orthogonal adjacency. Ports, links and the Heat / Charge / Void
   economy are gone from code, data, UI, tests and docs.
5. Each of the 11 shape families is one canonical footprint. Rotation belongs to the placed mod and
   is normalised to the shape's distinct orientations. Left click picks up and places; right click or
   R turns the piece about the cursor.
6. One semantic colour system — type over action over rarity — lives in tokens. A palette test holds
   its contrast and separation.
7. A catalogue validator holds the 64-mod balance. Rotation and adjacency have their own tests, and
   the catalogue UI has DOM tests.
8. Buy, place, move, rotate, bank, sell, save, load, fight, the catalogue and its filters all run on
   the new model, and the screens hold up at 1920 × 1080, 2560 × 1440 and 3840 × 2160.

## 3. Decisions — confirmed

The spec settles most questions. These are the ones the code raised, each with the recommendation
the tasks are written against. D1 is done, and Jacob confirmed D2–D11 on 2026-09-18. `tasks-002`
is complete; no decision gate remains open.

**D1 — done: the run's plan moved to [`docs/RUN_PLAN.md`](docs/RUN_PLAN.md).** This Mac's filesystem
is case-insensitive, so `implementation_plan.md` *is* `IMPLEMENTATION_PLAN.md`. Writing this file in
place would have overwritten the record that `AGENTS.md` links to (C1's Boneyard contract, C4's
animation mapping). It was moved with `git mv`, and every link was repointed. *To undo:* move it
back and fold this plan into it as a section.

**D2 — confirmed: the board is 4 × 4, and the row lanes retire.** *Jacob, 2026-09-18. Unblocks
tasks-031 and tasks-032.* A 3 × 3 board cannot hold an I-tetromino in either orientation; a square
board has a place for every orientation of every piece.
- Four rows cannot carry three action lanes. Those are: row = Strike / Tech / Block, the row tints,
  attunement, +1 lane power per elemental cell, and Amplifier's lane boost.
- The lanes were also a second action system beside the new affinity icon, and a fourth use of the
  action colours on screen.
- Per-cell power moves into the mods themselves: the spec's *occupied cell count*.

**D3 — confirmed: the Heat / Charge / Void economy retires now.** *Jacob, 2026-09-18. Gates tasks-040.* That means the pools,
Charge capacity and the `generate`, `leech`, `convert`, `spend`, `sink`, `refund`, `accrue` and
`capacity` effects, plus `LINK_BONUS`. Burn, Shock and Poison stay as **statuses**, and the kernel's
generic hooks (damage bonus, parry heal, exposure, afflictions) stay exactly as they are. The spec
defers the energy economy and names heat generation, capacity, batteries, routing and Void leeching as
fields to retire — which is today's engine. *Instead:* keeping the engine and hiding it from the UI
leaves a second model beside the new one, which the spec rules out.

**D4 — confirmed: one type per mod; the status follows the type.** *Jacob, 2026-09-18. Gates
tasks-003 and tasks-029.* Affinity is optional, and Neutral may carry one. A mod that applies a
status applies its type's: Solar → Burn, Arc → Shock, Void → Poison. Neutral applies none. The two
hybrids (`black-battery` VOID / ARC and `heat-death` VOID / SOLAR) retire. This gives each type a
mechanical meaning without energy. *Instead:* any status on any type.

**D5 — confirmed: rarity materials retire.** *Jacob, 2026-09-18. Gates tasks-006 and tasks-016.* Iron, Bronze, Silver, Gold and
Diamond — the star colours, the gem badge on every piece and the tile's colour band — go. Rarity is
the colour of the name, plus labelled chips in the filter and the accessible label. Stars become
neutral pips. Prices by rarity are unchanged. *Instead:* keep materials on the stars only.

**D6 — confirmed: mod surfaces go dark, including the board and bank.** *Jacob, 2026-09-18; board/bank settled by the tasks-021
1920 × 1080 screenshots on 2026-09-19. Gates tasks-016 and tasks-021.* That covers the whole catalogue,
and in Prep the bank slots, board, shop offers and mod tooltip. The screenshot keeps the board and bank
dark too: the saturated piece colours stay dominant and the empty placement surfaces recede instead of
competing with them. Title, Fight and Payday keep their look. The rarity colours the spec asks for
(near-white, mint, cyan, gold) cannot reach 4.5 : 1 on today's white paper. *Instead:* keep paper
and darken the rarity colours, which then read as muddy and crowd the type colours.

**D7 — confirmed: a fresh registry of 64 with new ids; save version 4 discards older saves.** *Jacob, 2026-09-18. Gates tasks-039 and
tasks-040.* This follows C11's precedent from version 2. The hand-written `description` and
`visual.glyph` retire: rules text is generated from the effect, and the icon comes from the
affinity. Only a handful of concepts survive (Piggy Bank, Coupon, Crowd Pleaser, Amplifier), and they
may keep their names. *Instead:* migrate old ids, which would then name different mods.

**D8 — confirmed: three filter groups — Type, Action (including None) and Rarity.** *Jacob,
2026-09-18. Gates tasks-027.* There is no Size filter. Choices within a group combine with OR,
groups with AND, and Clear empties all of them. Text search and "owned only" go.

**D9 — confirmed: rotation in degrees, turned about the cursor.** *Jacob, 2026-09-18. Gates tasks-011 to tasks-013.* Rotation is
stored as 0 / 90 / 180 / 270 on the placed mod and normalised to the piece's distinct orientations. A
held piece turns about the cell under the cursor. The mouse wheel stops rotating; right click and R
remain. Today rotation is a quarter-turn index and turns about the top-left of the bounding box, and
the wheel turns too. *Instead:* keep quarter turns internally.

**D10 — confirmed: catalogue UI tests run in happy-dom.** *Jacob, 2026-09-18. Gates tasks-042.* `happy-dom` becomes a dev-only
dependency, used per file through `// @vitest-environment happy-dom`. The spec asks for render,
selection and filter tests (spec §41), and Vitest runs in Node with no DOM today. *Instead:* test pure
view models only, and leave the rest to screenshots.

**D11 — confirmed: more weight on the tetrominoes.** *Jacob, 2026-09-18, alongside the 4 × 4 board.
Applies to tasks-033 to tasks-037.* The size split moves from the brief's 24 / 14 / 19 / 7 to
**28 / 12 / 16 / 8**.
- On a 4 × 4 board a tetromino covers a quarter of the board, not almost half as on 3 × 3, so the
  catalogue can carry more of them.
- 28 gives every type exactly one of each of the seven tetrominoes, so each tetromino appears four
  times.
- The triominoes stay an even split, 6 straight and 6 L.
- Singles go to 8, the number the brief first asked for.

"Weight" here means how many there are — how often tetrominoes turn up in the shop — not how strong
they are. Power per shape stays with §6.4's budget. The extra tetrominoes sit at Super Rare, so they
show up from day 5: see §6.1.

## 4. Audit — what is authoritative today, and every consumer of the old model (tasks-001)

Line numbers are as of `7eeded9`.

### 4.1 Authorities

| Concern | Authority today | Notes |
| --- | --- | --- |
| Mod records | `src/mods/registry.ts` `LIST`: 29 frozen records (id, name, description, rarity, tags, shape, ports, effects, `visual.glyph`) | Everything reads `REGISTRY`, `MOD_IDS` and `DEFINITIONS`; `registryProblems` validates |
| Type | `src/mods/tags.ts`: one or two tags from the elements (solar, arc, void, neutral) and the actions (strike, tech, block) | Two hybrids in the data |
| Shapes | `src/mods/shapes.ts`: `mono`, `duo`, `i3`, `l3`, `o4`, `t4`, `l4` as `[x, y]` tuples; quarter turns 0–3 that keep cell order | `l4` is the standard **J** (`X.. / XXX`). There is no I, S, Z or standard L tetromino |
| Board | `src/mods/grid.ts`: `GRID_SIZE = 3`; rows are the Strike / Tech / Block lanes; a bank of 4; rotate in place about the bounding box's top-left; `firstFit` | |
| Ports | `src/mods/ports.ts` and the `ports` list on every record | A link is an out-port facing a matching in-port |
| Effects and engine | `effects.ts` (12 kinds); `resolve.ts` (Heat, Charge with capacity, Void; Burn, Shock, Poison); `program.ts` (links); `balance.ts` | Run around the kernel by `src/game/modded.ts` |
| Build to combat | `compile.ts` (`lanes`, `attuned`, `program`, `capacity`, run perks) into `game/sides.ts` (static `bonus` = the lanes) | |
| Rarity and stars | `rarity.ts` (5 rarities, each with a material and a price of $3 / 4 / 5 / 7 / 8); `stars.ts` (★ recipes) | |
| Rules text | `describe.ts` (effect lines, port line, the number table, the resource profile) | |
| Catalogue | `src/mods/armory.ts` (filter by element, action, rarity, owned, text); `src/run/collection.ts` (a seeded development collection) | |
| Colour | `src/ui/styles.css` `:root` (type, action, material and kit tokens) plus about 32 literals elsewhere; `src/ui/icons.ts` (21 literal fills) | |
| Persistence | `src/run/save.ts`, version 2: `rotation` 0–3; every placement replayed through `place` | |

### 4.2 Consumers, by concept

**Ports and links.** Delete them (tasks-005, tasks-015).
- Model and data: `src/mods/ports.ts` (all); `effects.ts:1,70-71` (`out`, `into`); `registry.ts:7-8,33,48,51`, the port list on every entry (`56-110`), and port validation (`156-158,165`).
- Engine: `program.ts:1-2,27-32,44,51-53` (`feeds`, `linked`, `links`); `resolve.ts:2,77,126,173` (the link bonus, `perLink`, `refund`); `balance.ts:19-20` (`LINK_BONUS`).
- Text: `describe.ts:1,33,38,63-70` (`portLine`, the per-link and refund sentences).
- UI: `kit.ts:6,57-61,75-77` (the port pills in `modArt`); `armorycard.ts:1,45-51,59,93-95` (the ports panel, Rotate, "Orientation 90°"); `prep.ts:12,635` (the tooltip); `styles.css:538-548` (`.port`) and `602-608,652` (`.card__ports`, `.card__piece`, `.card__portinfo`).
- Tests: `tests/mods/model.test.ts:3-4,86-115`; `registry.test.ts:51,65`; `describe.test.ts:3,29-34`; `sequences.test.ts:4,21,37,77-101`; `compile.test.ts:73-78`; `tests/combat/mods-never-decide.test.ts:72`.

**Two tags and the diagonal split.** Replace them with `type` + `affinity` (tasks-003, tasks-004).
- Model: `src/mods/tags.ts` (all: `ModTags`, `MAX_TAGS`, `tagProblem`, `elementsOf`, `actionOf`, `tagLine`, `tileFill`).
- Readers: `registry.ts:13-14,23,31,47,50-51,150-151,164-166`; `compile.ts:10-11,22,34-35,57,61`; `resolve.ts:8,88-97`; `describe.ts:7,48-60,89`; `mods/armory.ts:6,28-39`; `run/opponents.ts:10,115,129,152`; `pipelines/tune.ts:95`; `ui/prep.ts:15-16,76-80,238-239,272,276,629-632,652`; `ui/kit.ts:15-16,33-55,67-72`; `ui/modtile.ts:5,7,14-16,29,34`; `ui/armorycard.ts:10,81`; `ui/armory.ts:10-11,15,50-51`.
- CSS: `styles.css:140-143` (`[data-affinity]` sets `--mc`); `516-526` and `561-572` (the `--c1` / `--c2` split, `.square`, `.tagchip`); `239,242,319,340` (users of `--mc`).
- Tests: `model.test.ts:7,13-45`; `registry.test.ts:8,30,33,57-58,70-74,82`; `armory.test.ts:31,36`; `opponents.test.ts:90`.

**The energy economy.** Retire it (D3): the UI in tasks-007, the model in tasks-040.
- Engine: `resolve.ts` (`ModState.heat`, `charge`, `capacity`, `voidCharge`; `FIELD`, `room`, `add`; steps 1–3; the vent and accrue in `endRound`; `staticTotal("capacity")`); `effects.ts:24-61`; `balance.ts:16-17,43-46`; `registry.ts:130-142,165-166` (a resource must match an element); `compile.ts:25-26,72`.
- Text and UI: `describe.ts:14,33-45,92-138` (resource sentences, `profileOf`); `armorycard.ts:18-22,86-92` (the "makes … spends …" line); `prep.ts:76-80` (element identity), `108,238-239` (the element counters) and `249` ("Charge holds N"); `ui/fight.ts:51-54,348-349` (the debug readout).
- Tests: nearly all of `tests/mods/resolve.test.ts` and `sequences.test.ts`; `compile.test.ts:3,30,79`; `armory.test.ts:70-71`; `mods-never-decide.test.ts:40,50`; `tests/game/mods-in-combat.test.ts`, whose fixtures are Heat Coil, Cinder Edge, Void Tap and Venom Tap.

**Row lanes and attunement.** Retire them (D2, tasks-031).
- Code: `grid.ts:11-12` (`LANES`); `compile.ts:2-3,18-22,38-66` (`lanes`, `attuned`, `boostOn`); `balance.ts:22-24`; `effects.ts:41-42` and Amplifier (`lane-boost`); `game/sides.ts:14-16,25-29` (the static `bonus` from lanes, `hitDamage`).
- UI: `prep.ts:6,107-120,232-237,636,641-649` (the lane column and its tooltips); `styles.css:243-263` (`.lanes`, `.lane*`, the `.cell[data-y]` tints) and `480-484` (the run-end tints).
- Run: `run/opponents.ts:101-140` (`laneWeights`, lane scoring).
- Tests: `grid.test.ts:61-62`; `compile.test.ts:27-70`; `opponents.test.ts:98-99`.

**Shapes, rotation and the 3 × 3 board.** Rebuild them (tasks-008 to tasks-013, tasks-032).
- Model: `shapes.ts` (all); `grid.ts:8,38-44,80-99` (`GRID_SIZE`, `onBoard`, `rotateInPlace` about the top-left, `firstFit`).
- Run and save: `run/run.ts:87,243,258-270` (rotation travels with a move; rotate in the bank or in place); `save.ts:9,112-114,117-128` (rotation 0–3; placements replayed).
- UI: `kit.ts:63-82` (`modArt`); `prep.ts:50-73,283-341,345-408,511-586` (drag and carry, the anchor as a cell index, wheel, right click, R); `runend.ts:3,23-27`; `armorycard.ts:5-6,31,48-51`.
- Opponents and the bot: `opponents.ts:13,118-121`; `pipelines/tune.ts:21,96-97`.
- Tests: `grid.test.ts` (shapes, turns, exhaustive rotate-in-place); `mods-never-decide.test.ts:13-31`; `run.test.ts:129`; `save.test.ts:87`; and the `[mod, x, y, rotation]` helpers in `compile.test.ts:14`, `mods-in-combat.test.ts:17` and `tests/mods/programs.ts:13`.

**Rarity materials, gems and star colours.** Retire them (D5; tasks-006, tasks-016).
- Code: `rarity.ts:10-11,28-39` (`MATERIALS`, `MATERIAL_LABEL`, `rarityLine`); `kit.ts:38-41` (`starRow` in the material).
- CSS: `styles.css:35-39` (`--iron` … `--diamond`), `168-175` (`.gem`), `528-535` (stars), `582,592,616,631` (card band, star buttons, tile band) and `297` (odds gems).
- UI: `prep.ts:213-214,253-254`; `ui/armory.ts:55`; `armorycard.ts:62-66,76-80`; `modtile.ts:23,28,32`.

**Hard-coded colour.** Tokenise it (tasks-016 to tasks-021).
- `styles.css`: the tokens are at `12-39`. The mod UI's own literals go to tokens: `#fff4cc` ×3, `#fff7d6` ×2, `#fffbe8`, `#eef2f4`, `#c9f2cf`, `#ffd0d5`, `#dfe7ea`. The fight, arena and debug literals are out of scope (§10).
- `icons.ts`: `INK` and 20 literal fills. The action and status glyphs move to `currentColor` and tokens.

**The Armory screen.** Rebuild it (tasks-022 to tasks-028).
- `src/ui/armory.ts`, `armorycard.ts` and `modtile.ts` (all); `src/mods/armory.ts` (the filter model); `main.ts:54-56`; `tests/mods/armory.test.ts`.
- `src/run/collection.ts` stays as it is.

**Saves and the run.** They follow the model (tasks-011, tasks-039).
- `save.ts:22-23` (`SAVE_VERSION` goes 2 → 3 → 4); `shop.ts:29` (by-rarity pools, which follow automatically).
- `opponents.ts:152` and `tune.ts:95`: "never buys Neutral" becomes "never buys a mod that only pays the run".

**Docs.** Rewrite them in tasks-048:
- `README.md`: the pitch mentions ports, Heat / Charge / Void and Iron → Diamond.
- `AGENTS.md`: layer 2, C4's tags, C9's property test, C11's version, Layout.
- `docs/MODS.md`: all of it.
- `docs/RUN_DESIGN.md`: the decision rows.
- `docs/RUN_PLAN.md`: Status, *Mods and compile*, *Screens*, the testing table, *Measured*.

### 4.3 Spec terms with no counterpart in the code

There is nothing to delete for these. Each gets a guard in tasks-049 so it never appears:

- **x1 / x2 / x3 / x4.** No size label exists. The only `×N` on a mod is the owned-copies count on
  Armory tiles (`modtile.ts:32`), which reads exactly like one. It goes in `tasks-006`.
- **`northPort`, `energyInput`, `heatGeneration`, `batteryCapacity`, `routingDirection`,
  `blockCountLabel`, `sizeMultiplier`.** None of these names exist. Their real equivalents are
  `ports: Port[]` and the effect kinds listed under *The energy economy*.
- **T1 / T2 / T3.** Already gone: stars are ★ / ★★ / ★★★ (`stars.ts`).
- **The 52-mod target.** It is not in the repository. The registry has 29 mods: 11 single, 8 domino,
  1 straight triomino, 6 L triomino, and one each of O, T and J (named `l4`) tetromino.

## 5. The target model

A sketch of the types the tasks build toward. Names may shift in review, but the concepts may not.

**Shapes** (`src/mods/shapes.ts`). Eleven canonical footprints, authored once, lying flat, with x
running right and y running down. There is no flipping, so J and L stay different pieces.

```text
tetromino-i  ####     tetromino-o  ##    tetromino-t  ###    tetromino-s  .##    tetromino-z  ##.
                                   ##                 .#.                 ##.                 .##
tetromino-j  #..      tetromino-l  ..#   triomino-i   ###    triomino-l   ##     domino  ##   single  #
             ###                   ###                                    #.
```

```ts
interface GridPoint { readonly x: number; readonly y: number }
type ShapeId = "tetromino-i" | "tetromino-o" | "tetromino-t" | "tetromino-s" | "tetromino-z"
  | "tetromino-j" | "tetromino-l" | "triomino-i" | "triomino-l" | "domino" | "single";
interface ModShape { readonly id: ShapeId; readonly cells: readonly GridPoint[] }  // min x = min y = 0
type Rotation = 0 | 90 | 180 | 270;
orientations(shape): readonly { rotation: Rotation; cells: readonly GridPoint[] }[]  // distinct only
normaliseRotation(shape, rotation): Rotation   // an O is always 0; I, S, Z, straight triomino, domino: 0 or 90
turnAbout(placement, pivot: GridPoint): Placement  // a quarter turn clockwise; the pivot cell stays put
```

The distinct orientations are O 1, I 2, S 2, Z 2, T 4, J 4, L 4, straight triomino 2, L triomino 4,
domino 2 and single 1 — 28 in all. A 4 × 4 board holds every one of them. A 3 × 3 board holds
neither orientation of the I, and a board of three rows holds only the flat I. A throwaway script
checked both facts while this plan was written; tasks-010 and tasks-032 make them tests.

**Placed mods** (`src/mods/grid.ts`). The spec's `EquippedMod` is `PlacedMod`. `uid` and `stars`
stay: two copies of a mod can sit on the board, and stars belong to the copy.

```ts
interface OwnedMod { readonly uid: number; readonly mod: ModId; readonly stars: Stars; readonly rotation: Rotation }
interface PlacedMod extends OwnedMod { readonly x: number; readonly y: number }  // top-left of the turned footprint
const BOARD_WIDTH = 4, BOARD_HEIGHT = 4;
```

**Adjacency** (`src/mods/adjacency.ts`). Pure, and it knows nothing of energy, types or effects.

```ts
occupiedCells(placed: PlacedMod): readonly GridPoint[]    // after rotation
sharedEdges(a: PlacedMod, b: PlacedMod): number           // edge contacts between their cells
areAdjacent(a: PlacedMod, b: PlacedMod): boolean          // sharedEdges > 0; a corner never counts
adjacencyGraph(grid: Grid): { neighbours(uid: number): readonly number[]; edges(a: number, b: number): number }
getAdjacentMods(graph, uid): readonly number[]
```

**Definitions** (`src/mods/registry.ts`). There is no orientation, no port, no resource, no
hand-written description and no glyph.

```ts
type ModType = "solar" | "arc" | "void" | "neutral";
interface ModDefinition {
  readonly id: string; readonly name: string; readonly rarity: Rarity;
  readonly type: ModType; readonly affinity: ActionType | null;
  readonly shape: ModShape; readonly effect: ModEffect;
}
```

**The effect vocabulary** (`src/mods/effects.ts`). This is all of it; each of the 64 mods is one
`ModEffect`.

```ts
type Status = "burn" | "shock" | "poison";                 // Solar, Arc, Void; Neutral has none
type Per = "flat" | "cell" | "adjacent" | "adjacent-same" | "adjacent-other" | Status;  // a Status: the opponent's stacks
interface Amount { readonly value: Scaled; readonly per: Per }  // Scaled: the value at ★, ★★, ★★★
type Payoff =
  | { kind: "damage"; amount: Amount }                     // on this exchange's move; Block's goes to the riposte
  | { kind: "heal"; amount: Amount }                       // on this exchange's parry
  | { kind: "status"; amount: Amount }                     // the mod type's status, on the opponent
  | { kind: "cleanse"; status: Status; amount: Amount };   // off its own fighter
type Condition = { kind: "adjacent-to"; type: ModType } | { kind: "opponent-has"; status: Status };
type ModEffect =
  | { kind: "exchange"; payoffs: readonly Payoff[]; when?: Condition }  // on its affinity, or every exchange
  | { kind: "boost"; amount: Scaled; to: "adjacent" | "adjacent-same" } // adds to adjacent mods' amounts
  | { kind: "perk"; perk: "income" | "free-reroll" | "style"; amount: Scaled };  // the run
```

The firing and landing rules stay as they are:

- A mod with an affinity fires when its fighter plays that action; one without fires every exchange.
- `boost` follows the same rule. In the exchanges where its own mod fires, it adds its amount to each
  adjacent (or adjacent same-type) mod's amounts. For a mod with no affinity, that is every exchange.
- A Strike or Tech mod's statuses land if the move hurt the opponent. A Block mod's land if the guard
  held. An affinity-less mod's land regardless.
- Burn, Shock and Poison keep their rules and numbers (`balance.ts`) and reach the kernel as today,
  through exposure and afflictions. C9 is untouched.
- `ModState` becomes `{ burn, shock, poison }`.
- `compileBuild` returns `{ program, preview, income, freeRerolls, styleMultiplier }`. `preview` is
  each action's unconditional damage, which is static on a placed board; it is shown on the bar slots.

## 6. The 64-mod catalogue

### 6.1 Slot matrix (proposed)

The validator (tasks-033) enforces the counts; this layout is one arrangement that satisfies all of
them, checked by script. Columns are the rarity tiers. *Top* is Super Rare (SR) or Legendary (Leg).
`I4 O4 T4 S4 Z4 J4 L4` are the tetrominoes, `I3` and `L3` the triominoes, `D2` the domino and `M1` the
single.

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

What the arrangement satisfies:

- **Counts.** 64 mods. 16 per type, per affinity (None included) and per tier. 4 in every type ×
  affinity pair.
- **Sizes and shapes.** 28 / 12 / 16 / 8 by size (D11).
  - Every type holds exactly one each of I, O, T, S, Z, J and L, so each tetromino appears four times.
  - Every type has the same size profile: 7 tetrominoes, 3 triominoes, 4 dominoes and 2 singles.
  - The triominoes are 6 straight and 6 L.
- **Rarity.** Common 16, Uncommon 16, Rare 16, Super Rare 8, Legendary 8, with every type holding
  2 SR and 2 Leg.

It also carries some intent, which tuning may reshuffle inside the counts:

- **Top tier.** Every Super Rare and every Legendary is a tetromino, and every Legendary is one of the
  three most awkward: I, S or Z.
- **Lower tiers.** Each type's Common tetromino is its O, and it has one more tetromino at Uncommon and
  one at Rare.
- **Shop.** Tetrominoes are about a quarter of offers on days 1–4, as before. On days 5–7 they are 36%
  (was 30%), and from day 8 51% (was 39%).
- **Leans.** Strike leans small (36 cells across its 16 mods) and None light (40). Tech and Block
  carry the big pieces (56 each).
- **Singles.** They appear only at Uncommon and Rare, never Common: they are geometrically strong and
  should feel it.
- **Neutral / None / Legendary.** This is the I-tetromino slot: Amplifier's successor, a `boost` aura
  running along a whole row or column. Its three lower slots (D2, M1, L3) hold the run perks.

### 6.2 Order

The catalogue lists by type (Solar, Arc, Void, Neutral), then affinity (None, Strike, Tech, Block),
then rarity. With four columns, each row of the unfiltered grid is one fundamental combination,
Common to Top from left to right. `MOD_IDS` follows the same order.

### 6.3 Rarity ladder

This sets what each rarity may use, and the validator enforces it. Higher rarity means stranger
behaviour, not bigger numbers.

| Rarity | Scales | Conditions | Also |
| --- | --- | --- | --- |
| Common | `flat`, `cell` | — | one payoff |
| Uncommon | + `adjacent` | — | up to two payoffs; `cleanse` |
| Rare | + `adjacent-same`, `adjacent-other` | `adjacent-to` | |
| Super Rare | + a status (per opponent stack) | + `opponent-has` | |
| Legendary | all | all | `boost`; build-defining combinations |

`perk` effects (Neutral without an affinity) may appear at any rarity.

### 6.4 Shape budget (provisional)

At ★, a mod's budget in points is its price — Common 3, Uncommon 4, Rare 5, Super Rare 7,
Legendary 8 — times a shape factor. A point is one damage, one heal or one status stack.

| Shape | Factor |
| --- | --- |
| single | 0.7 |
| domino | 0.85 |
| triomino (either) | 1.0 |
| O | 1.1 |
| T, J, L | 1.2 |
| S, Z, I | 1.3 |

Awkward footprints earn more, and convenience is part of the price. A single is never the biggest
number at its rarity. On the 4 × 4 board a tetromino costs less room than it did on 3 × 3, so these
factors may compress once measured. Every mod grows at ★ → ★★ → ★★★. All of these are first guesses for
authoring; `npm run tune` measures them (tasks-046), per `AGENTS.md`'s rule against encoded guesses.

### 6.5 Names

- Unique, and at most 16 characters so a card holds one line at 1920 × 1080.
- No type or rarity word in a name: the colour already says it.
- Surviving concepts may keep their names: Piggy Bank, Coupon, Crowd Pleaser, Amplifier.

## 7. The colour system

### 7.1 Hierarchy

1. **Type — dominant.** Fills every occupied cell: `--mod-solar` (orange), `--mod-arc` (green),
   `--mod-void` (purple), `--mod-neutral` (slate).
2. **Action — secondary.** Only the one icon on a piece, and the filter chips: `--action-strike`
   (red), `--action-tech` (yellow), `--action-block` (blue).
3. **Rarity — tertiary.** Only the name: `--rarity-common` (near-white), `--rarity-uncommon`
   (mint / lime), `--rarity-rare` (cyan), `--rarity-super-rare` (magenta), `--rarity-legendary` (gold).

Statuses reuse their type's hue (`--status-burn: var(--mod-solar)`, and so on). Rarity never touches
a shape, and action never touches a cell's fill.

### 7.2 Tokens

All tokens live in `:root`, the only place a mod-UI colour is written.

- The type, action and rarity tokens from §7.1.
- **Surfaces:** `--surface-root`, `--surface-panel`, `--surface-card`, `--surface-card-hover`,
  `--surface-selected`.
- **Borders:** `--border-subtle`, `--border-strong`, `--border-selected` (the frame and corner
  markers), `--focus-ring`.
- **Text:** `--text-primary`, `--text-secondary`, `--text-disabled`.
- **Placement:** `--placement-valid`, `--placement-invalid`.
- **Piece:** `--cell-edge`, `--cell-bevel-light`, `--cell-bevel-dark`, `--icon-backing`,
  `--icon-outline`, `--star-on`, `--star-off`.

Retired: `--iron` … `--diamond`, `--mc`, `--g`, `--c1`, `--c2`, and the diagonal gradient. Today's
values are the starting point: Solar `#ff8c42`, Arc `#35d07f`, Void `#9b6bff`, Neutral `#aab4bf`,
Strike `#e5484d`, Tech `#f2c94c`, Block `#4c8df6`. Arc already sits close to the kit's `--leaf`, the
green the Uncommon colour would naturally borrow.

### 7.3 Rules the palette test enforces

- **Contrast** (WCAG relative luminance):
  - every rarity name ≥ 4.5 : 1 on `--surface-card`, `--surface-card-hover` and `--surface-selected`;
  - `--text-primary` ≥ 7 : 1 and `--text-secondary` ≥ 4.5 : 1 on every surface, and
    `--text-disabled` ≥ 3 : 1 while still clearly apart from secondary;
  - every type colour ≥ 3 : 1 against `--surface-card`, so Neutral cannot sink into it;
  - each action icon ≥ 3 : 1 against whatever is directly behind it, for all 12 type × action
    pairs;
  - `--border-selected` ≥ 3 : 1 against the card, and clearly apart from the hover border.
- **Separation** (OKLab ΔE at or above a threshold set once and written into the test): Solar ↔ Strike,
  Arc ↔ Uncommon, Void ↔ Super Rare, Tech ↔ Legendary, Solar ↔ Legendary, Block ↔ Rare,
  Neutral ↔ `--surface-card`, and the four types pairwise.
- **No literals:** no hex, `rgb()` or `hsl()` outside `:root` in mod-UI rules (`.catalog*`, `.detail*`,
  `.filter*`, `.mod*`, `.piece*`, `.cell*`, `.slot*`, `.offer*`, `.tip*`), and none in the action and
  status glyphs of `icons.ts`.

### 7.4 Treatments

- **Piece.** Every occupied cell takes its type colour, with a crisp `--cell-edge` outline and one
  bevel, the same for every type. There are no split cells and no half-filled tiles.
- **Action icon.** One per piece: the glyph in its action colour on a small `--icon-backing` disc with
  an `--icon-outline` ring (the spec's "small backing disk"), or the lightest treatment that passes
  all 12 pairs. It is never a badge. Neutral without an affinity has no icon.
- **Selected card.** `--surface-selected`, a strong outer frame, and Batomon-style corner markers in
  `--border-selected`. The type colours are untouched.
- **Hover.** `--surface-card-hover` and a subtle border only.
- **Focus.** `--focus-ring`, distinct from both hover and selection.
- **Disabled** (an unaffordable offer, a sold slot). `--text-disabled` plus a strike-through or
  pattern.
- **Placement.** A valid carry keeps the full type colour, with a thin `--placement-valid` outline.
  An invalid one keeps the shape and colour readable under a hatched `--placement-invalid` overlay and
  outline — never a flat red block.
- **Stars.** `--star-on` / `--star-off` pips, never in a rarity colour.

None of these states is shown by opacity alone.

## 8. Tasks

Each task gives the spec sections it answers, the decision that gates it (§3), the work, and when it
is done. Every implementation task ends green under the **remote** `npm run verify` gate defined in
§1; planning- and documentation-only changes use §1's source-review exception.

### Pass 1 — Audit

#### tasks-001 — Audit the mod system · **done**
*Spec §43 pass 1.* The audit is §4: what is authoritative today, every consumer of the old port,
size, colour, tag, lane and energy model, and the spec terms with no counterpart in the code.

#### tasks-002 — Confirm the decisions · **done**
*Owner: Jacob.* D2–D11 are confirmed in §3. D8 was confirmed with one change from the proposal:
the Armory has no Size filter. All downstream tasks and the task index reflect those decisions.

### Pass 2 — Remove visual clutter

#### tasks-003 — Split tags into type and affinity · **done**
*Spec §4–§6, §33 · D4.*
- Rewrite `src/mods/tags.ts` down to `MOD_TYPES`, `ModType`, `TYPE_LABEL`, `AFFINITY_LABEL` and
  `isModType`.
- `ModDefinition.tags` becomes `type` and `affinity`.
- The hybrids become Void, their first element, as a bridge until tasks-039 deletes them.
- Update every reader under *Two tags* in §4.2.
- Delete `ModTags`, `MAX_TAGS`, `tagProblem`, `isModTags`, `elementsOf`, `actionOf`, `tagLine` and
  `tileFill`.
- Done when no mod code reads `tags`, and the model tests cover `type` and `affinity`.

#### tasks-004 — One type colour per piece, one action icon · **done**
*Spec §5, §20, §30.*
- `modArt` (`kit.ts`) and the Armory square set `data-type` and `data-affinity`, and every cell takes
  the type colour.
- A piece carries at most one action icon, and only when it has an affinity. It sits on the piece's
  first cell as a bridge until tasks-024 decides where it goes. A Neutral mod without an affinity has
  no icon.
- The stars leave that cell for small corner pips.
- Delete the diagonal gradients and `--c1` / `--c2` (`styles.css:516-526,561-566`), `paintTags`, and
  the per-mod glyph on pieces (`modIcon`).
- Done when no split cell remains anywhere, with screenshots of the Armory and Prep.

#### tasks-005 — Remove port drawing and port text · **done**
*Spec §2.*
- Delete the pills (`kit.ts:75-77`, `styles.css:538-548`).
- Delete the Armory card's ports panel, Rotate button and "Orientation" line
  (`armorycard.ts:45-51,59,93-95`, `.card__ports*`), and the tooltip's port line (`prep.ts:635`).
- The port model itself goes in tasks-015, so this changes no numbers.
- Done when nothing on screen mentions a port.

#### tasks-006 — Remove the labels the shape already says · **done**
*Spec §13, §17, §19, §21 · D5.*
- On the Armory tile, delete the `×N` owned count, `tile__type`, `tile__rarity` and the material band
  (`modtile.ts:32-35`).
- On the card and in the tooltip, delete `rarityLine` and `tagChips` (`armorycard.ts:79-81`,
  `prep.ts:632`), and delete the `.gem` badge (`styles.css:168-175`).
- Add one accessible label, `modLabel(definition, stars?)`, for example "Cinder Edge, Solar, Strike
  affinity, domino, Uncommon, 2 stars". Every tile, piece, offer and bank slot uses it.
- Done when a test shows `modLabel` names the type, affinity, shape, rarity and stars, and the visible
  tile text is the name alone.

#### tasks-007 — Remove the energy UI and the stat blocks · **done**
*Spec §3, §19, §21.*
- In Prep, delete the element counters and their identity text (`prep.ts:76-80,108,238-239,650-654`)
  and "Charge holds N" (`249`).
- On the Armory card, delete the resource profile (`armorycard.ts:18-22,86-92`) and the ★ number
  table (`62-71`).
- Delete `profileOf` and `scaleRows` from `describe.ts`, with their tests.
- The engine keeps running until tasks-040; only what is shown changes.
- Done when no screen outside `?debug` says Heat, Charge or Void, except the old catalogue's own rules
  text, which leaves with it in tasks-039.

### Pass 3 — The canonical shape library

#### tasks-008 — The eleven shapes · **done**
*Spec §9–§12, §14.*
- `shapes.ts` holds `GridPoint`, the spec's 11 `ShapeId`s, `ModShape`, `SHAPES` (§5's footprints),
  `sizeOf` and `SHAPE_LABEL` ("I tetromino", "straight triomino", …).
- `[x, y]` tuples become `GridPoint` wherever cells are read: `grid.ts`, `kit.ts`, `prep.ts`,
  `opponents.ts` and the tests.
- Remap the registry: mono → `single`, duo → `domino`, i3 → `triomino-i`, l3 → `triomino-l`,
  o4 → `tetromino-o`, t4 → `tetromino-t`, and **l4 → `tetromino-j`**, because Thunderhead's footprint
  is a J.
- Done when a test pins each footprint's cell set and size. I, S, Z and L exist before any mod uses
  them.

#### tasks-009 — Board width and height
*Spec §42.*
- `GRID_SIZE` becomes `BOARD_WIDTH` and `BOARD_HEIGHT`, both still 3, through `grid.ts`, `compile.ts`,
  `opponents.ts`, `prep.ts`, `runend.ts`, the C9 generator and the grid tests. The CSS grid reads
  `--board-w` and `--board-h`.
- Done when changing the two constants is the only code edit tasks-032 needs outside layout.

### Pass 4 — Rotation

#### tasks-010 — Orientation math, and its tests
*Spec §15, §39.*
- `shapes.ts` gains `turnClockwise`, `normalise` (min 0, sorted), `orientations` (distinct, each
  paired with the first rotation that makes it), `normaliseRotation` and `cellsAt`.
- `tests/mods/rotation.test.ts` covers:
  - cells stay unique, and normalisation works;
  - four quarter turns return to the start, and duplicate orientations collapse;
  - the distinct counts are O 1, I 2, S 2, Z 2, T 4, J 4, L 4, straight triomino 2, L triomino 4,
    domino 2, single 1 — 28 in all;
  - every orientation's cells are non-negative integers starting at 0.

#### tasks-011 — Degrees on the placed mod
*Spec §15 · D9.*
- `OwnedMod.rotation` and `PlacedMod.rotation` become `0 | 90 | 180 | 270`, normalised on every
  write: move, rotate, bank and place.
- Save version 3 migrates version 2 (quarter turn × 90, then normalised). A test loads a version-2 O
  at rotation 3 as rotation 0 on the same cells (C11).
- Done when `tests/run/save.test.ts` covers the migration.

#### tasks-012 — Turning about the cursor
*Spec §16 · D9.*
- `grid.ts` gains `turnAbout(placement, pivot)`: a clockwise quarter turn about a board cell. The pivot
  cell stays occupied and in place, and the result is normalised.
- In Prep, drag and carry keep the held cell as a `GridPoint` pivot rather than a cell index.
  - Right click on a placed piece turns it about the cell under the pointer.
  - R on a focused piece turns it about its first cell.
  - A turn that would not fit is refused, and nothing moves.
- Done when tests show that no turn of any shape moves the pivot, that turning an O changes nothing,
  and that four turns return to the start.

#### tasks-013 — Controls
*Spec §16, §31 · D9.*
- The left button picks up and places: a click carries, and a drag still works. A carried piece
  follows the pointer, snapped to the board, and shows at once whether it fits.
- The right button turns a carried piece clockwise, R is the keyboard fallback, and Escape puts the
  piece back. The wheel stops turning pieces (`prep.ts:534-538,693`).
- The toast and tooltips describe exactly these controls.
- Done when a pick, turn, place and refusal have been run in the preview, with screenshots of a valid
  and an invalid carry.

### Pass 5 — Adjacency

#### tasks-014 — The adjacency primitive
*Spec §1, §35, §40.*
- `src/mods/adjacency.ts` exports `occupiedCells`, `sharedEdges`, `areAdjacent`, `adjacencyGraph` and
  `getAdjacentMods` (§5). It reads turned cells only and names no energy, type or effect.
- `tests/mods/adjacency.test.ts` checks:
  - a shared horizontal edge, and a shared vertical edge, make two pieces adjacent;
  - touching only at a corner does not, and neither does being apart;
  - rotated pieces use their turned cells;
  - one shared edge is enough, and several are still one relationship, while `edges` counts them;
  - the graph is symmetric.

#### tasks-015 — Adjacency replaces ports
*Spec §2, §34.*
- `program.ts` records each mod's adjacent uids instead of its links. `compile.ts` finds Amplifier's
  neighbours through the graph, and `opponents.ts` scores neighbours the same way.
- As a bridge until tasks-040, Chain Circuit counts adjacent mods and Feedback Loop refunds adjacent
  spenders.
- Delete `ports.ts`, `out` and `into`, every record's port list and its validation, `LINK_BONUS`,
  `feeds` and `portLine`, together with the port tests (`model.test.ts:86-115`,
  `registry.test.ts:51`, `describe.test.ts:29-34`, and the link cases in `sequences.test.ts`).
- Done when no mod code mentions a port or a link.

### Pass 6 — The colour system

#### tasks-016 — The token set
*Spec §25, §26 · D5, D6.*
- `:root` holds every token in §7.2, grouped and commented, and the mod UI reads nothing else.
- A dark mod-surface scope covers the catalogue, Prep's shop offers and the mod tooltip.
- Delete `--iron` … `--diamond`, `--mc`, `--g`, `data-material`, `MATERIALS`, `MATERIAL_LABEL` and
  `rarityLine`. Stars use `--star-on` and `--star-off`.
- Done when the stylesheet has a single palette block and `rarity.ts` holds only labels and prices.

#### tasks-017 — Choose the palette as one system
*Spec §24, §27, §28.*
- Pick every value in §7.2 together, against the dark surfaces and against each other. Aim for
  saturated, crisp and arcade-like: no pastel wash, no neon glow, no near-identical purples, and no
  gray-on-gray.
- Record the swatches, contrast ratios and separations in `docs/MODS.md` → *Colour*.
- Done when tasks-018's test passes on the chosen values and the swatch sheet (tasks-019) has been
  looked at in the running game.

#### tasks-018 — The palette test
*Spec §26–§29, §32.*
- `tests/ui/palette.test.ts` reads `:root` from `styles.css` and enforces §7.3: contrast, OKLab
  separation, all 12 icon pairs, and no literal colour in mod-UI rules or glyphs.
- Done when each rule has been seen to fail on a deliberately bad value, then reverted.

#### tasks-019 — Icons in tokens, and the icon treatment
*Spec §29.*
- In `icons.ts`, the strike, tech, block, burn, shock and poison glyphs draw with `currentColor` and
  an outline class, and use no literal colour.
- The icon on a piece is its glyph in the action colour on a small `--icon-backing` disc, or the
  lightest treatment that passes all 12 pairs.
- Add a `?debug` swatch sheet in the Armory, drawn with the real `modArt`: all 16 type × affinity
  pieces at rest, hovered, selected, and in valid and invalid placement, plus the five rarity names.
- Done when the sheet shows all 12 icon pairs readable at card size and at board size.

#### tasks-020 — States
*Spec §30, §31.*
- Hover (weaker) and selection (a strong frame and corner markers) leave the type colour alone. Focus
  gets its own ring. An unaffordable or sold offer is marked by token and strike-through.
- Placement validity follows §7.4. This replaces `.cell.is-ok`, `.cell.is-bad`, the ghost's opacity,
  `.is-carried` and `.is-lifted`.
- Done when the swatch sheet shows every state and the palette test checks the state tokens.

#### tasks-021 — The palette on Prep's mod surfaces
*Spec §24 · D6.*
- Apply the palette to the bank slots, the board, and the shop offers (a dark foot, the name in its
  rarity colour, the price).
- Replace the gems on the rarity odds strip with chips in the rarity colours, and apply the palette to
  the mod tooltip and the run-end build.
- Settle by screenshot whether the board and bank go dark, and write the answer into D6.
- Done when Prep and Run end screenshots at 1920 × 1080 are checked and the palette test finds no
  mod-UI literal.

### Pass 7 — The catalogue card

#### tasks-022 — The card's view model
*Spec §19, §20.*
- A pure function in `src/ui/` turns a definition and an owned count into the card's content:
  - the display cells, with the shape lying flat;
  - one cell size for every card, fitted to a 4 × 2 box, so a single looks as small as it is;
  - the icon cell, the name, the rarity, `modLabel`, and three collection pips.
- Done when a test runs every registry mod through it: each card's cell count equals its shape's size,
  and no card exceeds the 4 × 2 box.

#### tasks-023 — The card
*Spec §19, §20, §30.*
- The shape is the artwork: large, centred, and not framed as a small diagram inside a square.
- Draw at most one action icon, and the name at the bottom in its rarity colour, on one line with an
  ellipsis past the width.
- Secondary: three small pips down the right edge (★ owned, ★★ ready, ★★★ ready), silhouetted until
  reached, like Batomon's trophy column. The tasks-023 1920 × 1080 screenshot keeps them: they stay
  visually subordinate to the shape and do not crowd the name.
- Delete `modtile.ts` (`modSquare`, `modTile`) and the `.tile*` and `.square*` rules.
- Done when a screenshot of the grid is checked, and a 32-character name leaves the layout intact.

#### tasks-024 — Icon placement: centre or anchor · **done**
*Spec §20.*
- The 1920 × 1080 comparison covered both variants for all 11 shapes at card and board size.
- **B won:** the icon sits on the occupied cell nearest the centroid, with ties going to the
  top-left. It keeps the disc on a solid cell instead of straddling seams and junctions.
- The bounding-box-centre variant and its comparison flag are deleted; `docs/MODS.md` records why.

#### tasks-025 — The catalogue screen · **done**
*Spec §22, §42.*
- The top bar has `FILTER: NONE` and `CLEAR` on the left, `MOD CATALOG` in the middle, and close (×)
  on the right.
- The detail pane sits on the left. On the right is a four-column grid that scrolls, with a visible,
  themed scrollbar.
- The footer counts owned, ★★-ready and ★★★-ready mods against the total, like Batomon's counters.
- Arrow keys move between cards, Enter selects and Escape closes.
- Done when a 1920 × 1080 screenshot, with one card selected and another hovered, is checked.

### Pass 8 — The selected detail pane

#### tasks-026 — The detail pane
*Spec §18, §21.*
- The pane shows:
  - the name, in its rarity colour;
  - the big shape with its icon;
  - ★ / ★★ / ★★★ as compact pips that preview that level;
  - the rules text at that level, in at most three short lines;
  - one line on copies owned and what combining needs.
- Right click or R on the big shape turns the preview through the shape's distinct orientations. This
  is the only rotation control.
- There is no type badge, rarity word, number table, port panel or Rotate button: `armorycard.ts` is
  rewritten, not extended.
- Done when the screenshot is checked. The DOM test comes in tasks-042.

### Pass 9 — Filters

#### tasks-027 — The filter model
*Spec §23 · D8.*
- `src/mods/armory.ts` gains:
  - `CatalogFilter`: three sets — types; affinities, with None as a value; rarities;
  - `NO_FILTER`;
  - `matches`: OR within a group, AND across groups;
  - `filterSummary`: `NONE`, or the number of choices made.
- Delete text search, owned-only and `EVERYTHING`.
- Done when tests cover each group alone, two and three groups together, an empty result, and Clear
  bringing back every mod.

#### tasks-028 — The filter modal
*Spec §23.*
- `FILTER: NONE` opens a compact modal with a header bar and a close (×), shaped like Batomon's. Its
  groups:
  - TYPE: chips in the type colours;
  - ACTION: Strike, Tech and Block with their icons, and None;
  - RARITY: chips labelled and coloured by rarity.
- CLEAR sits at the bottom. The grid behind updates as each chip is toggled.
- Escape closes the modal before the catalogue, and focus stays inside the modal.
- Done when screenshots with choices in all three groups are checked.

### Pass 10 — The 64-mod catalogue

#### tasks-029 — The effect vocabulary
*Spec §36, §37 · D4.*
- `effects.ts` gains §5's `ModEffect` beside the old kinds, as a bridge until tasks-040.
- `program.ts` precomputes each mod's cell count and its adjacent, same-type and other-type counts
  from the graph.
- `resolve.ts` resolves `exchange`, `boost` and `perk`. Burn, Shock and Poison behave exactly as
  today.
- Done when tests, run on fixture definitions, cover every scale and condition, `boost`, the
  status-by-type rule, and the landing rules for Strike, Tech, Block and no affinity.

#### tasks-030 — Rules text for the vocabulary
*Spec §21.*
- `describe.ts` writes one short sentence per payoff at a given ★, for example "+1 damage per cell on
  Strike", or "Burn 2 on a hit, +1 for each adjacent Solar mod".
- Done when a test shows every mod's text, at every level, is at most three lines of at most
  60 characters.

#### tasks-031 — Retire the row lanes
*D2, confirmed.*
- `compile.ts` loses `lanes`, `attuned`, `boostOn` and `LANE_POWER`. `Build.preview` gives the bars
  their damage, and the static per-action bonus goes from `sides.ts` (and from `combat/adapter.ts` if
  nothing else reads it).
- Amplifier becomes a `boost` to adjacent mods.
- Prep loses the lane column, the lane tooltips and the row tints, and Run end loses its tints.
  Opponents weigh mods by affinity and same-type adjacency instead of rows.
- The old catalogue loses its lane damage until tasks-039. That is expected; tasks-046 measures the
  result.
- Done when compile's lane tests have become preview tests, and the opponents' lane-sum test has
  become an adjacency score.

#### tasks-032 — The 4 × 4 board
*D2, confirmed.*
- Set `BOARD_WIDTH = BOARD_HEIGHT = 4`.
- Re-lay Prep's mods panel for the largest cell that fits beside the bank and the bars, and update
  Run end and the C9 generator.
- Done when a test places every orientation of every library shape on the empty board, and a Prep
  screenshot is checked.

#### tasks-033 — The catalogue validator
*Spec §6, §8–§12, §38 · D11, confirmed.*
- `catalogueProblems(definitions)` checks:
  - exactly 64; 16 of each type; 16 of each affinity, None included; 4 of every type × affinity pair;
  - 28 / 12 / 16 / 8 by size, with all 11 shapes;
  - one of each of the seven tetrominoes in every type (so 4 of each), and 6 of each triomino;
  - 16 / 16 / 16 / 8 / 8 by rarity;
  - unique ids, and unique names of at most 16 characters;
  - only vocabulary kinds; a status only on its own type, and none on Neutral; the rarity ladder
    (§6.3); something that grows at every ★.
- It runs one type at a time while the catalogue is authored, and on the whole catalogue once it is
  swapped in. Its messages say which count is off, and by how much.

#### tasks-034 — Author Solar (16)
#### tasks-035 — Author Arc (16)
#### tasks-036 — Author Void (16)
#### tasks-037 — Author Neutral (16)
*Spec §6–§12, §36, §37 · D11, confirmed.*
- Each task fills one type's slots in §6.1 in `src/mods/catalogue.ts`, with names and effects written
  under §6.3–§6.5.
- Neutral / None holds the run's perks in its D2, M1 and L3 slots (the successors of Piggy Bank,
  Coupon and Crowd Pleaser). Its Legendary I4 is the `boost` aura that replaces Amplifier.
- Each is done when the validator passes on that type, and all 16 rules texts read cleanly.

#### tasks-038 — Tests stop naming mods
*Spec §41. This task can move earlier, after tasks-003.*
- `tests/mods/fixtures.ts` gains `pick({ type, affinity, size, rarity })`, which returns the first
  registry mod that matches.
- Every test that uses a mod only as a stand-in moves to it: run, combine, save, grid, compile, shop,
  registry, armory and describe.
- Done when no test names an old id outside the engine tests that tasks-040 deletes.

#### tasks-039 — Swap to the 64
*Spec §7, §10 · D7.*
- `REGISTRY` becomes the 64, in catalogue order (§6.2). The 29 go with their ids, the hybrids among
  them.
- `SAVE_VERSION` becomes 4, and saves of versions 2 and 3 are discarded, with a test.
- The shop's rarity pools, the development collection and the Armory follow on their own. Opponents
  and the bot skip mods that only pay the run.
- Done when the catalogue shows 64 cards in 16 rows of four.

#### tasks-040 — Delete the energy model
*Spec §3, §34 · D3, D7.*
- `effects.ts` keeps only §5's vocabulary.
- `resolve.ts` keeps the statuses: `ModState` becomes `{ burn, shock, poison }`.
- `balance.ts` loses `BASE_CHARGE_CAPACITY` and `heatAfterRound`.
- The fight's debug readout shows statuses only.
- `ModDefinition` reaches its target shape — `id, name, rarity, type, affinity, shape, effect` — so
  `description` and `visual` go.
- Done when no mod code mentions Heat, Charge, capacity, leech, refund or accrue.

### Pass 11 — Validation

#### tasks-041 — Close the model tests
*Spec §38–§40.*
- Walk §9's rows for shapes, rotation, adjacency and the catalogue, and add anything missing.
- The validator runs inside `npm test`, so `verify` fails on an unbalanced catalogue.

#### tasks-042 — Catalogue DOM tests
*Spec §41 · D10.*
- Add `happy-dom`. `tests/ui/catalogue.test.ts` mounts the Armory over the real registry and checks:
  - there are 64 cards, and each draws as many cells as its shape, with no duplicates;
  - the preview turns through each distinct orientation;
  - `data-type` on every cell matches the definition;
  - an icon with the right `data-action` appears exactly when the mod has an affinity;
  - the rarity marks the name element and nothing else;
  - a 32-character name keeps to one line, with the ellipsis rule present;
  - selected and hover use different classes;
  - filters combine, and Clear brings back all 64.

#### tasks-043 — Accessibility
*Spec §32.*
- Every card, piece, offer and bank slot carries `modLabel`.
- The detail pane reads out the name, type, affinity, shape, rarity and ★ level.
- The filter chips carry text, and the keyboard reaches everything.
- The palette test gains the text, button, filter, selected and disabled pairs the spec lists.

### Pass 12 — Gameplay integration

#### tasks-044 — A whole run, headless
*Spec §43 pass 12.*
- `tests/game/catalogue-run.test.ts` does all of this on the 4 × 4 board with the 64:
  - buy, place, turn, move, bank and sell;
  - save and load, both mid-prep and mid-fight;
  - fight a fight in which an adjacency payoff lands a status.

#### tasks-045 — C9 and determinism on the new model
- `mods-never-decide.test.ts` runs a thousand random builds from the 64 on the 4 × 4 board, at random
  stars and rotations, with statuses loaded. All nine pairs, each time, with no winner and no timing
  changed.
- Determinism and the 1× / 2× / 4× test still pass.

#### tasks-046 — Opponents, the bot and measurements
- Opponents buy and place by affinity weight and same-type adjacency.
- `npm run tune 1000` reports win rate by type, by affinity and by size class; these are new lines
  in `tune.ts`.
- Write the numbers into `docs/RUN_PLAN.md` → *Measured*, and replace §6.4's guesses where the
  measurements say to.

#### tasks-047 — Every screen at three resolutions
*Spec §42.*
- In the preview browser at 1920 × 1080, 2560 × 1440 and 3840 × 2160, check:
  - the catalogue: grid, detail pane and modal;
  - Prep: a valid and an invalid carry, the tooltip, the shop;
  - Fight: statuses;
  - Run end.
- Nothing may be clipped or re-laid out, and text must be crisp.

#### tasks-048 — Docs and the contract
- Rewrite `docs/MODS.md` for this model and palette.
- Give `docs/RUN_DESIGN.md` decision rows for D2–D11.
- Update `AGENTS.md`: layer 2's list, C4's type and affinity, C9's property test, C11's version 4, and
  Layout.
- Update the pitch in `README.md`.
- Update `docs/RUN_PLAN.md`: the Status row, *Mods and compile*, *Screens* and the testing table.

#### tasks-049 — Final sweep
- A guard test fails if mod code reintroduces ports, tags, materials, a `×N` on a card, T1–T3, or the
  retired resource words (§4.3).
- No unused exports remain, and `verify` is green.
- Merge and delete the branch, and mark all of §11 done.

## 9. Test map

| Spec | What is proved | Where | Tasks |
| --- | --- | --- | --- |
| §38 | 64 mods; balance by type, by affinity and by pair; sizes; every shape; unique ids and names | `tests/mods/catalogue.test.ts` | 033, 041 |
| §39 | unique cells; normalisation; four turns come back; duplicates collapse; distinct counts; valid coordinates | `tests/mods/rotation.test.ts` | 010, 012 |
| §40 | horizontal and vertical edges; corners; apart; rotated pieces; one edge enough; many edges still one relationship | `tests/mods/adjacency.test.ts` | 014 |
| §41 | 64 render; every shape; rotation previews; type colours; icons; rarity on names only; long names; selected vs hover; filters combine; Clear | `tests/ui/catalogue.test.ts`, `tests/mods/armory.test.ts` | 022, 027, 042 |
| §26–§29, §32 | tokens; contrast; separation; the 12 icon pairs; no literals | `tests/ui/palette.test.ts` | 018, 043 |
| §36, §37 | the vocabulary; status by type; landing rules; the rarity ladder | `tests/mods/effects.test.ts`, the validator | 029, 033 |
| §15, C11 | degrees; the version-2 migration; versions 2–3 discarded at 4 | `tests/run/save.test.ts` | 011, 039 |
| C9 | mods never decide an exchange | `tests/combat/mods-never-decide.test.ts` | 045 |
| §43 pass 12 | buy, place, turn, move, bank, sell, save, load, and a fight with adjacency payoffs | `tests/game/catalogue-run.test.ts` | 044 |
| Plan §4.3 | no ports, tags, materials, `×N`, T1–T3 or resource words come back | `tests/architecture.test.ts` | 049 |

## 10. Out of scope

From the spec: Solar heat networks, heat sinks, Arc generators, batteries, energy capacity, energy
routing, Void resource leeching, port compatibility, directional energy flow, generator and consumer
UI, a major action-bar redesign, and any combat redesign unrelated to mods.

Also out of scope for this pass:

- The fight, arena and debug colours. They keep their literals and are listed for a later pass.
- Renaming the repository or the title screen's wordmark to Mix Up.
- Persisting the collection.
- New statuses or new kernel hooks.

The adjacency graph is the foundation those later systems attach to, and nothing in this pass names
them. There are no directories for them (`AGENTS.md`).

## 11. Task index

✓ marks a decision Jacob has confirmed.

| Task | Title | Pass | Gated by | Status |
| --- | --- | --- | --- | --- |
| tasks-001 | Audit the mod system | 1 | — | done |
| tasks-002 | Confirm the decisions | 1 | — | done |
| tasks-003 | Split tags into type and affinity | 2 | D4 ✓ | done |
| tasks-004 | One type colour per piece, one action icon | 2 | — | done |
| tasks-005 | Remove port drawing and port text | 2 | — | done |
| tasks-006 | Remove the labels the shape already says | 2 | D5 ✓ | done |
| tasks-007 | Remove the energy UI and the stat blocks | 2 | — | done |
| tasks-008 | The eleven shapes | 3 | — | done |
| tasks-009 | Board width and height | 3 | — | done |
| tasks-010 | Orientation math, and its tests | 4 | — | done |
| tasks-011 | Degrees on the placed mod | 4 | D9 ✓ | done |
| tasks-012 | Turning about the cursor | 4 | D9 ✓ | done |
| tasks-013 | Controls | 4 | D9 ✓ | done |
| tasks-014 | The adjacency primitive | 5 | — | done |
| tasks-015 | Adjacency replaces ports | 5 | — | done |
| tasks-016 | The token set | 6 | D5 ✓, D6 ✓ | done |
| tasks-017 | Choose the palette as one system | 6 | — | done |
| tasks-018 | The palette test | 6 | — | done |
| tasks-019 | Icons in tokens, and the icon treatment | 6 | — | done |
| tasks-020 | States | 6 | — | done |
| tasks-021 | The palette on Prep's mod surfaces | 6 | D6 ✓ | done |
| tasks-022 | The card's view model | 7 | — | done |
| tasks-023 | The card | 7 | — | done |
| tasks-024 | Icon placement: centre or anchor | 7 | — | done |
| tasks-025 | The catalogue screen | 7 | — | done |
| tasks-026 | The detail pane | 8 | — | todo |
| tasks-027 | The filter model | 9 | D8 ✓ | todo |
| tasks-028 | The filter modal | 9 | — | todo |
| tasks-029 | The effect vocabulary | 10 | D4 ✓ | todo |
| tasks-030 | Rules text for the vocabulary | 10 | — | todo |
| tasks-031 | Retire the row lanes | 10 | D2 ✓ | todo |
| tasks-032 | The 4 × 4 board | 10 | D2 ✓ | todo |
| tasks-033 | The catalogue validator | 10 | D11 ✓ | todo |
| tasks-034 | Author Solar (16) | 10 | D11 ✓ | todo |
| tasks-035 | Author Arc (16) | 10 | D11 ✓ | todo |
| tasks-036 | Author Void (16) | 10 | D11 ✓ | todo |
| tasks-037 | Author Neutral (16) | 10 | D11 ✓ | todo |
| tasks-038 | Tests stop naming mods | 10 | — | todo |
| tasks-039 | Swap to the 64 | 10 | D7 ✓ | todo |
| tasks-040 | Delete the energy model | 10 | D3 ✓, D7 ✓ | todo |
| tasks-041 | Close the model tests | 11 | — | todo |
| tasks-042 | Catalogue DOM tests | 11 | D10 ✓ | todo |
| tasks-043 | Accessibility | 11 | — | todo |
| tasks-044 | A whole run, headless | 12 | — | todo |
| tasks-045 | C9 and determinism on the new model | 12 | — | todo |
| tasks-046 | Opponents, the bot and measurements | 12 | — | todo |
| tasks-047 | Every screen at three resolutions | 12 | — | todo |
| tasks-048 | Docs and the contract | 12 | — | todo |
| tasks-049 | Final sweep | 12 | — | todo |
