# Active implementation plan

This is Mix Up/FightLab's current/future process-parity queue under WG-ARCH-001 §27. The 64-mod catalogue, 4 × 4 board, adjacency model, palette, Armory, tests and visual pass are present on current `main`; their completed task list is Git history, not this queue. `docs/RUN_PLAN.md` and `docs/MODS.md` remain product authorities. No task here reopens the landed mod migration.

The planning change introduces `FL-001` as the first prospective controlled-change ID; older unnumbered commits are immutable history, not retroactively renumbered. On `do needful`, fetch `main`, open PRs and exact-head CI; finish a current green authoritative PR first, then take only the first open task. A blocked first task is not skipped without owner direction. Each delivering PR removes its task and updates future blocks. Delete this file with the last task. Preserve the exact Boneyard commit+digest pin, private cross-repo checkout requirement, deterministic simulation, visual evidence and safe local dev lifecycle. A private GitHub ruleset API currently returns a plan/tier 403; treat that as a provider blocker, not a laboratory exemption. Short, single-outcome turns are the target.

## Open tasks

### FL-009 — [OPS] Verify live settings or record the provider blocker

- Dependency: FL-008 merged.
- Why: GitHub currently returns a 403 plan/tier restriction for this private repository's rulesets; a committed baseline alone is not live protection.
- Scope: Add a read-only live verifier and document the exact permission/tier failure. If the feature remains unavailable, stop with the task open and request the owner/provider change; do not silently mark N/A.
- Non-goals: No public visibility change, paid-plan purchase or bypass of protection.
- Acceptance: Live settings match the committed authority, or an explicit unresolved provider blocker remains; never claim parity from a pure test.
- Validation: Pure tests; `npm run check`; live verifier when authorized; `git diff --check`.
- Authorities: `config/github-repository-settings.json`, `SECURITY.md`, WG-ARCH-001 §27.

## Recheck after this wave

Re-audit release capability (no GitHub Release currently published), local dev lifecycle tests, visual CI retention, source-policy drift and plan-conformance enforcement before another small wave. Keep gameplay tuning and product features separate from process adoption.
