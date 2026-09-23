# Active implementation plan

This is Mix Up/FightLab's current/future process-convergence queue under WG-ARCH-001 §27. The landed game/mod work remains product history. `docs/RUN_PLAN.md` and `docs/MODS.md` remain product authorities; no task here reopens that migration.

`FL-001` begins the prospective controlled-change sequence; older unnumbered commits remain immutable. On `do needful`, re-fetch authoritative `main`, open PRs, exact-head CI, repository settings, rulesets, tags and releases. Finish the authoritative PR for the first open task instead of duplicating it. Deliver one queued task per controlled change, remove that task in the same delivery, and delete this file with the final task.

Preserve the exact Boneyard commit+digest pin, cross-repo checkout boundary, deterministic simulation, visual evidence, safe local lifecycle and FightLab's distribution boundary. Provider verification and mutation are separate. Source-only GitHub Releases are allowed by this queue, but `LICENSE.md` still forbids assuming permission to publish or deploy a built `dist/` or Boneyard-derived assets.

## Open tasks

### FL-014 — [BUILD] Define immutable source-release identity

- Dependency: FL-013 merged.
- Why: FightLab needs deterministic release identity without publishing a restricted built game artifact.
- Scope: Tie package version, annotated `vX.Y.Z`, exact tagged commit and repository content together. Keep the package private. GitHub Releases are source-only authority; never attach `dist/` or Boneyard-derived build artifacts.
- Non-goals: No npm publication, automatic version bump, build artifact publication or production deployment.
- Acceptance: Source-release identity fails clearly on tag/version/commit mismatch.
- Validation: Release-identity cases; `npm run check`; `git diff --check`.

### FL-015 — [TEST] Guard annotated tag and package identity

- Dependency: FL-014 merged.
- Scope: Disposable Git cases for lightweight-tag failure, malformed semver, package/tag mismatch, wrong-commit failure and correct annotated exact-head success; also prove release packaging excludes `dist/` and copied Boneyard assets.
- Non-goals: No GitHub Release creation, provider mutation or deployment.
- Acceptance: Canonical acceptance covers release identity offline and credential-free.
- Validation: Focused release tests; `npm run check`; `git diff --check`.

### FL-016 — [OPS] Publish source-only GitHub Releases from verified tags

- Dependency: FL-015 merged.
- Scope: Tag-triggered provider path: annotated `vX.Y.Z` -> pinned toolchain -> `npm ci` -> `npm run check` -> identity verification -> `gh release create --verify-tag`. Publish source metadata only; no `dist/` or generated fighter/art attachments.
- Non-goals: No npm publication, auto-versioning, build artifact publication or production deployment.
- Acceptance: Only the correctly annotated/versioned/validated tag can create a GitHub Release.
- Validation: Workflow/CLI tests; tag identity evidence; GitHub Release evidence when exercised; `git diff --check`.

### FL-017 — [TEST] Guard the no-production-deploy boundary

- Dependency: FL-016 merged.
- Why: Process parity must not turn Mix Up into a hosted production service or publish a legally restricted build.
- Scope: Allow immutable source tags/releases while rejecting production deployment workflows/configuration, npm publication, `dist/` release attachments and redistribution of Boneyard-derived built assets.
- Non-goals: No hosted environment, distribution-rights expansion, gameplay feature or asset rewrite.
- Acceptance: Canonical acceptance proves source-release parity while built-game publication/deployment remains impossible.
- Validation: Positive/negative distribution-boundary cases; `npm run check`; `git diff --check`.

### FL-018 — [DOCS] Complete shared process-parity acceptance

- Dependency: FL-017 merged.
- Scope: Fresh audit of Node/npm, `npm ci`, canonical `check`, controlled FL history, exact-head/main CI, squash-only merging, branch cleanup, settings CLI/live rules, annotated release identity, source-only GitHub Releases and the no-build-publication/no-deploy boundary. Delete `implementation_plan.md` when all applicable evidence is green.
- Non-goals: No feature work, tuning, version bump, tag creation, release publication or deployment solely for the audit.
- Acceptance: FightLab follows the shared process everywhere applicable and has no remaining active queue.
- Validation: `npm ci`; `npm run check`; provider verification; release/tag evidence; exact-head/main CI; `git diff --check`.

## Target process

`branch -> controlled FL commit -> PR -> npm ci -> npm run check -> exact-head CI -> squash merge -> merged-main CI -> completed-branch cleanup`

Source release:

`reviewed main -> package version -> annotated vX.Y.Z -> exact identity -> npm ci -> npm run check -> gh release create --verify-tag -> stop`

FightLab has no production deploy stage and no authority to publish a built `dist/`. That is an architectural and distribution constraint, not missing deployment automation.

## Recheck after this wave

After FL-018, enter fresh planning mode only if current repository/provider evidence shows new drift. Keep gameplay tuning, licensing/asset work and product features separate from process adoption.
