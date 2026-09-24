# Active implementation plan

**Portfolio plan maintenance notice.** The owner may direct an additive update to this active queue while another task or pull request is in progress. Keep every existing open task and its order; a plan amendment neither implements nor retires it. After the shared policy setup, a routine amendment changes only this plan file. Before merging, re-fetch authoritative `main` and open pull requests, compare the current plan and exact head with the recorded base, and rebase/reconcile if either moved. Require current exact-head checks and mergeability so concurrent work is not overwritten. Any earlier “final task” or “no queue remains” wording applies to its original wave; it keeps this plan while appended tasks remain, and only the actual last task deletes it.

This is Mix Up/FightLab's current/future process-convergence queue under WG-ARCH-001 §27. The landed game/mod work remains product history. `docs/RUN_PLAN.md` and `docs/MODS.md` remain product authorities; no task here reopens that migration.

`FL-001` begins the prospective controlled-change sequence; older unnumbered commits remain immutable. On `do needful`, re-fetch authoritative `main`, open PRs, exact-head CI, repository settings, rulesets, tags and releases. Finish the authoritative PR for the first open task instead of duplicating it. Deliver one queued task per controlled change, remove that task in the same delivery, and delete this file with the final task.

Preserve the exact Boneyard commit+digest pin, cross-repo checkout boundary, deterministic simulation, visual evidence, safe local lifecycle and FightLab's distribution boundary. Provider verification and mutation are separate. Source-only GitHub Releases are allowed by this queue, but `LICENSE.md` still forbids assuming permission to publish or deploy a built `dist/` or Boneyard-derived assets.

## Open tasks

### FL-020 — [OPS] Normalize shared package, workflow, and npm command contracts

- Dependency: FL-018 delivered; portfolio planning policy FL-019 merged. Coordinate with the same normalization task in every public sibling repository.
- Why: Shared versioned tooling, workflow behavior, and npm command meanings have drifted across the public repositories.
- Scope: Inventory every public repository's direct and transitive shared npm packages, package manager, Node pin, lockfile, versioned vendor code, GitHub Action pins, workflow triggers/permissions/toolchain/install/check/advisory/identity/release/deploy steps, and npm scripts. Select one supported version for each shared vendor dependency or document a concrete compatibility exception. Align common scripts and YAML workflows to the same behavior for equivalent capabilities. Keep product-specific commands and explicit local-only/library/no-deploy boundaries. Reconcile AGENTS.md and the byte-identical CONTRIBUTING.md contract across the public set.
- Non-goals: Do not add unused packages, a hosted runtime to a local-only product, or production deployment merely for parity. Do not rewrite published history or unrelated product behavior.
- Acceptance: A fresh cross-repository matrix shows the same version for every shared versioned package/vendor tool where compatible, identical CONTRIBUTING.md bytes, equivalent workflow and npm-script semantics for applicable capabilities, and recorded exceptions with technical reasons. No workflow invokes a missing script; every package lock matches its manifest.
- Validation: Install each public repository with its pinned toolchain and `npm ci`; run `npm run check`, focused workflow/script contract tests, `git diff --check`, exact-head CI, and the separate network/provider gates where applicable. Re-fetch every target's base and this documentation commit before merging to preserve concurrent work.

## Target process

`branch -> controlled FL commit -> PR -> npm ci -> npm run check -> exact-head CI -> squash merge -> merged-main CI -> completed-branch cleanup`

Source release:

`reviewed main -> package version -> annotated vX.Y.Z -> exact identity -> npm ci -> npm run check -> gh release create --verify-tag -> stop`

FightLab has no production deploy stage and no authority to publish a built `dist/`. That is an architectural and distribution constraint, not missing deployment automation.

## Recheck after the current queue

After the remaining open task is delivered, enter fresh planning mode only if current repository/provider evidence shows new drift. Keep gameplay tuning, licensing/asset work and product features separate from process adoption.
