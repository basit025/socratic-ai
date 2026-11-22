/**
 * Rebuilds the demo seed sandbox from server/seed/content.ts. Never calls an AI model.
 *
 *   npm run seed                 # preview database
 *   npm run seed -- --production # production database (asks no questions: be sure)
 *   npm run seed -- --sql-only   # print the SQL instead of running it
 *
 * Runs through the Supabase CLI (`npx supabase login` once), so no database password is needed.
 */
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { announcements, assignments, courses, modules, students, teachers } from "./content.js";

const REFS = { preview: "eksckojfihwirwdgdrfc", production: "szenspgxfjrynhtwhixm" } as const;

/** SQL string literal (standard_conforming_strings is on, so only quotes need doubling). */
export const lit = (v: string | null | undefined): string => (v == null ? "null" : `'${v.replace(/'/g, "''")}'`);
export const json = (v: unknown): string => `${lit(JSON.stringify(v))}::jsonb`;
const days = (n: number): string => `now() + interval '${Number(n)} days'`;
/** A clock time in Pakistan, n days from today: e.g. dayAt(3, "23:59") = Thursday 11:59 PM PKT. */
const dayAt = (n: number, hhmm: string): string =>
  `((date_trunc('day', now() at time zone 'Asia/Karachi') + interval '${Number(n)} days' + interval '${hhmm.replace(/[^0-9:]/g, "")}') at time zone 'Asia/Karachi')`;
const SEED = "(select public.seed_sandbox_id())";

export function buildSeedSql(): string {
  const id = new Map<string, string>();
  const idFor = (key: string) => {
    if (!id.has(key)) id.set(key, randomUUID());
    return id.get(key)!;
  };
  const out: string[] = ["begin;", `select public.clear_sandbox(${SEED});`];

  for (const p of [...teachers.map((t) => ({ ...t, role: "teacher" })), ...students.map((s) => ({ ...s, role: "student" }))]) {
    out.push(
      `insert into public.profiles (id, sandbox_id, role, full_name, email, initials) values (${lit(idFor(`p:${p.key}`))}, ${SEED}, ${lit(p.role)}, ${lit(p.fullName)}, ${lit(p.email ?? null)}, ${lit(p.initials)});`,
    );
  }

  for (const c of courses) {
    out.push(
      `insert into public.courses (id, sandbox_id, teacher_id, code, name, section, term, join_code) values (${lit(idFor(`c:${c.key}`))}, ${SEED}, ${lit(idFor(`p:${c.teacher}`))}, ${lit(c.code)}, ${lit(c.name)}, ${lit(c.section)}, ${lit(c.term)}, ${lit(c.joinCode)});`,
    );
    for (const s of c.students) {
      out.push(
        `insert into public.enrollments (sandbox_id, course_id, student_id, joined_at) values (${SEED}, ${lit(idFor(`c:${c.key}`))}, ${lit(idFor(`p:${s}`))}, ${days(-20)});`,
      );
    }
  }

  for (const m of modules) {
    out.push(
      `insert into public.modules (id, sandbox_id, course_id, week, title, notes_md) values (${lit(idFor(`m:${m.course}:${m.week}`))}, ${SEED}, ${lit(idFor(`c:${m.course}`))}, ${m.week}, ${lit(m.title)}, ${lit(m.notes)});`,
    );
  }

  for (const a of assignments) {
    const aid = idFor(`a:${a.key}`);
    out.push(
      `insert into public.assignments (id, sandbox_id, course_id, module_id, type, title, instructions_md, language, starter_code, marks, status, opens_at, due_at) values (${lit(aid)}, ${SEED}, ${lit(idFor(`c:${a.course}`))}, ${lit(idFor(`m:${a.course}:${a.week}`))}, 'code', ${lit(a.title)}, ${lit(a.instructions)}, 'python', ${lit(a.starterCode)}, ${a.marks}, ${lit(a.status)}, ${dayAt(a.opensInDays, "08:00")}, ${dayAt(a.dueInDays, "23:59")});`,
      `insert into public.integrity_rules (assignment_id, sandbox_id, paste_blocked, workflow, viva_questions, viva_seconds_per_q, viva_weight, variants_on) values (${lit(aid)}, ${SEED}, ${a.rules.pasteBlocked}, ${lit(a.rules.workflow)}, ${a.rules.vivaQuestions}, ${a.rules.vivaSecondsPerQ}, ${a.rules.vivaWeight}, ${a.rules.variantsOn});`,
      `insert into public.assignment_secrets (assignment_id, sandbox_id, reference_solution, hidden_tests, variant_spec) values (${lit(aid)}, ${SEED}, ${lit(a.referenceSolution)}, ${json(a.tests)}, ${json(a.variantSpec ?? {})});`,
    );
  }

  for (const n of announcements) {
    out.push(
      `insert into public.announcements (id, sandbox_id, course_id, title, body, posted_at) values (${lit(randomUUID())}, ${SEED}, ${lit(idFor(`c:${n.course}`))}, ${lit(n.title)}, ${lit(n.body)}, ${days(-n.postedDaysAgo)});`,
    );
  }

  out.push("update public.sandboxes set seeded_at = now() where kind = 'seed';", "commit;");
  return out.join("\n") + "\n";
}

function main() {
  const args = process.argv.slice(2);
  const sql = buildSeedSql();
  if (args.includes("--sql-only")) {
    process.stdout.write(sql);
    return;
  }
  const target = args.includes("--production") ? "production" : "preview";
  const dir = mkdtempSync(path.join(tmpdir(), "socratic-seed-"));
  const file = path.join(dir, "seed.sql");
  writeFileSync(file, sql);
  const started = Date.now();
  const r = spawnSync("npx", ["supabase", "db", "query", `--remote=${REFS[target]}`, "--yes", "-f", file], { encoding: "utf8" });
  rmSync(dir, { recursive: true, force: true });
  const output = `${r.stdout}\n${r.stderr}`;
  if (r.status !== 0 || /"_tag":\s*"Error"|ERROR:/.test(output)) {
    console.error(`Seeding ${target} failed:\n${output.slice(-1500)}`);
    process.exit(1);
  }
  console.log(`Seeded ${target} in ${((Date.now() - started) / 1000).toFixed(1)} s (${sql.split("\n").length - 1} statements).`);
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("seed", "seed.ts"))) main();
