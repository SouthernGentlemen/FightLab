# Active implementation plan

This is Mix Up/FightLab's current/future process-parity queue under WG-ARCH-001 §27. The 64-mod catalogue, 4 × 4 board, adjacency model, palette, Armory, tests and visual pass are present on current `main`; their completed task list is Git history, not this queue. `docs/RUN_PLAN.md` and `docs/MODS.md` remain product authorities. No task here reopens the landed mod migration.

The planning change introduces `FL-001` as the first prospective controlled-change ID; older unnumbered commits are immutable history, not retroactively renumbered. On `do needful`, fetch `main`, open PRs and exact-head CI; finish a current green authoritative PR first, then take only the first open task. A blocked first task is not skipped without owner direction. Each delivering PR removes its task and updates future blocks. Delete this file with the last task. Preserve the exact Boneyard commit+digest pin, private cross-repo checkout requirement, deterministic simulation, visual evidence and safe local dev lifecycle. A private GitHub ruleset API currently returns a plan/tier 403; treat that as a provider blocker, not a laboratory exemption. Short, single-outcome turns are the target.

## Open tasks

### FL-002 — [DOCS] Establish the one-task controlled development loop

- Dependency: FL-001 merged on `main`.
- Why: `AGENTS.md` still describes `tasks-NNN`, multi-commit product passes and `verify` without a current/future queue or exact-head merge handoff.
- Scope: Define `do needful`, first-open/blocked task, same-delivery purge, queue exhaustion, FL branch/title/body format, truthful provider actions and one-turn handoff. Retire this block in its PR.
- Non-goals: No gameplay, Boneyard pin or CI change.
- Acceptance: A fresh agent can deliver one FL task and stop with a next prompt; accepted tasks cannot remain in the active plan.
- Validation: `npm run verify`; `git diff --check`.
- Authorities: `AGENTS.md`, WG-ARCH-001 §27.

### FL-003 — [DOCS] Add human contribution and command guidance

- Dependency: FL-002 merged.
- Why: There is no `CONTRIBUTING.md`; README's `verify`/development guidance is not the shared command contract.
- Scope: Add concise change-flow and command guidance that states Boneyard sibling prerequisites, visual checks, no hosted deployment and the temporary `verify` umbrella pending `check` adoption.
- Non-goals: No npm script, CI or product behavior change.
- Acceptance: A contributor knows branch/PR discipline and which commands are local, acceptance, provider or release actions.
- Validation: Compare `package.json`/workflows; `npm run verify`; `git diff --check`.
- Authorities: `CONTRIBUTING.md`, `README.md`, `AGENTS.md`.

### FL-004 — [SEC] Add a security-reporting and secret boundary

- Dependency: FL-003 merged.
- Why: The repository has `LICENSE.md` attribution but no root `SECURITY.md` or explicit vulnerability-reporting path.
- Scope: Add the policy with private reporting route, supported product boundary and prohibition on committing Boneyard access tokens, real saves/catalogs and machine-private paths.
- Non-goals: No license replacement, hosted service or vulnerability claim.
- Acceptance: Reporting and secret/data boundaries are unambiguous and consistent with existing ignored files.
- Validation: Documentation/link review; `npm run verify`; `git diff --check`.
- Authorities: `SECURITY.md`, `.gitignore`, `LICENSE.md`.

### FL-005 — [TEST] Validate prospective FL change identities

- Dependency: FL-004 merged.
- Why: Current task IDs are not controlled commit identities; no test prevents future duplicate, gap or malformed FL commits.
- Scope: Add a validator for FL-001 onward, with exact immutable cutover and focused valid/invalid cases; do not rewrite old commits.
- Non-goals: No forced merge-method change or retroactive history formatting.
- Acceptance: Future controlled IDs are unique/sequential with one primary type and structured body; legacy commits remain reconstructable.
- Validation: Focused history tests; `npm run verify`; `git diff --check`.
- Authorities: `scripts/` or `pipelines/`, `AGENTS.md`, `docs/CHANGE-MANAGEMENT.md` if introduced.

### FL-006 — [BUILD] Make `check` the canonical credential-free gate

- Dependency: FL-005 merged.
- Why: `verify` currently owns the Boneyard pin, typecheck, tests and production build; WG-ARCH requires `check` as the documented acceptance entry point.
- Scope: Expose that same complete sequence through `npm run check`, include prospective history validation, and keep `verify` only as a documented compatibility alias until callers migrate.
- Non-goals: No test removal, unpinned Boneyard use or product rewrite.
- Acceptance: `check` and `verify` have equal acceptance coverage without duplicate builds in one invocation.
- Validation: `npm run check`; `npm run verify`; `git diff --check`.
- Authorities: `package.json`, `pipelines/pin.ts`, `CONTRIBUTING.md`.

### FL-007 — [BUILD] Run canonical acceptance on PRs and `main`

- Dependency: FL-006 merged.
- Why: `verify.yml` currently runs on PR/dispatch only and invokes `verify`; `main` can drift without the shared gate.
- Scope: Run locked installation and `npm run check` on both PRs and `main`, preserving the exact pinned private Boneyard checkout and separate visual artifact workflow.
- Non-goals: No public Boneyard token, screenshot removal or production deploy.
- Acceptance: Exact-head PR and merged-main CI validate the same pin and command; missing private checkout permission fails visibly.
- Validation: Workflow review; `npm run check`; exact-head CI; `git diff --check`.
- Authorities: `.github/workflows/verify.yml`, `.github/workflows/visual.yml`.

### FL-008 — [TEST] Add pure repository-settings expectations

- Dependency: FL-007 merged.
- Why: No committed ruleset/settings authority exists even though the organization process requires one.
- Scope: Add a platform-neutral expected settings record and pure comparison tests for protected `main`, required CI, allowed merge method and immutable `v*` tags when releases are published. Do not claim those private-repo settings are live.
- Non-goals: No GitHub settings mutation or account-tier upgrade.
- Acceptance: Credential-free `check` fails on changed expected settings; provider state is represented separately.
- Validation: Focused settings tests; `npm run check`; `git diff --check`.
- Authorities: `config/github-repository-settings.json`, new pure tests, WG-ARCH-001 §27.

### FL-009 — [OPS] Verify live settings or record the provider blocker

- Dependency: FL-008 merged.
- Why: GitHub currently returns a 403 plan/tier restriction for this private repository's rulesets; a committed baseline alone is not live protection.
- Scope: Add a read-only live verifier and document the exact permission/tier failure. If the feature remains unavailable, stop with the task open and request the owner/provider change; do not silently mark N/A.
- Non-goals: No public visibility change, paid-plan purchase or bypass of protection.
- Acceptance: Live settings match the committed authority, or an explicit unresolved provider blocker remains; never claim parity from a pure test.
- Validation: Pure tests; `npm run check`; live verifier when authorized; `git diff --check`.
- Authorities: GitHub settings baseline, `SECURITY.md`, WG-ARCH-001 §27.

## Recheck after this wave

Re-audit release capability (no GitHub Release currently published), local dev lifecycle tests, visual CI retention, source-policy drift and plan-conformance enforcement before another small wave. Keep gameplay tuning and product features separate from process adoption.
