// Saves ONE real recorded session (a submission made by a real person on the preview site) as a
// JSON file the seed loads into the demo data, under a fictional student's name.
//
//   npm run session:export -- --submission <id> --as bilal --label copier-retyped-1 [--from preview] [--days-ago 2] [--note "..."]
//
// Find the submission id in the teacher's report URL (/teacher/submissions/<id>).
// Only real sessions belong here: never edit the events by hand.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { queryRows, type Target } from "../server/seed/supabaseCli.js";
import { students } from "../server/seed/content.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

const submission = arg("submission");
const as = arg("as");
const label = arg("label");
const from = (arg("from") ?? "preview") as Target;
const daysAgo = Number(arg("days-ago") ?? 1);
const note = arg("note") ?? "";

if (!submission || !/^[0-9a-f-]{36}$/i.test(submission) || !as || !label || !/^[a-z0-9-]+$/.test(label)) {
  console.error("Usage: npm run session:export -- --submission <uuid> --as <student key> --label <kebab-case-name> [--from preview|production] [--days-ago N] [--note \"...\"]");
  console.error(`Student keys: ${students.filter((s) => !s.email).map((s) => s.key).join(", ")} (not the demo student "ayesha")`);
  process.exit(1);
}
if (!students.some((s) => s.key === as) || students.find((s) => s.key === as)?.email) {
  console.error(`--as must be a seeded classmate (not the demo identity): ${students.filter((s) => !s.email).map((s) => s.key).join(", ")}`);
  process.exit(1);
}

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const [sub] = queryRows<{
  id: string;
  status: string;
  content: string;
  last_output: string | null;
  test_results: unknown;
  tests_passed: number | null;
  tests_total: number | null;
  started_at: string;
  submitted_at: string | null;
  event_source_id: string | null;
  assignment_title: string;
  variant_params: Record<string, string> | null;
}>(
  from,
  `select s.id, s.status, s.content, s.last_output, s.test_results, s.tests_passed, s.tests_total, s.started_at, s.submitted_at, s.event_source_id,
          a.title as assignment_title, v.params as variant_params
   from submissions s join assignments a on a.id = s.assignment_id left join variants v on v.id = s.variant_id
   where s.id = ${q(submission)}`,
);
if (!sub) throw new Error(`No submission ${submission} on ${from}.`);
if (sub.status === "in_progress") throw new Error("That session isn't submitted yet. Finish it (submit + viva) first.");
const logId = sub.event_source_id ?? sub.id;

const events = queryRows<{ seq: number; type: string; payload: unknown; client_time: string }>(
  from,
  `select seq, type, payload, client_time from process_events where submission_id = ${q(logId)} order by seq`,
);
if (events.length === 0) throw new Error("That submission has no recorded events.");
const t0 = Date.parse(events[0]!.client_time);

const [viva] = queryRows<{ questions: { asked_at?: string; answered_at?: string }[]; understanding_score: number | null; summary: string | null; rubric: unknown; started_at: string; completed_at: string | null }>(
  from,
  `select questions, understanding_score, summary, rubric, started_at, completed_at from viva_sessions where submission_id = ${q(sub.id)}`,
);
const messages = queryRows<{ role: string; body: string; hint: string | null; created_at: string }>(
  from,
  `select role, body, hint, created_at from ustaad_messages where submission_id = ${q(sub.id)} order by created_at`,
);

const rel = (iso: string | null | undefined) => (iso ? Date.parse(iso) - t0 : null);
const file = {
  label,
  student: as,
  assignment: sub.assignment_title,
  submittedDaysAgo: daysAgo,
  recordedAt: events[0]!.client_time,
  source: `real session recorded on ${from}, submission ${sub.id}`,
  note,
  variant: sub.variant_params,
  content: sub.content,
  lastOutput: sub.last_output,
  testResults: sub.test_results,
  testsPassed: sub.tests_passed,
  testsTotal: sub.tests_total,
  // All times are milliseconds from the first event.
  submittedAtMs: rel(sub.submitted_at),
  events: events.map((e) => ({ seq: e.seq, ms: Date.parse(e.client_time) - t0, type: e.type, payload: e.payload })),
  viva: viva
    ? {
        understanding: viva.understanding_score,
        summary: viva.summary,
        rubric: viva.rubric,
        startedAtMs: rel(viva.started_at),
        completedAtMs: rel(viva.completed_at),
        questions: viva.questions.map((x) => ({ ...x, asked_at: undefined, answered_at: undefined, askedAtMs: rel(x.asked_at), answeredAtMs: rel(x.answered_at) })),
      }
    : null,
  messages: messages.map((m) => ({ role: m.role, body: m.body, hint: m.hint, ms: Date.parse(m.created_at) - t0 })),
};

const dir = path.join(process.cwd(), "server/seed/sessions");
mkdirSync(dir, { recursive: true });
const out = path.join(dir, `${label}.json`);
writeFileSync(out, JSON.stringify(file, null, 2) + "\n");
console.log(`Saved ${out}: ${events.length} events, viva ${viva ? `${viva.understanding_score}/100` : "none"}, tests ${sub.tests_passed}/${sub.tests_total}. Run "npm run seed" to load it.`);
