import { readFileSync } from "node:fs";

import { type DesiredRepositorySettings } from "./github-repository-settings.ts";
import { applyDesiredRepositorySettings } from "./github-settings-provider.ts";

const desired = JSON.parse(
  readFileSync(new URL("../config/github-repository-settings.json", import.meta.url), "utf8"),
) as DesiredRepositorySettings;
const token = process.env.GH_ADMIN_TOKEN || process.env.GH_TOKEN;

try {
  await applyDesiredRepositorySettings(desired, { token });
  console.log(`GitHub settings for ${desired.repository} applied and independently re-read as compliant.`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";
  if (["GITHUB_AUTH_REQUIRED", "authentication", "integration-permission", "permission"].includes(code)) {
    console.error("Use a runtime token with Repository Administration write access; token values are never printed or persisted.");
    process.exitCode = 2;
  } else {
    process.exitCode = 1;
  }
}
