import { readFileSync } from "node:fs";

import { compareRepositorySettings, type DesiredRepositorySettings, type Observation } from "./github-repository-settings.ts";
import { readLiveRepositorySettings } from "./github-settings-provider.ts";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}
function token(): string | undefined {
  return process.env.GH_ADMIN_TOKEN || process.env.GH_TOKEN || undefined;
}
function format<T>(value: Observation<T>): string {
  return value.state === "observed" ? (JSON.stringify(value.value) ?? "undefined")
    : `${value.state} (${value.reason.kind}, HTTP ${value.reason.status}): ${value.reason.message}`;
}

const desired = JSON.parse(
  readFileSync(new URL("../config/github-repository-settings.json", import.meta.url), "utf8"),
) as DesiredRepositorySettings;
const requested = argument("--repo") ?? process.env.GITHUB_REPOSITORY ?? desired.repository;
if (requested !== desired.repository) {
  throw new Error(`committed settings target ${desired.repository}; refusing unrelated repository ${requested}`);
}
const auth = token();
const live = await readLiveRepositorySettings(desired, { token: auth });
const comparisons = compareRepositorySettings(desired, live);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({
    repository: desired.repository,
    authentication: auth ? "runtime-token-present-value-redacted" : "anonymous-public-read",
    live,
    comparisons,
  }, null, 2));
} else {
  console.log(`Repository: ${desired.repository}`);
  console.log(`Authentication: ${auth ? "runtime token present (value redacted)" : "anonymous public read"}`);
  console.log(`Visibility: ${format(live.visibility)}`);
  console.log(`Default branch: ${format(live.defaultBranch)}`);
  console.log(`Main protection: ${format(live.branchProtection)}`);
  console.log(`Merge methods: ${format(live.mergeMethods)}`);
  console.log(`Delete branch on merge: ${format(live.deleteBranchOnMerge)}`);
  console.log(`Rulesets: ${format(live.rulesets)}`);
  console.log(`Releases: ${format(live.releases)}`);
  console.log("\nEndpoint reads:");
  for (const item of live.diagnostics) {
    console.log(`- ${item.state.toUpperCase()} HTTP ${item.status} ${item.endpoint}${item.kind ? ` [${item.kind}]` : ""}: ${item.message}`);
  }
  console.log("\nDesired vs observed:");
  for (const item of comparisons) console.log(`- ${item.status.toUpperCase()} ${item.key}: ${item.detail}`);
}

const blocked = comparisons.some(({ status }) => status === "inaccessible" || status === "unsupported");
const mismatch = comparisons.some(({ status }) => status === "mismatch");
process.exitCode = blocked ? 3 : mismatch ? 2 : 0;
