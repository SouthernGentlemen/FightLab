import { describe, expect, it } from "vitest";

import {
  CONTROLLED_TYPES,
  FIRST_CONTROLLED_SHA,
  LEGACY_HISTORY_TIP,
  type CommitRecord,
  validateControlledHistory,
} from "../pipelines/change-identity.ts";

function message(subject: string, values: readonly string[]): string {
  const fields = ["Change", "Reason", "Impact", "Risk", "Controls", "Validation", "Evidence", "Source"];
  return [subject, "", ...fields.flatMap((field, index) => [`${field}:`, values[index], ""])].join("\n").trimEnd();
}

const ACCEPTED_HISTORY: readonly CommitRecord[] = [
  {
    sha: LEGACY_HISTORY_TIP,
    parents: [],
    message: "Merge branch 'main' of https://github.com/SouthernGentlemen/FightLab",
  },
  {
    sha: FIRST_CONTROLLED_SHA,
    parents: [LEGACY_HISTORY_TIP],
    message: message("[FL-001] [DOCS] Start process parity queue", [
      "Retire the completed mod-catalogue task ledger and establish an eight-task current/future process-parity queue with current authority links.",
      "The 64-mod Mix Up work has landed; the historical implementation plan no longer describes open work or the desired organization process.",
      "Planning and documentation only; no game, asset, provider, release or deployment mutation.",
      "Low",
      "Preserve built gameplay and pinned Boneyard input. Legacy unnumbered Git history remains immutable. Future FL IDs are prospective.",
      "npm run verify passed 362 tests and production build on standalone rerun; git diff --check passed. Exact-head CI pending.",
      "implementation_plan.md; AGENTS.md; README.md; docs/RUN_PLAN.md; current main 9904541df5f99d239cf02bd6a568e02a05c749f8.",
      "WG-ARCH-001 section 27 and landed Mix Up main.",
    ]),
  },
  {
    sha: "ce55b893dd2a4eebc83a8185b61fe716d62a71c8",
    parents: [FIRST_CONTROLLED_SHA],
    message: message("[FL-002] [DOCS] Establish the one-task controlled development loop", [
      "Define the one-task controlled development loop in AGENTS.md and retire FL-002 from the active queue.",
      "FightLab needs an explicit current/future process contract for do needful, first-open selection, same-delivery purge, provider truthfulness and one-turn handoff.",
      "Documentation and planning only; gameplay, the Boneyard pin and CI are unchanged.",
      "Low",
      "Preserve the landed Mix Up catalogue and existing provider workflow. Do not infer merged-main CI before FL-007.",
      "Exact-head verify run #166 passed npm run verify; git diff --check passed on the controlled documentation patch.",
      "AGENTS.md; implementation_plan.md; PR #53; controlled head 7acd047e322514847f987f39123b8f33c558ad78.",
      "FL-002; WG-ARCH-001 section 27.",
    ]),
  },
  {
    sha: "30517d256e4e1cb9f90a10f0e4f419206ae0fe7f",
    parents: ["ce55b893dd2a4eebc83a8185b61fe716d62a71c8"],
    message: message("[FL-003] [DOCS] Add human contribution and command guidance", [
      "Add concise human contribution and command guidance, align README and AGENTS references, and retire FL-003 from the active queue.",
      "Contributors need one current-state guide that distinguishes local commands, acceptance, visual verification and provider actions without duplicating the AGENTS contract.",
      "Documentation and planning only; gameplay, npm scripts, Boneyard pin, CI, deployment and release behavior are unchanged.",
      "Low",
      "Keep AGENTS.md authoritative, preserve the sibling pinned Boneyard dependency, document verify as the temporary acceptance umbrella, and make provider/release boundaries explicit.",
      "Exact-head verify run #167 passed npm run verify; the generated documentation diff is clean of whitespace/conflict-marker errors.",
      "CONTRIBUTING.md; README.md; AGENTS.md; implementation_plan.md; PR #54; controlled head 2a8a4735227a75028f09f8ee8ebe10f15b9b580c.",
      "FL-003; WG-ARCH-001 section 27.",
    ]),
  },
  {
    sha: "e654530727ac1a771699910a8993f332c67053a0",
    parents: ["30517d256e4e1cb9f90a10f0e4f419206ae0fe7f"],
    message: message("[FL-004] [SEC] Add a security-reporting and secret boundary", [
      "Add FightLab's private security-reporting and secret/data boundary, link it from contributor guidance, and retire FL-004 from the active queue.",
      "The private repository needs a truthful reporting route and explicit rules for credentials, local data and machine-private material.",
      "Documentation and planning only; gameplay, license terms, Boneyard pin, provider secrets, CI and release/deployment behavior are unchanged.",
      "Low",
      "Use the private repository issue route for authorized reporters, never publish secret values, preserve the existing pinned sibling Boneyard model, and avoid unsupported security-service claims.",
      "Exact-head verify run #168 passed npm run verify; documentation/link review matched current repository/provider state; generated diff passed whitespace/conflict-marker validation.",
      "SECURITY.md; CONTRIBUTING.md; AGENTS.md; implementation_plan.md; PR #55; controlled head 80b9f37bffc8cc5fff6a0e7f4876ddc333678042.",
      "FL-004; WG-ARCH-001 section 27.",
    ]),
  },
  {
    sha: "4a45c0d6d90562661301d3d16c12cef9f3595e31",
    parents: ["e654530727ac1a771699910a8993f332c67053a0"],
    message: message("[FL-005] [TEST] Validate prospective FL change identities", [
      "Add a pure prospective FL identity validator with focused real-history and invalid-case tests, define the immutable cutover/type vocabulary, and retire FL-005 from the active queue.",
      "Future controlled changes need deterministic guards for sequential IDs, subject identity, primary type and structured body without rewriting legacy history.",
      "Validation and process-contract coverage only; gameplay, Boneyard pin, npm scripts, CI workflows and provider settings are unchanged.",
      "Low",
      "Anchor validation after legacy tip 9904541df5f99d239cf02bd6a568e02a05c749f8, keep pre-cutover history excluded, and keep the validator pure and credential-free.",
      "Exact-head verify run #169 passed npm run verify, including the focused identity tests; isolated validator behavior and TypeScript syntax checks passed; the exact branch diff passed whitespace/conflict-marker validation.",
      "pipelines/change-identity.ts; tests/change-identity.test.ts; AGENTS.md; implementation_plan.md; PR #56; controlled head a89d07a4f3965dbdd68373d7ab16fbae186ee324.",
      "FL-005; WG-ARCH-001 section 27.",
    ]),
  },
  {
    sha: "380d4812bdff1d1135dea5c76a14ba27d4f5de55",
    parents: ["4a45c0d6d90562661301d3d16c12cef9f3595e31"],
    message: message("[FL-006] [BUILD] Make check the canonical credential-free gate", [
      "Make npm run check the single credential-free acceptance gate, keep npm run verify as a compatibility alias, extend the pure accepted-history fixture through merged FL-005, add a focused command-contract test, align current command guidance, and retire FL-006 from the active queue.",
      "FightLab needs one acceptance composition that cannot drift while preserving the existing Boneyard pin, typecheck, complete automated suite, controlled-change identity validation and one production build.",
      "Build and process validation only; gameplay, product behavior, the Boneyard pin, CI workflow files, provider settings, deployment and release behavior are unchanged.",
      "Low",
      "Reuse the FL-005 pure identity validator through the complete test suite, keep provider actions distinct from local acceptance, leave the current shallow verify workflow unchanged for FL-007, and invoke the production build exactly once through vite build.",
      "Exact-head verify run #170 passed the compatibility verify alias through canonical check: one Boneyard pin check, one typecheck, 48 test files / 370 tests including identity/history and command-contract coverage, and one production vite build.",
      "package.json; tests/check-contract.test.ts; tests/change-identity.test.ts; AGENTS.md; CONTRIBUTING.md; README.md; implementation_plan.md; PR #57; controlled head 4d12bcc8e182f9d05fe619640eeadb2f3960659e.",
      "FL-006; WG-ARCH-001 section 27.",
    ]),
  },

  {
    sha: "f5fea082409dac853b41252971b49f9b02412b15",
    parents: ["380d4812bdff1d1135dea5c76a14ba27d4f5de55"],
    message: message("[FL-007] [BUILD] Run canonical acceptance on PRs and main", [
      "Run the provider verify workflow on pull requests, pushes to main and manual dispatch, invoke canonical npm run check directly, preserve the exact private Boneyard checkout, add focused workflow-contract coverage, extend accepted FL history through merged FL-006, align provider guidance, and retire FL-007 from the active queue.",
      "FightLab needs the same canonical acceptance command on exact PR heads and actual merged main commits instead of a PR-only provider path through the compatibility verify alias.",
      "CI and process-validation behavior only; gameplay, product behavior, the Boneyard pin, visual workflow, provider settings, deployment and release behavior are unchanged.",
      "Low",
      "Keep the existing shallow FightLab checkout because canonical check uses pure credential-free history fixtures rather than live-history scanning, preserve npm ci and the pinned private Boneyard token boundary, run npm run check directly, and keep visual evidence separate.",
      "Exact-head verify run #171 passed direct npm run check: pinned private Boneyard checkout and npm ci succeeded, 49 test files / 372 tests passed including controlled-history and workflow-contract coverage, and exactly one production vite build ran.",
      ".github/workflows/verify.yml; tests/workflow-contract.test.ts; tests/change-identity.test.ts; AGENTS.md; CONTRIBUTING.md; implementation_plan.md; PR #58; controlled head 6df45429e71d5ce40fc6150d09dfc78dd52e8134.",
      "FL-007; WG-ARCH-001 section 27.",
    ]),
  },
];

function withSubject(record: CommitRecord, subject: string): CommitRecord {
  return { ...record, message: record.message.replace(/^[^\n]+/, subject) };
}

function validCandidate(id: number, type: string): CommitRecord {
  const number = String(id).padStart(3, "0");
  return {
    sha: `candidate-${number}`,
    parents: [ACCEPTED_HISTORY.at(-1)!.sha],
    message: message(`[FL-${number}] [${type}] Validate candidate`, [
      "Validate the next controlled identity.",
      "Prospective history needs a deterministic guard.",
      "Tests only.",
      "Low",
      "Keep legacy history outside the controlled range.",
      "Focused tests pass.",
      "Synthetic candidate fixture.",
      `FL-${number}.`,
    ]),
  };
}

describe("prospective FL change identities", () => {
  it("accepts the real FL-001 through FL-007 history after the exact immutable cutover", () => {
    const result = validateControlledHistory(ACCEPTED_HISTORY);
    expect(result.errors).toEqual([]);
    expect(result.controlled.map(({ sha, id }) => [sha, id])).toEqual([
      [FIRST_CONTROLLED_SHA, 1],
      ["ce55b893dd2a4eebc83a8185b61fe716d62a71c8", 2],
      ["30517d256e4e1cb9f90a10f0e4f419206ae0fe7f", 3],
      ["e654530727ac1a771699910a8993f332c67053a0", 4],
      ["4a45c0d6d90562661301d3d16c12cef9f3595e31", 5],
      ["380d4812bdff1d1135dea5c76a14ba27d4f5de55", 6],
      ["f5fea082409dac853b41252971b49f9b02412b15", 7],
    ]);
  });

  it("accepts FL-008 as the next valid controlled identity", () => {
    expect(validateControlledHistory([...ACCEPTED_HISTORY, validCandidate(8, "TEST")]).errors).toEqual([]);
  });

  it("requires the exact immutable legacy cutover", () => {
    expect(validateControlledHistory(ACCEPTED_HISTORY.slice(1)).errors).toEqual([
      `missing immutable legacy cutover ${LEGACY_HISTORY_TIP}`,
    ]);
  });

  it("rejects duplicate and skipped ids", () => {
    const duplicate = ACCEPTED_HISTORY.map((record, index) =>
      index === 3 ? withSubject(record, "[FL-002] [DOCS] Duplicate") : record);
    expect(validateControlledHistory(duplicate).errors).toContain("FL-002: duplicate controlled id");

    const gap = [...ACCEPTED_HISTORY.slice(0, 3), withSubject(ACCEPTED_HISTORY[3], "[FL-004] [DOCS] Gap")];
    expect(validateControlledHistory(gap).errors).toContain("FL-004: expected FL-003");
  });

  it("rejects malformed subjects and multiple or invalid primary types", () => {
    const malformed = ACCEPTED_HISTORY.map((record, index) =>
      index === 2 ? withSubject(record, "[FL-002][DOCS] Missing spaces") : record);
    expect(validateControlledHistory(malformed).errors).toContain(`${ACCEPTED_HISTORY[2].sha}: malformed controlled subject`);

    const multiple = ACCEPTED_HISTORY.map((record, index) =>
      index === 2 ? withSubject(record, "[FL-002] [DOCS] [TEST] Multiple types") : record);
    expect(validateControlledHistory(multiple).errors).toContain("FL-002: subject must contain exactly one primary type");

    const invalid = ACCEPTED_HISTORY.map((record, index) =>
      index === 2 ? withSubject(record, "[FL-002] [FEATURE] Invalid type") : record);
    expect(validateControlledHistory(invalid).errors).toContain("FL-002: invalid primary type FEATURE");
    expect(CONTROLLED_TYPES).toEqual(["BUILD", "DOCS", "FIX", "OPS", "REFACTOR", "SEC", "TEST"]);
  });

  it("rejects a missing required body section", () => {
    const missing = ACCEPTED_HISTORY.map((record, index) => index === 4 ? {
      ...record,
      message: record.message.replace(/\nEvidence:\n[^\n]+\n/, "\n"),
    } : record);
    expect(validateControlledHistory(missing).errors).toContain("FL-004: expected exactly one Evidence: body field");
  });

  it("excludes all legacy history before the cutover instead of reconstructing it", () => {
    const legacy: CommitRecord = {
      sha: "legacy-malformed",
      parents: [],
      message: "tasks-049 had no FL subject or structured body",
    };
    expect(validateControlledHistory([legacy, ...ACCEPTED_HISTORY]).errors).toEqual([]);
  });
});
