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
   then merge only when the head is current and mergeable under the repository's provider rules.
7. Confirm the resulting `main` and actual branch state, hand off the new first task, and stop.

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
| `npm run check` | Canonical credential-free acceptance: Boneyard pin, typecheck, complete automated tests (including the FL controlled-change identity/history tests), and exactly one production build. |
| `npm run verify` | Compatibility alias that delegates to `npm run check`; it is not a second acceptance pipeline. |
| `npm run pin:boneyard` | Intentionally accept the installed Boneyard state by rewriting the pin. |

## Visual changes

If a change alters what the player sees, run the game and inspect the affected output before calling
the work done. The `visual` GitHub workflow captures screenshot evidence for its configured UI/mod
paths; it supplements the required human visual check rather than replacing it.

## Security reports

[`SECURITY.md`](SECURITY.md) defines the private reporting route and the repository's secret/data boundary. Keep vulnerability details and secret values out of public channels.

## Provider, deployment and release boundary

Local commands do not push branches, open PRs, report GitHub CI, merge changes or delete remote
branches. Report those only after GitHub confirms them. The current provider `verify` workflow runs for pull requests and manual dispatch and invokes the
compatibility `npm run verify` alias, which delegates to canonical `npm run check`. It still does not
run on merged `main`; do not claim merged-main CI until FL-007 changes that provider path.

FightLab has no hosted production deployment or repository release action. `npm run build` only
creates a local `dist/`; do not publish or deploy as part of the normal contribution flow.
