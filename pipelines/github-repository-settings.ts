export interface DesiredRepositorySettings {
  readonly schemaVersion: number;
  readonly policyKind: string;
  readonly defaultBranch: string;
  readonly branchProtection: {
    readonly branch: string;
    readonly protected: boolean;
    readonly requiredChecks: readonly {
      readonly name: string;
      readonly command: string;
    }[];
  };
  readonly merge: {
    readonly allowedMethods: readonly string[];
    readonly singleCommit: boolean;
  };
  readonly releaseTags: {
    readonly pattern: string;
    readonly immutable: boolean;
    readonly appliesWhenReleasePublished: boolean;
  };
}

export type MergeMethod = "merge" | "rebase" | "squash";
export type UnavailableState = "inaccessible" | "unsupported";
export type ProviderFailureKind =
  | "authentication"
  | "integration-permission"
  | "permission"
  | "field-unavailable"
  | "provider-tier"
  | "provider-error";

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
    | "releaseTags";
  readonly status: ComparisonStatus;
  readonly desired: unknown;
  readonly observed: unknown;
  readonly detail: string;
}

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function bool(value: unknown): boolean {
  return value === true;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

export function observed<T>(value: T): Observation<T> {
  return { state: "observed", value };
}

export function unavailable<T>(failure: ProviderFailure): Observation<T> {
  return { state: failure.state, reason: failure };
}

export function classifyProviderFailure(endpoint: string, status: number, message: string): ProviderFailure {
  if (
    status === 403
    && /upgrade to github pro|make this repository public|upgrade (?:the |your )?plan/i.test(message)
  ) {
    return { state: "unsupported", kind: "provider-tier", endpoint, status, message };
  }
  if (status === 403 && /resource not accessible by integration/i.test(message)) {
    return { state: "inaccessible", kind: "integration-permission", endpoint, status, message };
  }
  if (status === 401) {
    return { state: "inaccessible", kind: "authentication", endpoint, status, message };
  }
  if (status === 403) {
    return { state: "inaccessible", kind: "permission", endpoint, status, message };
  }
  return { state: "inaccessible", kind: "provider-error", endpoint, status, message };
}

export function repositoryApiSnapshot(value: unknown): RepositorySnapshot {
  const input = record(value);
  const mergeFields = [
    input.allow_merge_commit,
    input.allow_rebase_merge,
    input.allow_squash_merge,
  ];
  const methods: MergeMethod[] = [];
  if (bool(input.allow_merge_commit)) methods.push("merge");
  if (bool(input.allow_rebase_merge)) methods.push("rebase");
  if (bool(input.allow_squash_merge)) methods.push("squash");
  return {
    visibility: typeof input.visibility === "string" ? input.visibility : "unknown",
    defaultBranch: typeof input.default_branch === "string" ? input.default_branch : "",
    mergeMethods: mergeFields.every((field) => typeof field === "boolean") ? methods : null,
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
  const protection = record(input.protection);
  return {
    protected: bool(input.protected),
    requiredChecks: requiredChecks(protection.required_status_checks),
  };
}

export function protectionApiSnapshot(value: unknown): BranchProtectionSnapshot {
  const input = record(value);
  return {
    protected: true,
    requiredChecks: requiredChecks(input.required_status_checks),
  };
}

function refPatternCoversVTags(pattern: string): boolean {
  return pattern === "~ALL"
    || pattern === "v*"
    || pattern === "refs/tags/*"
    || pattern === "refs/tags/**"
    || pattern === "refs/tags/v*";
}

function rulesetProtectsVTags(value: unknown): boolean {
  const input = record(value);
  if (input.enforcement !== "active" || input.target !== "tag") return false;

  const conditions = record(input.conditions);
  const refName = record(conditions.ref_name);
  const includes = strings(refName.include);
  if (!includes.some(refPatternCoversVTags)) return false;

  const ruleTypes = new Set(
    Array.isArray(input.rules)
      ? input.rules.flatMap((item) => {
          const type = record(item).type;
          return typeof type === "string" ? [type] : [];
        })
      : [],
  );
  return ruleTypes.has("deletion") && ruleTypes.has("non_fast_forward");
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
    tags: releases.flatMap((item) => {
      const tag = record(item).tag_name;
      return typeof tag === "string" ? [tag] : [];
    }),
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

  const defaultBranch = simpleComparison(
    "defaultBranch",
    desired.defaultBranch,
    live.defaultBranch,
    (actual) => actual === desired.defaultBranch,
  );

  let mainProtected: SettingsComparison;
  let required: SettingsComparison;
  if (live.branchProtection.state !== "observed") {
    mainProtected = unavailableComparison("mainProtected", desired.branchProtection.protected, live.branchProtection);
    required = unavailableComparison("requiredChecks", desiredChecks, live.branchProtection);
  } else {
    mainProtected = {
      key: "mainProtected",
      status: live.branchProtection.value.protected === desired.branchProtection.protected ? "match" : "mismatch",
      desired: desired.branchProtection.protected,
      observed: live.branchProtection.value.protected,
      detail: live.branchProtection.value.protected === desired.branchProtection.protected
        ? "live provider state matches desired policy"
        : "live provider state differs from desired policy",
    };
    const actualChecks = sortedUnique(live.branchProtection.value.requiredChecks);
    required = {
      key: "requiredChecks",
      status: JSON.stringify(actualChecks) === JSON.stringify(desiredChecks) ? "match" : "mismatch",
      desired: desiredChecks,
      observed: actualChecks,
      detail: JSON.stringify(actualChecks) === JSON.stringify(desiredChecks)
        ? "live provider state matches desired policy"
        : "live provider state differs from desired policy",
    };
  }

  const mergeMethods = simpleComparison(
    "mergeMethods",
    desiredMethods,
    live.mergeMethods,
    (actual) => JSON.stringify(sortedUnique(actual)) === JSON.stringify(desiredMethods),
  );

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
        ? "an active tag ruleset prevents deletion and non-fast-forward updates for v-prefixed tags"
        : "no active tag ruleset proves immutable published v-prefixed release tags",
    };
  }

  return [defaultBranch, mainProtected, required, mergeMethods, singleCommit, releaseTags];
}
