import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const REPO = "SouthernGentlemen/FightLab";
const VERSION = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function assertProductionContext(env) {
  const tag = String(env.EXPECTED_TAG ?? "");
  if (env.GITHUB_ACTIONS !== "true" || env.GITHUB_EVENT_NAME !== "push" || env.GITHUB_REPOSITORY !== REPO) {
    throw new Error("production requires the FightLab GitHub tag-push workflow");
  }
  if (!/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(tag)
      || env.GITHUB_REF_TYPE !== "tag" || env.GITHUB_REF !== `refs/tags/${tag}` || env.GITHUB_REF_NAME !== tag) {
    throw new Error("production requires the exact semantic release tag from its caller");
  }
  if (!String(env.CLOUDFLARE_API_TOKEN ?? "").trim() || !String(env.CLOUDFLARE_ACCOUNT_ID ?? "").trim()) {
    throw new Error("production Cloudflare credentials are missing");
  }
  return tag;
}

export function deployedVersion(output) {
  let version;
  for (const line of String(output).split(/\r?\n/)) {
    try {
      const record = JSON.parse(line);
      if (record?.type === "deploy") version = record.version_id;
    } catch { /* Wrangler also writes plain diagnostic lines. */ }
  }
  if (typeof version !== "string" || !VERSION.test(version)) throw new Error("Wrangler did not record a deployed Version ID");
  return version;
}

export function verifyTraffic(deployments, version) {
  if (!VERSION.test(version)) throw new Error("expected Version ID is invalid");
  if (!Array.isArray(deployments) || deployments.length === 0) throw new Error("Cloudflare returned no deployments");
  const latest = deployments.at(-1);
  if (!Array.isArray(latest?.versions) || latest.versions.length !== 1 || latest.versions[0]?.version_id !== version
      || Number(latest.versions[0].percentage) !== 100) {
    throw new Error(`latest production deployment does not serve ${version} at 100%`);
  }
  return latest;
}

export async function verifyPublic(url, release, commit, fetchImpl = fetch) {
  let problem = "no response";
  for (let attempt = 0; attempt < 18; attempt++) {
    try {
      const response = await fetchImpl(url, { redirect: "error" });
      if (response.ok) {
        const data = await response.json();
        if (data.product === "fightlab" && data.release === release && data.commit === commit) return data;
        problem = "version identity mismatch";
      } else problem = `HTTP ${response.status}`;
    } catch (error) { problem = error instanceof Error ? error.message : String(error); }
    if (attempt < 17) await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error(`public version did not converge: ${problem}`);
}

async function main(args) {
  const [command, ...rest] = args;
  if (command === "context") {
    console.log(`Production context verified for ${assertProductionContext(process.env)}`);
  } else if (command === "deployed-version") {
    console.log(deployedVersion(readFileSync(rest[0], "utf8")));
  } else if (command === "provider") {
    const evidence = verifyTraffic(JSON.parse(readFileSync(rest[0], "utf8")), rest[1]);
    console.log(`Cloudflare deployment ${evidence.id} serves ${rest[1]} at 100%`);
  } else if (command === "public") {
    await verifyPublic(rest[0], rest[1], rest[2]);
    console.log(`Public release ${rest[1]} at ${rest[2]} verified`);
  } else throw new Error(`unknown production verification command: ${command}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
