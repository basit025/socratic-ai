/**
 * Per-student question variants (FR-07). The teacher marks one parameter with a few options; each
 * student gets one option, chosen deterministically from their id, so reopening never changes it and
 * neighbours usually get different numbers.
 */
import { createHash } from "node:crypto";

export interface VariantSpec {
  param?: string;
  options?: string[];
  fills?: Record<string, Record<string, string>>; // option -> { placeholder: text }
}

export function chooseOption(spec: VariantSpec, studentId: string, assignmentId: string): string | null {
  const options = spec.options ?? [];
  if (options.length === 0) return null;
  const n = createHash("sha256").update(`${assignmentId}:${studentId}`).digest().readUInt32BE(0);
  return options[n % options.length]!;
}

/** Replaces {placeholders} with the option's fills. Unknown placeholders are left untouched. */
export function renderInstructions(template: string, spec: VariantSpec, option: string | null): string {
  const fills = (option != null ? spec.fills?.[option] : undefined) ?? (spec.options?.[0] != null ? spec.fills?.[spec.options[0]] : undefined) ?? {};
  return template.replace(/\{([a-z_]+)\}/g, (m, key: string) => fills[key] ?? m);
}
