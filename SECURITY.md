# Security

FightLab is currently a public source repository and is not a hosted production service. This policy
covers security reports about the FightLab repository, its code and workflows, and the way FightLab
consumes its pinned Boneyard dependency.

## Report privately

Do not put vulnerability details, exploit instructions, credentials or other sensitive material in a
public GitHub issue, discussion, gist or pull request. Contact the repository owner through an existing
private channel first. FightLab does not currently publish a separate external security mailbox or
disclosure SLA.

If a suspected exposure includes a secret, identify the kind of credential and where it was exposed
without repeating the value; revoke or rotate the credential through its provider before relying on
repository cleanup.

## Repository boundary

Report here when the problem is in FightLab source, scripts, GitHub workflow usage, local build
behavior, or FightLab's integration with Boneyard. A vulnerability in Boneyard itself belongs in the
Boneyard repository; a problem caused by how FightLab consumes Boneyard belongs here.

`boneyard.pin.json` contains only the accepted Boneyard commit, digest and file count. FightLab uses
the sibling `file:../Boneyard` dependency locally, while GitHub Actions checks out the pinned
Boneyard revision with the provider-managed `BONEYARD_READ_TOKEN` secret. Do not add a second
credential path or put that token's value in this repository.

The pure `test:github-settings` contract is credential-free and may run inside canonical
`npm run check`. The live `verify:github-settings` command remains read-only and outside canonical
acceptance; it uses unauthenticated public reads when possible and may use an already-present runtime
`GH_ADMIN_TOKEN` or `GH_TOKEN`. `apply:github-settings` is the only explicit settings
mutation command: it requires a runtime administration-capable token, fails closed when required
provider access is unavailable, applies only the committed desired-state surface and independently
re-reads provider state after writes. Neither live path prints or stores token values. A permission
failure is not evidence of a provider-plan limitation.

## Secrets and private data

Never commit:

- GitHub tokens, Boneyard access credentials, passwords, API keys, cookies or other authentication
  material;
- real/local game saves, private catalog exports or other user-specific runtime data;
- absolute machine-private paths, home-directory details, local credential files or environment
  configuration that belongs to one workstation;
- logs, screenshots or fixtures that contain any of the above.

The checked-in `.gitignore` currently covers dependencies, build output, logs and `.DS_Store`; it is
not a secret scanner or a permission boundary. A path being unignored does not make it safe to
commit. Documented relative paths and generic examples are fine; machine-specific private values
are not.

If sensitive material is committed or appears in CI output, stop sharing it, rotate/revoke affected
credentials at the provider, report the exposure privately, and remove the material from the
repository or logs as part of the controlled remediation. Deleting a file from a later commit is not
a substitute for treating an exposed credential as compromised.

## Distribution boundary

[`LICENSE.md`](LICENSE.md) records the repository's distribution constraints. FightLab currently has
no hosted production deployment or repository release action, and this security policy does not
create permission to publish or redistribute a build.
