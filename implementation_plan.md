# Active implementation plan

This is Mix Up/FightLab's current/future process-convergence queue under WG-ARCH-001 §27. The landed game/mod work remains product history. `docs/RUN_PLAN.md` and `docs/MODS.md` remain product authorities; no task here reopens that migration.

`FL-001` begins the prospective controlled-change sequence; older unnumbered commits remain immutable. On `do needful`, re-fetch authoritative `main`, open PRs, exact-head CI, repository settings, rulesets, tags and releases. Finish the authoritative PR for the first open task instead of duplicating it. Deliver one queued task per controlled change, remove it in the same delivery, and delete this file with the final task.

Preserve the exact Boneyard commit+digest pin, private cross-repo checkout requirement, deterministic simulation, visual evidence, safe local lifecycle and FightLab's distribution boundary. Provider verification and provider mutation are separate: read-only diagnostics may complete after truthfully recording drift; later explicit apply work owns convergence. Source-only GitHub Releases are allowed by this queue, but `LICENSE.md` still forbids assuming permission to publish or deploy a built `dist/` or Boneyard-derived assets.

## Open tasks

### FL-009 — [OPS] Verify live settings or record the provider mismatch

- Dependency: FL-008 merged.
- Why: Desired settings are not provider evidence. Fresh reads show public visibility, unprotected `main`, no required checks, merge/rebase/squash all enabled, empty readable rulesets and no GitHub Releases. The dedicated protection endpoint returns `403 Resource not accessible by integration`; that is an integration-permission result, not demonstrated plan/tier evidence.
- Scope: Add the read-only live verifier with pure credential-free normalization/comparison logic, preserve network-free `npm run check`, classify mismatch/inaccessible/unsupported separately, and record current live drift truthfully.
- Non-goals: No provider mutation, visibility change, paid-plan purchase, tag/release mutation, deployment, gameplay change or Boneyard-pin change.
- Acceptance: The verifier exists, canonical acceptance remains credential-free, provider differences are recorded without inventing plan/tier conclusions, and mutation is explicitly deferred to FL-012.
- Validation: Pure settings tests; `npm run check`; read-only live verifier; exact-head CI; `git diff --check`.
- Authorities: `config/github-repository-settings.json`, `SECURITY.md`, WG-ARCH-001 §27.

### FL-010 — [BUILD] Align Node and npm with the shared baseline

- Dependency: FL-009 merged.
- Why: FightLab has no committed exact Node/npm authority while CI currently uses a broad Node 24 setup.
- Scope: Re-fetch the current organization baseline and align `.node-version`, exact `packageManager`, engines, `.npmrc`, lockfile metadata, CI setup and current docs.
- Non-goals: No general dependency upgrade, gameplay change, release or provider-policy mutation.
- Acceptance: Local, PR and merged-main acceptance use the same exact supported Node/npm pair and drift fails clearly.
- Validation: `npm ci`; `npm run check`; exact-head CI; `git diff --check`.

### FL-011 — [BUILD] Standardize the GitHub settings CLI contract

- Dependency: FL-010 merged.
- Why: FL-009 adds read-only verification, but the shared command contract is pure test / read-only verify / explicit apply.
- Scope: Expose `test:github-settings`, `verify:github-settings` and `apply:github-settings`. Keep tests credential-free, verify read-only and apply explicit/deterministic/bounded to committed settings.
- Non-goals: No GitHub mutation from `npm run check`; no release or deployment.
- Acceptance: Pure tests run offline; verify reports normalized drift; apply is the only mutating settings path and re-verifies after apply.
- Validation: Settings CLI cases; `npm run check`; read-only verification; `git diff --check`.

### FL-012 — [OPS] Apply and verify the live repository policy

- Dependency: FL-011 merged.
- Why: FL-009 proves current provider drift; the shared process requires live enforcement rather than a permanently parked diagnostic.
- Scope: Apply committed policy, then verify protected `main`, required exact-head `verify`, squash-only/single-commit merging, completed-branch cleanup and immutable `v*` tags.
- Non-goals: No visibility change, paid-plan purchase, tag creation, GitHub Release publication, deployment or gameplay change.
- Acceptance: Live provider state matches committed settings, or a genuinely unavailable capability remains an exact explicit blocker.
- Validation: Provider reads before/after; `npm run verify:github-settings`; `npm run check`; exact-head and merged-main CI.

### FL-013 — [BUILD] Define immutable source-release identity

- Dependency: FL-012 merged.
- Why: FightLab needs deterministic release identity without publishing a restricted built game artifact.
- Scope: Tie package version, annotated `vX.Y.Z`, exact tagged commit and repository content together. Keep the package private. GitHub Releases are source-only authority; never attach `dist/` or Boneyard-derived build artifacts.
- Non-goals: No npm publication, automatic version bump, build artifact publication or production deployment.
- Acceptance: Source-release identity fails clearly on tag/version/commit mismatch.
- Validation: Release-identity cases; `npm run check`; `git diff --check`.

### FL-014 — [TEST] Guard annotated tag and package identity

- Dependency: FL-013 merged.
- Scope: Disposable Git cases for lightweight tag failure, malformed semver failure, package/tag mismatch, wrong-commit failure and correct annotated exact-head success; also prove release packaging excludes `dist/`/copied Boneyard assets.
- Non-goals: No GitHub Release creation, provider mutation or deployment.
- Acceptance: Canonical acceptance covers release identity offline and credential-free.
- Validation: Focused release tests; `npm run check`; `git diff --check`.

### FL-015 — [OPS] Publish source-only GitHub Releases from verified tags

- Dependency: FL-014 merged.
- Scope: Tag-triggered provider path: exact annotated `vX.Y.Z` -> pinned toolchain -> `npm ci` -> `npm run check` -> identity verification -> `gh release create --verify-tag`. Publish source metadata only; no `dist/` or generated fighter/art attachments.
- Non-goals: No npm publication, auto-versioning, build artifact publication or production deployment.
- Acceptance: Only the correctly annotated/versioned/validated tag can create a GitHub Release.
- Validation: Workflow/CLI tests; tag identity evidence; GitHub Release evidence when exercised; `git diff --check`.

### FL-016 — [TEST] Guard the no-production-deploy boundary

- Dependency: FL-015 merged.
- Why: Process parity must not turn Mix Up into a hosted production service or publish a legally restricted build.
- Scope: Allow immutable source tags/releases while rejecting production deployment workflows/configuration, npm publication, `dist/` release attachments and redistribution of Boneyard-derived built assets.
- Non-goals: No hosted environment, distribution-rights expansion, gameplay feature or asset rewrite.
- Acceptance: Canonical acceptance proves source-release parity while built-game publication/deployment remains impossible.
- Validation: Positive/negative distribution-boundary cases; `npm run check`; `git diff --check`.

### FL-017 — [DOCS] Complete shared process-parity acceptance

- Dependency: FL-016 merged.
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

After FL-017, enter fresh planning mode only if current repository/provider evidence shows new drift. Keep gameplay tuning, licensing/asset work and product features separate from process adoption.
