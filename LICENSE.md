# Licences and attribution for what FightLab distributes

The provenance index for every dataset and every piece of art — pinned revisions, rights holders,
licences, covered paths — is [Boneyard's `LICENSE.md`](../Boneyard/LICENSE.md), because that is
where the material lives. FightLab's tree contains none of it.

This file covers the narrower question: what a *build* of FightLab carries, and under what terms.
It is not a licence for FightLab's source code, and it does not create a licence where an upstream
source supplied none.

## Motion in the JavaScript bundle

`src/render/clips.ts` bundles Boneyard's `catalog/clips.json`. Its `bnr*` clips are adaptations of
Bandai-Namco-Research-Motiondataset-1 (revision `74ead3ba1ae4696404e6086233779f60de8bf9ef`),
Copyright 2022 Bandai Namco Research Inc., licensed under
[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/legalcode). **A build of FightLab
therefore may not be used for commercial purposes.** `labWave` is original to Boneyard and claims
no third-party origin.

## Figure art in `dist/fighters/`

A build writes each roster figure's assembled art into `dist/fighters/<figure>.json`.

- `barst` (the opponent) is traced from Fire Emblem Heroes art, Copyright 2017 Nintendo /
  INTELLIGENT SYSTEMS. No redistribution licence for it was established.
- `fighter` (the player) is Boneyard's authored figure, but it wears the field-kit cosmetics,
  whose source and licence are unresolved.

Do not publish or deploy a build, and do not infer permission to redistribute any of this from
its presence in `dist/`.
