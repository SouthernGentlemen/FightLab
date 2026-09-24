# Active implementation plan

**Portfolio plan maintenance notice.** The owner may direct an additive update to this active queue while another task or pull request is in progress. Keep every existing open task and its order; a plan amendment neither implements nor retires it. After the shared policy setup, a routine amendment changes only this plan file. Before merging, re-fetch authoritative `main` and open pull requests, compare the current plan and exact head with the recorded base, and rebase/reconcile if either moved. Require current exact-head checks and mergeability so concurrent work is not overwritten. Any earlier “final task” or “no queue remains” wording applies to its original wave; it keeps this plan while appended tasks remain, and only the actual last task deletes it.

This is Mix Up/FightLab's current/future process queue under WG-ARCH-001 §27. The landed game and mod-presentation work remain product history. `docs/RUN_PLAN.md` and `docs/MODS.md` remain product authorities.

`FL-001` begins the prospective controlled-change sequence; older unnumbered commits remain immutable. On `do needful`, re-fetch authoritative `main`, open PRs, exact-head CI, repository settings, rulesets, tags and releases. Finish the authoritative PR for the first open task instead of duplicating it. Deliver one queued task per controlled change, remove that task in the same delivery, and delete this file with the final task.

Preserve the exact Boneyard commit+digest pin, cross-repo checkout boundary, deterministic simulation, visual evidence, safe local lifecycle and FightLab's distribution boundary. Provider verification and mutation are separate. Source-only GitHub Releases are allowed by this queue, but `LICENSE.md` still forbids assuming permission to publish or deploy a built `dist/` or Boneyard-derived assets.

## Open tasks

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
