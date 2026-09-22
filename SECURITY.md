# Security

FightLab is a private repository and is not a hosted production service. This policy covers
security reports about the FightLab repository, its code and workflows, and the way FightLab
consumes its pinned Boneyard dependency.

## Report privately

For contributors or reporters who already have access to `SouthernGentlemen/FightLab`, open a
GitHub issue in this repository with `[SECURITY]` at the start of the title. Because the repository
is private, that issue stays inside the repository's authorized audience. Do not copy vulnerability
details into a public issue, discussion, gist, another repository, or other public channel.

Do not paste credentials, access tokens or other secret values into the report. If a suspected
exposure includes a secret, identify the kind of credential and where it was exposed without
repeating the value; revoke or rotate the credential through its provider before relying on any
repository cleanup.

If you do not have access to this private repository, contact the repository owner through an
existing private channel rather than publishing vulnerability details. FightLab does not currently
publish a separate external security mailbox or disclosure SLA.

## Repository boundary

Report here when the problem is in FightLab source, scripts, GitHub workflow usage, local build
behavior, or FightLab's integration with Boneyard. A vulnerability in Boneyard itself belongs in
the Boneyard repository; a problem caused by how FightLab consumes Boneyard belongs here.

`boneyard.pin.json` contains only the accepted Boneyard commit, digest and file count. FightLab uses
the sibling `file:../Boneyard` dependency locally, while GitHub Actions checks out the pinned
Boneyard revision with the provider-managed `BONEYARD_READ_TOKEN` secret. Do not add a second
credential path or put that token's value in this repository.

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
credentials at the provider, report the exposure through the private route above, and remove the
material from the repository or logs as part of the controlled remediation. Deleting a file from a
later commit is not a substitute for treating an exposed credential as compromised.

## Distribution boundary

[`LICENSE.md`](LICENSE.md) records the repository's distribution constraints. FightLab currently
has no hosted production deployment or repository release action, and this security policy does
not create permission to publish or redistribute a build.
