# Active implementation plan

**Portfolio plan maintenance notice.** The owner may direct an additive update to this active queue while another task or pull request is in progress. Keep every existing open task and its order; a plan amendment neither implements nor retires it. After the shared policy setup, a routine amendment changes only this plan file. Before merging, re-fetch authoritative `main` and open pull requests, compare the current plan and exact head with the recorded base, and rebase/reconcile if either moved. Require current exact-head checks and mergeability so concurrent work is not overwritten. Any earlier “final task” or “no queue remains” wording applies to its original wave; it keeps this plan while appended tasks remain, and only the actual last task deletes it.

This is Mix Up/FightLab's current/future queue under WG-ARCH-001 §27. The landed game/mod work remains product history. `docs/RUN_PLAN.md` and `docs/MODS.md` remain product authorities. The owner has placed one mod-presentation refresh ahead of the remaining process work; it changes presentation, not the mod rules.

`FL-001` begins the prospective controlled-change sequence; older unnumbered commits remain immutable. On `do needful`, re-fetch authoritative `main`, open PRs, exact-head CI, repository settings, rulesets, tags and releases. Finish the authoritative PR for the first open task instead of duplicating it. Deliver one queued task per controlled change, remove that task in the same delivery, and delete this file with the final task.

Preserve the exact Boneyard commit+digest pin, cross-repo checkout boundary, deterministic simulation, visual evidence, safe local lifecycle and FightLab's distribution boundary. Provider verification and mutation are separate. Source-only GitHub Releases are allowed by this queue, but `LICENSE.md` still forbids assuming permission to publish or deploy a built `dist/` or Boneyard-derived assets.

## Open tasks

### FL-020 — [BUILD] Restore dual-colour mod art and distinguish all catalogue mods

- Dependency: Owner-directed priority ahead of process normalization. Use the existing TypeScript, DOM, CSS and Vite stack and the real 64-mod registry; keep the deterministic game and Boneyard ownership boundary.
- Why: Solid type-coloured polyominoes with action icons make mods sharing a footprint hard to distinguish. The owner selected the diagonal two-colour treatment and wants more varied outlines plus small, accurate effect numbers beneath mods.
- Scope: Draw each mod in its type colour plus its optional Strike/Tech/Block affinity colour, with type-only art for no affinity; remove action glyphs from mod artwork while retaining action controls elsewhere. Give each rarity a distinct neutral outline treatment, add effect-derived accents where they improve recognition, and ensure mods sharing a type, affinity and footprint remain distinguishable by outline and effect readout. Show compact one-star and selected-star damage, Burn, Shock, Poison, Block-triggered riposte, heal, cleanse, boost and economy readouts below art wherever layout permits. Represent conditional/per-unit values honestly and preserve detailed rules in the existing detail pane and tooltips. Apply the same visual language in Armory cards/detail and Prep board/bank/shop; cover the carried piece and run-end build. Update product docs, accessibility labels and focused visual/DOM tests. Reconcile the current local Boneyard pin only after reviewing the consumed-file diff, so `npm run dev` works from the merged checkout without weakening the pin.
- Non-goals: No gameplay, balance, catalogue, shape, combat, opponent, screen-layout or hosting changes. Do not add a framework, raster art or a new action statistic called block damage.
- Acceptance: Every one of the 64 mods has a visually distinguishable combination of shape, dual colour, outline and compact effect readout; same-shape, same-type, same-affinity examples such as Cinder Edge and Searpoint remain recognisable at card and board scale. No Strike/Tech/Block glyph remains inside mod artwork. Numeric labels follow effect vocabulary and star scaling; conditional contributions are identified as such. Board placement/focus/drag states and the 16:9 composition still work. On merged `main`, `npm run dev` starts and serves the game from this workspace.
- Validation: Focused registry/readout and DOM tests, visual inspection of Armory and Prep at native design and miniature sizes, `npm run check`, `git diff --check`, exact-head PR CI, merged-main CI, and a post-merge `npm run dev` smoke test.

### FL-022 — [OPS] Normalize shared package, workflow, and npm command contracts

- Dependency: FL-018 and FL-020 delivered; portfolio planning policy FL-019 merged. Coordinate with the same normalization task in every public sibling repository.
- Why: Shared versioned tooling, workflow behavior, and npm command meanings have drifted across the public repositories.
- Scope: Inventory every public repository's direct and transitive shared npm packages, package manager, Node pin, lockfile, versioned vendor code, GitHub Action pins, workflow triggers/permissions/toolchain/install/check/advisory/identity/release/deploy steps, and npm scripts. Select one supported version for each shared vendor dependency or document a concrete compatibility exception. Align common scripts and YAML workflows to the same behavior for equivalent capabilities. Keep product-specific commands and explicit local-only/library/no-deploy boundaries. Reconcile AGENTS.md and the byte-identical CONTRIBUTING.md contract across the public set.
- Non-goals: Do not add unused packages, a hosted runtime to a local-only product, or production deployment merely for parity. Do not rewrite published history or unrelated product behavior.
- Acceptance: A fresh cross-repository matrix shows the same version for every shared versioned package/vendor tool where compatible, identical CONTRIBUTING.md bytes, equivalent workflow and npm-script semantics for applicable capabilities, and recorded exceptions with technical reasons. No workflow invokes a missing script; every package lock matches its manifest.
- Validation: Install each public repository with its pinned toolchain and `npm ci`; run `npm run check`, focused workflow/script contract tests, `git diff --check`, exact-head CI, and the separate network/provider gates where applicable. Re-fetch every target's base and this documentation commit before merging to preserve concurrent work.

### FL-024 — [OPS] Deploy FightLab at `fightlab.wizardgang.ai/play/` from tagged releases

- Dependency: FL-022 delivered. Before any public build or provider deployment, establish distribution rights for every bundled Boneyard clip and emitted fighter/cosmetic asset identified by `LICENSE.md`; replace or remove material without redistribution permission in Boneyard, update FightLab's exact pin and provenance, and verify the resulting build is publishable. This task is blocked until that evidence exists.
- Why: The owner wants FightLab playable at the same release-governed WizardGang production surface as the other hosted games. The current source-only release and no-deploy guard deliberately provide no Worker, routing or production deployment path.
- Scope: Add a Cloudflare Worker with static assets and production custom-domain/DNS routing for `fightlab.wizardgang.ai`; serve the game only at canonical `/play/`, redirect `/play` to `/play/`, and make built scripts, styles and `fighters/*.json` load correctly on direct visits and refresh. Give unknown paths real 404s and expose a non-sensitive `/version.json` with the exact release tag and commit. Adapt the Vite asset base and build as needed, preserve local development and the Boneyard pin boundary, and replace the no-deploy distribution guard with tests for the authorized deploy and continued rejection of npm publication, release build attachments and tracked `dist/`.
- Release and provider path: Keep annotated `vX.Y.Z` at exact `HEAD`, package-version identity, `npm ci`, canonical `npm run check` and the GitHub Release as prerequisites. After the GitHub Release succeeds, call a deploy-only reusable workflow for that same tag through the protected `production` environment; keep Cloudflare credentials in protected secrets, fail closed on absent or mismatched tag/credentials, and offer a non-mutating dry run. Configure the Worker route, account/zone and required GitHub environment/variables/secrets through the approved provider path. No ordinary branch merge, arbitrary checkout or local command may deploy production.
- Non-goals: No combat, run or UI redesign; no public build while `LICENSE.md` still prohibits it; no npm package publication, GitHub Release asset upload, mutable tag, or deployment ledger in the repository.
- Acceptance: Rights and provenance for the exact deployed build are recorded and the old prohibition is revised only when supported by evidence. The protected tag-driven workflow publishes and deploys one verified release; authenticated Cloudflare deployment evidence shows its version serving production, and public `https://fightlab.wizardgang.ai/play/` plus `/version.json` identify that same tag and commit. Direct visits, refresh, relative assets and fighter art work; `/play` canonicalizes, unrelated paths do not return the game, and production credentials are absent from source and logs.
- Validation: `npm ci`; focused route/asset, rights/provenance, distribution-boundary, release-handoff and fail-closed deploy tests; local Worker smoke test and non-mutating Wrangler dry run; canonical `npm run check`; `git diff --check`; exact-head and merged-main CI; protected-environment, GitHub Release, Cloudflare deployment and public-origin checks against the exact tag.

## Target process

`branch -> controlled FL commit -> PR -> npm ci -> npm run check -> exact-head CI -> squash merge -> merged-main CI -> completed-branch cleanup`

Source release:

`reviewed main -> package version -> annotated vX.Y.Z -> exact identity -> npm ci -> npm run check -> gh release create --verify-tag -> stop`

FightLab currently has no production deploy stage and no authority to publish a built `dist/`. FL-024 is the explicit future change to that boundary, gated by rights and provenance for the exact build.

## Recheck after the current queue

After the actual last open task is delivered, enter fresh planning mode only if current repository/provider evidence shows new drift. Keep gameplay tuning and unrelated product features separate from process adoption.
