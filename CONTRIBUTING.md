# Contributing to FightLab

[`AGENTS.md`](AGENTS.md) is the repository contract and [`implementation_plan.md`](implementation_plan.md)
is the current/future work queue. This file is the human-facing summary of the change flow and commands;
when guidance conflicts, follow `AGENTS.md`.

## Prerequisites

FightLab consumes Boneyard through the sibling `file:../Boneyard` dependency. Keep the repositories
side by side and check out Boneyard at the commit recorded in
[`boneyard.pin.json`](boneyard.pin.json). Build Boneyard once as described in the README, then install
FightLab from its lockfile:

```text
../Boneyard
../FightLab
```

Use Node **26.9.0** and npm **11.19.1**. `.node-version` is the exact Node authority,
`package.json#packageManager` is the exact npm authority, and `.npmrc` enables strict engine
checking. The supported policy is Node 26.x / npm 11.x; CI verifies the exact committed pair before
installing the lockfile.

```bash
npm ci
```

The pin check protects the exact Boneyard inputs FightLab was verified against. Do not run
`npm run pin:boneyard` as routine setup; it deliberately rewrites the accepted pin and belongs only
to a change that is explicitly accepting new Boneyard input.

## One-task change flow

Follow the controlled loop in `AGENTS.md` rather than inventing a parallel process.

1. Re-fetch authoritative `main`, open PRs and current-head CI, then take only the first open,
   unblocked `FL-NNN` task.
2. Branch from current `main` using `fl-NNN-<kebab-summary>`. Use the task's
   `[FL-NNN] [TYPE] Summary` identity for the controlled commit and PR.
3. Make only that task's change. The same delivery removes the completed task from
   `implementation_plan.md`.
4. Run focused checks, then canonical `npm run check` and `git diff --check`. `npm run verify`
   remains a compatibility alias to the same gate.
5. Push the controlled branch and open the PR. Those are provider actions, not local validation.
6. Require the PR's exact current-head `verify` check to pass, re-fetch `main` and mergeability,
   then squash the exact validated head under the repository's provider rules. Merge commits and
   rebase merges are not controlled delivery methods.
7. Confirm one controlled commit on `main`, post-merge CI and completed-branch deletion, then
   hand off the new first task and stop.

## Command boundaries

| Command | Purpose |
| --- | --- |
| `npm run dev` | Check the Boneyard pin, clean up FightLab's local dev port and serve the game. |
| `npm run preview` | Serve the built game locally through the same safe lifecycle. |
| `npm run build` | Check the pin and create the local production build in `dist/`. |
| `npm run check:boneyard` | Verify the installed sibling Boneyard matches the committed pin. |
| `npm run typecheck` | Run TypeScript validation. |
| `npm run test` / `npm run test:watch` | Run the automated tests once / in watch mode. |
| `npm run tune` | Run local balance measurements; it is not the acceptance gate. |
| `npm run test:github-settings` | Pure, deterministic, credential-free settings normalization, comparison and bounded apply-planning cases; no provider network is required. |
| `npm run check` | Canonical credential-free acceptance: Boneyard pin, pure GitHub-settings cases, typecheck, complete automated tests (including the FL controlled-change identity/history tests), and exactly one production build. |
| `npm run verify` | Compatibility alias that delegates to `npm run check`; it is not a second acceptance pipeline. |
| `npm run verify:github-settings` | Read live GitHub repository/branch/ruleset/release metadata and compare it with `config/github-repository-settings.json`. This is networked, read-only and intentionally outside canonical `check`. |
| `npm run apply:github-settings` | The only explicit GitHub settings mutation command. It applies only committed desired policy, fails closed on unavailable required access, and independently re-reads provider state afterward. It is never part of canonical `check`. |
| `npm run pin:boneyard` | Intentionally accept the installed Boneyard state by rewriting the pin. |

## Visual changes

If a change alters what the player sees, run the game and inspect the affected output before calling
the work done. The `visual` GitHub workflow captures screenshot evidence for its configured UI/mod
paths; it supplements the required human visual check rather than replacing it.

## Security reports

[`SECURITY.md`](SECURITY.md) defines the private reporting route and the repository's secret/data boundary. Keep vulnerability details and secret values out of public channels.

## Provider, deployment and release boundary

Local commands do not push branches, open PRs, report GitHub CI, merge changes or delete remote
branches. Report those only after GitHub confirms them. The provider `verify` workflow runs canonical
`npm run check` directly for pull requests, pushes to `main` and manual dispatch while preserving
the exact pinned private Boneyard checkout. PR exact-head CI and merged-`main` CI are separate
provider evidence; confirm the workflow run attached to the actual merged SHA when both are required.

The live settings verifier uses public GitHub reads without credentials when possible. If a runtime
`GH_ADMIN_TOKEN` or `GH_TOKEN` is already present, verification may use it only for
provider reads and never prints or persists its value. The explicit apply command requires a runtime
administration-capable token, preflights required provider access before mutation, applies only the
committed desired-state surface, and requires an independent read-only recheck after writes. No token
value belongs in repository configuration or canonical acceptance. A readable mismatch, an inaccessible
setting and a genuine provider-tier limitation are separate outcomes; a pure test cannot prove live parity.

FightLab has no hosted production deployment or repository release action. `npm run build` only
creates a local `dist/`; do not publish or deploy as part of the normal contribution flow.
