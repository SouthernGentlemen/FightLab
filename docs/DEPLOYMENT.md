# FightLab production delivery

The public game is `https://fightlab.wizardgang.ai/play/`; `/play` redirects there, and
`/version.json` carries the exact semantic release tag and Git commit. Other application paths
return 404. The Worker is `fightlab`, deployed to the Cloudflare WizardGang account as a custom
domain with only static assets and the small route handler in `src/worker.ts`.

Production starts only from an annotated `vX.Y.Z` tag pushed at the accepted main commit, matching
`package.json`. `.github/workflows/release.yml` checks that source, runs canonical acceptance,
and publishes a source-only GitHub Release. It then calls the reusable deploy workflow for the
same tag. The `production` environment requires owner review and permits only `v*` tags.
The deploy job verifies the existing Release and source identity, rebuilds the original art and
motion lane, publishes through Wrangler, requires the just uploaded Worker Version ID to serve
100% of traffic in authenticated Cloudflare deployment state, and checks public `/version.json`.

Provider setup on 2026-09-24:

- GitHub `SouthernGentlemen/FightLab` `production` environment created with required reviewer
  `SouthernGentlemen` and a `v*` tag allowlist.
- `CLOUDFLARE_ACCOUNT_ID` stored as a protected environment secret for the WizardGang account.
- `CLOUDFLARE_API_TOKEN` must be set in that same environment before first production deployment.
  Its value must never be committed or placed in logs. An existing token with Workers Scripts and
  Routes edit access to the account is sufficient; no rotation is required merely for this repo.

A local `npm run deploy:production:dry-run` builds and validates Wrangler configuration without
publishing. Ordinary branch pushes and local commands do not deploy production. To recover a
release, inspect the failed tag workflow and rerun its failed job after correcting the protected
secret or approval. Do not move or recreate an existing release tag.
