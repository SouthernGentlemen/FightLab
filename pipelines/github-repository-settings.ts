export const MAIN_RULESET_NAME = "main-protection";
export const RELEASE_TAG_RULESET_NAME = "release-tag-immutability";

export type MergeMethod = "merge" | "rebase" | "squash";
export type UnavailableState = "inaccessible" | "unsupported";
export type ProviderFailureKind =
  | "authentication"
  | "integration-permission"
  | "permission"
  | "field-unavailable"
  | "provider-tier"
  | "provider-error";

export interface DesiredRepositorySettings {
  readonly schemaVersion: number;
  readonly policyKind: string;
  readonly repository: string;
  readonly defaultBranch: string;
  readonly deleteBranchOnMerge: boolean;
  readonly branchProtection: {
    readonly branch: string;
    readonly protected: boolean;
    readonly requireBranchUpToDate: boolean;
    readonly requiredChecks: readonly { readonly name: string; readonly command: string }[];
  };
  readonly merge: {
    readonly allowedMethods: readonly MergeMethod[];
    readonly singleCommit: boolean;
  };
  readonly releaseTags: {
    readonly pattern: string;
    readonly immutable: boolean;
    readonly appliesWhenReleasePublished: boolean;
  };
}

export interface ProviderFailure {
  readonly state: UnavailableState;
  readonly kind: ProviderFailureKind;
  readonly endpoint: string;
  readonly status: number;
  readonly message: string;
}

export type Observation<T> =
  | { readonly state: "observed"; readonly value: T }
  | { readonly state: UnavailableState; readonly reason: ProviderFailure };

export interface RepositorySnapshot {
  readonly visibility: string;
  readonly defaultBranch: string;
  readonly mergeMethods: readonly MergeMethod[] | null;
  readonly deleteBranchOnMerge: boolean | null;
}

export interface BranchProtectionSnapshot {
  readonly protected: boolean;
  readonly requiredChecks: readonly string[];
}

export interface RulesetSnapshot {
  readonly count: number;
  readonly immutableVTags: boolean;
  readonly matchingRuleIds: readonly (number | string)[];
}

export interface ReleaseSnapshot {
  readonly count: number;
  readonly tags: readonly string[];
}

export interface EndpointDiagnostic {
  readonly endpoint: string;
  readonly status: number;
  readonly state: "observed" | UnavailableState;
  readonly kind?: ProviderFailureKind;
  readonly message: string;
}

export interface LiveRepositorySettings {
  readonly visibility: Observation<string>;
  readonly defaultBranch: Observation<string>;
  readonly branchProtection: Observation<BranchProtectionSnapshot>;
  readonly mergeMethods: Observation<readonly MergeMethod[]>;
  readonly deleteBranchOnMerge: Observation<boolean>;
  readonly rulesets: Observation<RulesetSnapshot>;
  readonly releases: Observation<ReleaseSnapshot>;
  readonly diagnostics: readonly EndpointDiagnostic[];
}

export type ComparisonStatus = "match" | "mismatch" | UnavailableState;
export interface SettingsComparison {
  readonly key:
    | "defaultBranch"
    | "mainProtected"
    | "requiredChecks"
    | "mergeMethods"
    | "singleCommit"
    | "deleteBranchOnMerge"
    | "releaseTags";
  readonly status: ComparisonStatus;
  readonly desired: unknown;
  readonly observed: unknown;
  readonly detail: string;
}

export interface ApplyPlan {
  readonly repositoryPatch: Readonly<Record<string, unknown>>;
  readonly rulesets: readonly Readonly<Record<string, unknown>>[];
}

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : {};
}
function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
function bool(value: unknown): boolean { return value === true; }
function sortedUnique(values: readonly string[]): string[] { return [...new Set(values)].sort(); }
function sameValues(actual: readonly string[], expected: readonly string[]): boolean {
  return JSON.stringify(sortedUnique(actual)) === JSON.stringify(sortedUnique(expected));
}

export function observed<T>(value: T): Observation<T> { return { state: "observed", value }; }
export function unavailable<T>(failure: ProviderFailure): Observation<T> {
  return { state: failure.state, reason: failure };
}

export function classifyProviderFailure(endpoint: string, status: number, message: string): ProviderFailure {
  if (status === 403 && /upgrade to github pro|make this repository public|upgrade (?:the |your )?plan/i.test(message)) {
    return { state: "unsupported", kind: "provider-tier", endpoint, status, message };
  }
  if (status === 403 && /resource not accessible by integration/i.test(message)) {
    return { state: "inaccessible", kind: "integration-permission", endpoint, status, message };
  }
  if (status === 401) return { state: "inaccessible", kind: "authentication", endpoint, status, message };
  if (status === 403) return { state: "inaccessible", kind: "permission", endpoint, status, message };
  return { state: "inaccessible", kind: "provider-error", endpoint, status, message };
}

export function repositoryApiSnapshot(value: unknown): RepositorySnapshot {
  const input = record(value);
  const mergeFields = [input.allow_merge_commit, input.allow_rebase_merge, input.allow_squash_merge];
  const methods: MergeMethod[] = [];
  if (bool(input.allow_merge_commit)) methods.push("merge");
  if (bool(input.allow_rebase_merge)) methods.push("rebase");
  if (bool(input.allow_squash_merge)) methods.push("squash");
  return {
    visibility: typeof input.visibility === "string" ? input.visibility : "unknown",
    defaultBranch: typeof input.default_branch === "string" ? input.default_branch : "",
    mergeMethods: mergeFields.every((field) => typeof field === "boolean") ? methods : null,
    deleteBranchOnMerge: typeof input.delete_branch_on_merge === "boolean" ? input.delete_branch_on_merge : null,
  };
}

function requiredChecks(value: unknown): string[] {
  const statusChecks = record(value);
  const contexts = strings(statusChecks.contexts);
  const checks = Array.isArray(statusChecks.checks)
    ? statusChecks.checks.flatMap((item) => {
        const context = record(item).context;
        return typeof context === "string" ? [context] : [];
      })
    : [];
  return sortedUnique([...contexts, ...checks]);
}

export function branchApiSnapshot(value: unknown): BranchProtectionSnapshot {
  const input = record(value);
  return {
    protected: bool(input.protected),
    requiredChecks: requiredChecks(record(input.protection).required_status_checks),
  };
}
export function protectionApiSnapshot(value: unknown): BranchProtectionSnapshot {
  return { protected: true, requiredChecks: requiredChecks(record(value).required_status_checks) };
}

function refPatternCoversVTags(pattern: string): boolean {
  return pattern === "~ALL" || pattern === "v*" || pattern === "refs/tags/*"
    || pattern === "refs/tags/**" || pattern === "refs/tags/v*";
}
function rulesetProtectsVTags(value: unknown): boolean {
  const input = record(value);
  if (input.enforcement !== "active" || input.target !== "tag") return false;
  const refName = record(record(input.conditions).ref_name);
  if (!strings(refName.include).some(refPatternCoversVTags)) return false;
  const types = new Set(Array.isArray(input.rules)
    ? input.rules.flatMap((item) => typeof record(item).type === "string" ? [record(item).type as string] : [])
    : []);
  return types.has("deletion") && (types.has("update") || types.has("non_fast_forward"));
}
export function rulesetsApiSnapshot(value: unknown): RulesetSnapshot {
  const rulesets = Array.isArray(value) ? value : [];
  const matching = rulesets.filter(rulesetProtectsVTags);
  return {
    count: rulesets.length,
    immutableVTags: matching.length > 0,
    matchingRuleIds: matching.flatMap((item) => {
      const id = record(item).id;
      return typeof id === "number" || typeof id === "string" ? [id] : [];
    }),
  };
}
export function releasesApiSnapshot(value: unknown): ReleaseSnapshot {
  const releases = Array.isArray(value) ? value : [];
  return {
    count: releases.length,
    tags: releases.flatMap((item) => typeof record(item).tag_name === "string" ? [record(item).tag_name as string] : []),
  };
}

function unavailableComparison(
  key: SettingsComparison["key"],
  desired: unknown,
  observation: Exclude<Observation<unknown>, { state: "observed" }>,
): SettingsComparison {
  return {
    key,
    status: observation.state,
    desired,
    observed: null,
    detail: `${observation.reason.kind}: HTTP ${observation.reason.status} ${observation.reason.message}`,
  };
}
function simpleComparison<T>(
  key: SettingsComparison["key"],
  desired: unknown,
  observation: Observation<T>,
  matches: (actual: T) => boolean,
): SettingsComparison {
  if (observation.state !== "observed") return unavailableComparison(key, desired, observation);
  const match = matches(observation.value);
  return {
    key,
    status: match ? "match" : "mismatch",
    desired,
    observed: observation.value,
    detail: match ? "live provider state matches desired policy" : "live provider state differs from desired policy",
  };
}

export function compareRepositorySettings(
  desired: DesiredRepositorySettings,
  live: LiveRepositorySettings,
): readonly SettingsComparison[] {
  const desiredChecks = sortedUnique(desired.branchProtection.requiredChecks.map(({ name }) => name));
  const desiredMethods = sortedUnique(desired.merge.allowedMethods);
  const defaultBranch = simpleComparison("defaultBranch", desired.defaultBranch, live.defaultBranch,
    (actual) => actual === desired.defaultBranch);

  let mainProtected: SettingsComparison;
  let required: SettingsComparison;
  if (live.branchProtection.state !== "observed") {
    mainProtected = unavailableComparison("mainProtected", desired.branchProtection.protected, live.branchProtection);
    required = unavailableComparison("requiredChecks", desiredChecks, live.branchProtection);
  } else {
    mainProtected = simpleComparison("mainProtected", desired.branchProtection.protected, live.branchProtection,
      (actual) => actual.protected === desired.branchProtection.protected);
    required = simpleComparison("requiredChecks", desiredChecks, live.branchProtection,
      (actual) => sameValues(actual.requiredChecks, desiredChecks));
  }

  const mergeMethods = simpleComparison("mergeMethods", desiredMethods, live.mergeMethods,
    (actual) => sameValues(actual, desiredMethods));
  let singleCommit: SettingsComparison;
  if (live.mergeMethods.state !== "observed") {
    singleCommit = unavailableComparison("singleCommit", desired.merge.singleCommit, live.mergeMethods);
  } else {
    const actual = sortedUnique(live.mergeMethods.value);
    const enforced = actual.length === 1 && actual[0] === "squash";
    singleCommit = {
      key: "singleCommit",
      status: enforced === desired.merge.singleCommit ? "match" : "mismatch",
      desired: desired.merge.singleCommit,
      observed: enforced,
      detail: enforced === desired.merge.singleCommit
        ? "live merge methods enforce the desired single-commit policy"
        : "live merge methods do not enforce the desired single-commit policy",
    };
  }

  const deleteBranchOnMerge = simpleComparison(
    "deleteBranchOnMerge",
    desired.deleteBranchOnMerge,
    live.deleteBranchOnMerge,
    (actual) => actual === desired.deleteBranchOnMerge,
  );

  let releaseTags: SettingsComparison;
  if (live.rulesets.state !== "observed") {
    releaseTags = unavailableComparison("releaseTags", desired.releaseTags, live.rulesets);
  } else {
    const actual = {
      pattern: desired.releaseTags.pattern,
      immutable: live.rulesets.value.immutableVTags,
      appliesWhenReleasePublished: live.rulesets.value.immutableVTags,
      matchingRuleIds: live.rulesets.value.matchingRuleIds,
    };
    const match = actual.immutable === desired.releaseTags.immutable
      && actual.appliesWhenReleasePublished === desired.releaseTags.appliesWhenReleasePublished;
    releaseTags = {
      key: "releaseTags",
      status: match ? "match" : "mismatch",
      desired: desired.releaseTags,
      observed: actual,
      detail: match
        ? "an active tag ruleset prevents update and deletion for v-prefixed tags"
        : "no active tag ruleset proves immutable published v-prefixed release tags",
    };
  }
  return [defaultBranch, mainProtected, required, mergeMethods, singleCommit, deleteBranchOnMerge, releaseTags];
}

function mergeFlags(methods: readonly MergeMethod[]): Record<string, boolean> {
  return {
    allow_merge_commit: methods.includes("merge"),
    allow_squash_merge: methods.includes("squash"),
    allow_rebase_merge: methods.includes("rebase"),
  };
}

export function mainRulesetPayload(desired: DesiredRepositorySettings): Readonly<Record<string, unknown>> {
  const checks = desired.branchProtection.requiredChecks.map(({ name }) => ({ context: name }));
  return {
    name: MAIN_RULESET_NAME,
    target: "branch",
    enforcement: desired.branchProtection.protected ? "active" : "disabled",
    bypass_actors: [],
    conditions: { ref_name: { include: [`refs/heads/${desired.branchProtection.branch}`], exclude: [] } },
    rules: desired.branchProtection.protected ? [
      { type: "deletion" },
      { type: "non_fast_forward" },
      {
        type: "pull_request",
        parameters: {
          allowed_merge_methods: [...desired.merge.allowedMethods],
          dismiss_stale_reviews_on_push: false,
          require_code_owner_review: false,
          require_last_push_approval: false,
          required_approving_review_count: 0,
          required_review_thread_resolution: false,
        },
      },
      {
        type: "required_status_checks",
        parameters: {
          do_not_enforce_on_create: true,
          required_status_checks: checks,
          strict_required_status_checks_policy: desired.branchProtection.requireBranchUpToDate,
        },
      },
    ] : [],
  };
}

export function releaseTagRulesetPayload(desired: DesiredRepositorySettings): Readonly<Record<string, unknown>> {
  return {
    name: RELEASE_TAG_RULESET_NAME,
    target: "tag",
    enforcement: desired.releaseTags.immutable ? "active" : "disabled",
    bypass_actors: [],
    conditions: { ref_name: { include: [`refs/tags/${desired.releaseTags.pattern}`], exclude: [] } },
    rules: desired.releaseTags.immutable ? [{ type: "deletion" }, { type: "update" }] : [],
  };
}

export function buildApplyPlan(desired: DesiredRepositorySettings): ApplyPlan {
  return {
    repositoryPatch: {
      default_branch: desired.defaultBranch,
      ...mergeFlags(desired.merge.allowedMethods),
      delete_branch_on_merge: desired.deleteBranchOnMerge,
    },
    rulesets: [mainRulesetPayload(desired), releaseTagRulesetPayload(desired)],
  };
}
