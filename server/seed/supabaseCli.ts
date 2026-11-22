/** Runs SQL against a Supabase project through the CLI (uses `npx supabase login`; no DB password). */
import { spawnSync } from "node:child_process";

export const REFS = { preview: "eksckojfihwirwdgdrfc", production: "szenspgxfjrynhtwhixm" } as const;
export type Target = keyof typeof REFS;

/** Read-only query returning rows. */
export function queryRows<T>(target: Target, sql: string): T[] {
  const r = spawnSync("npx", ["supabase", "db", "query", `--remote=${REFS[target]}`, "--read-only", "--output-format", "json", sql], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = r.stdout ?? "";
  const start = out.indexOf("{");
  if (r.status !== 0 || start < 0) throw new Error(`Query failed on ${target}: ${(r.stderr || out).slice(-800)}`);
  const parsed = JSON.parse(out.slice(start)) as { rows?: T[]; error?: { message?: string } };
  if (!parsed.rows) throw new Error(`Query failed on ${target}: ${parsed.error?.message ?? out.slice(-800)}`);
  return parsed.rows;
}
