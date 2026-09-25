import assert from "node:assert/strict";
import test from "node:test";
import { assertProductionContext, deployedVersion, verifyTraffic } from "./production-deployment.mjs";

const version = "12345678-1234-1234-1234-123456789abc";
const good = {
  GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "push", GITHUB_REPOSITORY: "SouthernGentlemen/FightLab",
  GITHUB_REF_TYPE: "tag", GITHUB_REF: "refs/tags/v0.1.0", GITHUB_REF_NAME: "v0.1.0",
  EXPECTED_TAG: "v0.1.0", CLOUDFLARE_API_TOKEN: "fixture", CLOUDFLARE_ACCOUNT_ID: "fixture",
};

test("production requires the release tag event and environment credentials", () => {
  assert.equal(assertProductionContext(good), "v0.1.0");
  for (const changed of [
    { GITHUB_ACTIONS: "false" }, { GITHUB_EVENT_NAME: "workflow_dispatch" }, { GITHUB_REPOSITORY: "someone/FightLab" },
    { GITHUB_REF: "refs/heads/main" }, { GITHUB_REF_NAME: "v0.2.0" }, { EXPECTED_TAG: "v0.2.0" },
    { CLOUDFLARE_API_TOKEN: "" }, { CLOUDFLARE_ACCOUNT_ID: "" },
  ]) assert.throws(() => assertProductionContext({ ...good, ...changed }));
});

test("provider evidence ties the just uploaded version to all live traffic", () => {
  assert.equal(deployedVersion(`noise\n${JSON.stringify({ type: "deploy", version_id: version })}\n`), version);
  assert.equal(verifyTraffic([{ id: "one", versions: [{ version_id: version, percentage: 100 }] }], version).id, "one");
  assert.throws(() => verifyTraffic([{ versions: [{ version_id: version, percentage: 10 }] }], version));
  assert.throws(() => verifyTraffic([{ versions: [{ version_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", percentage: 100 }] }], version));
});
