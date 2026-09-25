# Licences and provenance for FightLab's public build

FightLab's game source has no separate licence grant here. The asset provenance index is
[Boneyard's `LICENSE.md`](../Boneyard/LICENSE.md). This file describes the exact assets emitted
by the public FightLab build pinned in `boneyard.pin.json`.

## Shipped motion

`src/render/clips.ts` imports only Boneyard's seven repository-authored `lab*` motions:
`labIdle`, `labWalk`, `labStagger`, `labStrike`, `labOverhead`, `labGuard`, and `labWave`.
Each authored source has `derivedFrom: null`. The Bandai Namco derived `bnr*` clips remain in
Boneyard for its own library use but are not imported into FightLab's JavaScript bundle.

## Shipped art

The build emits only `dist/fighters/runner.json`. Boneyard's `figures/runner.json` uses the
repository-authored `characters/fighter/parts/*.svg` and an empty cosmetics list. The player
and three opponents share this physical figure and use FightLab's original CSS colorways.
No Fire Emblem Heroes traced figure, royal-guard cosmetic, or unresolved field-kit cosmetic
is loaded or emitted.

`npm run check:public-build` checks the generated asset set and the emitted JavaScript.
The Boneyard commit and digest in `boneyard.pin.json` bind this statement to the exact
source bytes consumed by the build. A future asset change must repeat this provenance review.
