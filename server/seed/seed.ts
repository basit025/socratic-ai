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
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { announcements, assignments, courses, modules, students, teachers } from "./content.js";
import { computeFlags } from "../integrity/flags.js";
import { suggestedGrade } from "../integrity/grading.js";
import { renderInstructions } from "../lib/variants.js";
import type { ProcessEvent } from "../../shared/events.js";
import { REFS } from "./supabaseCli.js";
import { computeExpected } from "./expected.js";

/** A real recorded session saved by `npm run session:export` (times in ms from its first event). */
export interface SessionFile {
  label: string;
  student: string;
  assignment: string;
  submittedDaysAgo: number;
  source: string;
  variant: Record<string, string> | null;
  content: string;
  lastOutput: string | null;
  testResults: unknown;
  testsPassed: number | null;
  testsTotal: number | null;
  submittedAtMs: number | null;
  events: { seq: number; ms: number; type: ProcessEvent["type"]; payload: unknown }[];
  viva: { understanding: number | null; summary: string | null; rubric: unknown; startedAtMs: number | null; completedAtMs: number | null; questions: (Record<string, unknown> & { askedAtMs: number | null; answeredAtMs: number | null })[] } | null;
  messages: { role: string; body: string; hint: string | null; ms: number }[];
}

export function loadSessions(dir = path.join(path.dirname(new URL(import.meta.url).pathname), "sessions")): SessionFile[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")) as SessionFile);
}


/** SQL string literal (standard_conforming_strings is on, so only quotes need doubling). */
export const lit = (v: string | null | undefined): string => (v == null ? "null" : `'${v.replace(/'/g, "''")}'`);
export const json = (v: unknown): string => `${lit(JSON.stringify(v))}::jsonb`;
const days = (n: number): string => `now() + interval '${Number(n)} days'`;
/** A clock time in Pakistan, n days from today: e.g. dayAt(3, "23:59") = Thursday 11:59 PM PKT. */
const dayAt = (n: number, hhmm: string): string =>
  `((date_trunc('day', now() at time zone 'Asia/Karachi') + interval '${Number(n)} days' + interval '${hhmm.replace(/[^0-9:]/g, "")}') at time zone 'Asia/Karachi')`;
const SEED = "(select public.seed_sandbox_id())";

export async function buildSeedSql(opts: { recording?: boolean; sessions?: SessionFile[] } = {}): Promise<string> {
  const sessions = opts.sessions ?? [];
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
    // Expected answers come from running the reference solution (never typed by hand).
    const tests = a.type === "code" && a.language ? await computeExpected(a.language, a.referenceSolution, a.tests, a.variantSpec ?? null) : [];
    out.push(
      `insert into public.assignments (id, sandbox_id, course_id, module_id, type, title, instructions_md, language, starter_code, marks, status, opens_at, due_at) values (${lit(aid)}, ${SEED}, ${lit(idFor(`c:${a.course}`))}, ${lit(idFor(`m:${a.course}:${a.week}`))}, ${lit(a.type)}, ${lit(a.title)}, ${lit(a.instructions)}, ${lit(a.language)}, ${lit(a.starterCode)}, ${a.marks}, ${lit(opts.recording ? "published" : a.status)}, ${dayAt(opts.recording ? -1 : a.opensInDays, "08:00")}, ${dayAt(opts.recording ? 7 : a.dueInDays, "23:59")});`,
      `insert into public.integrity_rules (assignment_id, sandbox_id, paste_blocked, workflow, viva_questions, viva_seconds_per_q, viva_weight, variants_on) values (${lit(aid)}, ${SEED}, ${a.rules.pasteBlocked}, ${lit(a.rules.workflow)}, ${a.rules.vivaQuestions}, ${a.rules.vivaSecondsPerQ}, ${a.rules.vivaWeight}, ${a.rules.variantsOn});`,
      `insert into public.assignment_secrets (assignment_id, sandbox_id, reference_solution, hidden_tests, variant_spec) values (${lit(aid)}, ${SEED}, ${lit(a.referenceSolution)}, ${json(tests)}, ${json(a.variantSpec ?? {})});`,
    );
  }

  for (const n of announcements) {
    out.push(
      `insert into public.announcements (id, sandbox_id, course_id, title, body, posted_at) values (${lit(randomUUID())}, ${SEED}, ${lit(idFor(`c:${n.course}`))}, ${lit(n.title)}, ${lit(n.body)}, ${days(-n.postedDaysAgo)});`,
    );
  }

  // Real recorded sessions → past submissions of fictional classmates.
  const taken = new Set<string>();
  for (const f of sessions) {
    const a = assignments.find((x) => x.title === f.assignment);
    const student = students.find((x) => x.key === f.student);
    if (!a) throw new Error(`Session ${f.label}: no seeded assignment titled "${f.assignment}".`);
    if (!student || student.email) throw new Error(`Session ${f.label}: "${f.student}" must be a seeded classmate (not the demo identity).`);
    if (taken.has(`${a.key}:${student.key}`)) throw new Error(`Session ${f.label}: ${student.key} already has a session for ${a.title}.`);
    taken.add(`${a.key}:${student.key}`);
    if (!f.events.length) throw new Error(`Session ${f.label} has no events.`);

    const sid = randomUUID();
    const pid = idFor(`p:${student.key}`);
    const aid = idFor(`a:${a.key}`);
    const end = Math.max(f.submittedAtMs ?? 0, f.events.at(-1)!.ms);
    const submitted = dayAt(-Math.max(0, f.submittedDaysAgo), "21:30");
    const at = (ms: number | null) => (ms == null ? "null" : `(${submitted} - interval '${Math.round(end - ms)} milliseconds')`);
    let variantId: string | null = null;
    if (f.variant && a.variantSpec) {
      variantId = randomUUID();
      const option = f.variant[a.variantSpec.param] ?? null;
      out.push(
        `insert into public.variants (id, sandbox_id, assignment_id, student_id, params, rendered_instructions, created_at) values (${lit(variantId)}, ${SEED}, ${lit(aid)}, ${lit(pid)}, ${json(f.variant)}, ${lit(renderInstructions(a.instructions, a.variantSpec, option))}, ${at(0)});`,
      );
    }
    const vivaScore = f.viva?.understanding ?? null;
    const grade = suggestedGrade({ marks: a.marks, testsPassed: f.testsPassed, testsTotal: f.testsTotal, vivaScore, vivaWeight: a.rules.vivaWeight });
    out.push(
      `insert into public.submissions (id, sandbox_id, assignment_id, student_id, variant_id, status, content, last_output, test_results, tests_passed, tests_total, viva_score, suggested_grade, started_at, submitted_at) values (${lit(sid)}, ${SEED}, ${lit(aid)}, ${lit(pid)}, ${lit(variantId)}, 'submitted', ${lit(f.content)}, ${lit(f.lastOutput)}, ${f.testResults == null ? "null" : json(f.testResults)}, ${f.testsPassed ?? "null"}, ${f.testsTotal ?? "null"}, ${vivaScore ?? "null"}, ${grade}, ${at(0)}, ${at(f.submittedAtMs ?? end)});`,
    );
    for (let i = 0; i < f.events.length; i += 200) {
      const rows = f.events.slice(i, i + 200).map((e) => `(${SEED}, ${lit(sid)}, ${e.seq}, ${lit(e.type)}, ${json(e.payload)}, ${at(e.ms)})`);
      out.push(`insert into public.process_events (sandbox_id, submission_id, seq, type, payload, client_time) values ${rows.join(", ")};`);
    }
    if (f.viva) {
      const questions = f.viva.questions.map(({ askedAtMs, answeredAtMs, ...q }) => q);
      // Store absolute times for the copied questions (they were saved relative to the session start).
      const qSql = `(select jsonb_agg(q || jsonb_build_object('asked_at', a, 'answered_at', b) order by i) from jsonb_array_elements(${json(questions)}) with ordinality as x(q, i) join (values ${f.viva.questions
        .map((q, i) => `(${i + 1}, ${at(q.askedAtMs)}, ${at(q.answeredAtMs)})`)
        .join(", ")}) as t(n, a, b) on t.n = x.i)`;
      out.push(
        `insert into public.viva_sessions (sandbox_id, submission_id, status, questions, current_index, rubric, understanding_score, summary, started_at, completed_at) values (${SEED}, ${lit(sid)}, 'completed', ${qSql}, ${Math.max(0, f.viva.questions.length - 1)}, ${f.viva.rubric == null ? "null" : json(f.viva.rubric)}, ${vivaScore ?? "null"}, ${lit(f.viva.summary)}, ${at(f.viva.startedAtMs)}, ${at(f.viva.completedAtMs)});`,
      );
    }
    for (const m of f.messages) {
      out.push(`insert into public.ustaad_messages (sandbox_id, submission_id, role, body, hint, created_at) values (${SEED}, ${lit(sid)}, ${lit(m.role)}, ${lit(m.body)}, ${lit(m.hint)}, ${at(m.ms)});`);
    }
    const flags = computeFlags({ events: f.events.map((e) => ({ seq: e.seq, t: e.ms, type: e.type, payload: e.payload }) as ProcessEvent), testsPassed: f.testsPassed, testsTotal: f.testsTotal, vivaScore });
    for (const fl of flags) {
      out.push(`insert into public.flags (sandbox_id, submission_id, rule, severity, message, evidence) values (${SEED}, ${lit(sid)}, ${lit(fl.rule)}, ${lit(fl.severity)}, ${lit(fl.message)}, ${json(fl.evidence)});`);
    }
  }

  out.push("update public.sandboxes set seeded_at = now() where kind = 'seed';", "commit;");
  return out.join("\n") + "\n";
}

async function main() {
  const args = process.argv.slice(2);
  const recording = args.includes("--recording");
  if (recording && args.includes("--production")) {
    console.error("--recording opens every assignment for recording sessions. It's for the preview database only.");
    process.exit(1);
  }
  const sessions = loadSessions();
  const sql = await buildSeedSql({ recording, sessions });
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
  console.log(`Seeded ${target} in ${((Date.now() - started) / 1000).toFixed(1)} s (${sql.split("\n").length - 1} statements, ${sessions.length} real session${sessions.length === 1 ? "" : "s"}${recording ? ", RECORDING MODE: all assignments open" : ""}).`);
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("seed", "seed.ts"))) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
