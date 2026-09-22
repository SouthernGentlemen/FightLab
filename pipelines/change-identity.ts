export const LEGACY_HISTORY_TIP = "9904541df5f99d239cf02bd6a568e02a05c749f8";
export const FIRST_CONTROLLED_SHA = "7516db0a366128fbace6da2370920ab6f5a8bcf1";
export const CONTROLLED_TYPES = ["BUILD", "DOCS", "FIX", "OPS", "REFACTOR", "SEC", "TEST"] as const;

export type ControlledType = (typeof CONTROLLED_TYPES)[number];

export interface CommitRecord {
  sha: string;
  parents: readonly string[];
  message: string;
}

export interface ControlledCommit {
  sha: string;
  id: number;
  type: ControlledType;
  summary: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: readonly string[];
  controlled: readonly ControlledCommit[];
}

const REQUIRED_BODY_FIELDS = [
  "Change",
  "Reason",
  "Impact",
  "Risk",
  "Controls",
  "Validation",
  "Evidence",
  "Source",
] as const;

const SUBJECT = /^\[FL-(\d{3})\] \[([A-Z]+)\] (\S.*)$/;

function validateBody(message: string, identity: string): string[] {
  const lines = message.replaceAll("\r\n", "\n").split("\n").slice(1);
  const errors: string[] = [];
  const positions = new Map<string, number>();

  for (const field of REQUIRED_BODY_FIELDS) {
    const label = `${field}:`;
    const matches = lines.flatMap((line, index) => line === label ? [index] : []);
    if (matches.length !== 1) {
      errors.push(`${identity}: expected exactly one ${label} body field`);
      continue;
    }
    positions.set(field, matches[0]);
  }

  let previous = -1;
  for (const field of REQUIRED_BODY_FIELDS) {
    const position = positions.get(field);
    if (position === undefined) continue;
    if (position <= previous) errors.push(`${identity}: body fields are out of order at ${field}:`);
    previous = position;
  }

  for (let index = 0; index < REQUIRED_BODY_FIELDS.length; index += 1) {
    const field = REQUIRED_BODY_FIELDS[index];
    const position = positions.get(field);
    if (position === undefined) continue;
    const nextField = REQUIRED_BODY_FIELDS[index + 1];
    const next = nextField === undefined ? lines.length : (positions.get(nextField) ?? lines.length);
    const value = lines.slice(position + 1, next).some((line) => line.trim().length > 0);
    if (!value) errors.push(`${identity}: ${field}: must contain a value`);
  }

  return errors;
}

export function validateControlledHistory(history: readonly CommitRecord[]): ValidationResult {
  const errors: string[] = [];
  const parsed: ControlledCommit[] = [];
  const cutover = history.findIndex(({ sha }) => sha === LEGACY_HISTORY_TIP);

  if (cutover === -1) {
    return { ok: false, errors: [`missing immutable legacy cutover ${LEGACY_HISTORY_TIP}`], controlled: [] };
  }

  const controlled = history.slice(cutover + 1);
  if (controlled.length === 0) {
    return { ok: false, errors: ["no controlled FL commits after the immutable cutover"], controlled: [] };
  }
  if (controlled[0].sha !== FIRST_CONTROLLED_SHA) {
    errors.push(`first controlled commit must be FL-001 at ${FIRST_CONTROLLED_SHA}`);
  }

  const seen = new Set<number>();
  for (let index = 0; index < controlled.length; index += 1) {
    const record = controlled[index];
    const expected = index + 1;
    const expectedParent = index === 0 ? LEGACY_HISTORY_TIP : controlled[index - 1].sha;
    if (record.parents[0] !== expectedParent) {
      errors.push(`${record.sha}: first parent must be ${expectedParent}`);
    }
    const subject = record.message.replaceAll("\r\n", "\n").split("\n", 1)[0];
    const identityTags = subject.match(/\[FL-\d{3}\]/g) ?? [];
    const primaryTypeTags = subject.match(/\[[A-Z]+\]/g) ?? [];
    const match = SUBJECT.exec(subject);
    const identity = match === null ? record.sha : `FL-${match[1]}`;

    if (identityTags.length !== 1) errors.push(`${record.sha}: subject must contain exactly one FL-NNN identity`);
    if (primaryTypeTags.length !== 1) errors.push(`${identity}: subject must contain exactly one primary type`);
    if (match === null) {
      errors.push(`${record.sha}: malformed controlled subject`);
      continue;
    }

    const id = Number(match[1]);
    const type = match[2];
    const summary = match[3].trim();

    if (seen.has(id)) errors.push(`FL-${match[1]}: duplicate controlled id`);
    seen.add(id);
    if (id !== expected) errors.push(`FL-${match[1]}: expected FL-${String(expected).padStart(3, "0")}`);
    if (!CONTROLLED_TYPES.includes(type as ControlledType)) errors.push(`FL-${match[1]}: invalid primary type ${type}`);
    if (summary.length === 0) errors.push(`FL-${match[1]}: summary must not be empty`);

    errors.push(...validateBody(record.message, `FL-${match[1]}`));
    if (CONTROLLED_TYPES.includes(type as ControlledType)) {
      parsed.push({ sha: record.sha, id, type: type as ControlledType, summary });
    }
  }

  return { ok: errors.length === 0, errors, controlled: parsed };
}
