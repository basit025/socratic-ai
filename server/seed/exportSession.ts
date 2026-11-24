/**
 * Saves one submission (process log, viva, Ustaad chat, tests) as a session JSON file that the seed
 * loads into the demo data. Used for real recordings (npm run session:export) and by the
 * demo-class generator (simulated, persona-driven students run through the real platform).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { queryRows, type Target } from "./supabaseCli.js";

export interface ExportOptions {
  submissionId: string;
  as: string;                                   // the fictional classmate who "owns" it
  label: string;
  from?: Target;
  daysAgo?: number;
  note?: string;
  alsoAs?: { student: string; daysAgo: number }[]; // the same session reused under other classmates
  simulated?: { persona: string };              // set for generated demo sessions
  vivaSeconds?: (number | null)[];              // realistic answer times per question (simulated only)
  messageAtMs?: number[];                       // when each Ustaad message happened in the simulated timeline
  outDir?: string;
}

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

export function exportSession(o: ExportOptions): { file: string; events: number; viva: number | null; tests: string } {
  const from = o.from ?? "preview";
  const [sub] = queryRows<{
    id: string;
    status: string;
    content: string;
    last_output: string | null;
    test_results: unknown;
    tests_passed: number | null;
    tests_total: number | null;
    submitted_at: string | null;
    event_source_id: string | null;
    assignment_title: string;
    variant_params: Record<string, string> | null;
  }>(
    from,
    `select s.id, s.status, s.content, s.last_output, s.test_results, s.tests_passed, s.tests_total, s.submitted_at, s.event_source_id,
            a.title as assignment_title, v.params as variant_params
     from submissions s join assignments a on a.id = s.assignment_id left join variants v on v.id = s.variant_id
     where s.id = ${q(o.submissionId)}`,
  );
  if (!sub) throw new Error(`No submission ${o.submissionId} on ${from}.`);
  if (sub.status === "in_progress") throw new Error("That session isn't submitted yet.");
  const logId = sub.event_source_id ?? sub.id;
  const events = queryRows<{ seq: number; type: string; payload: unknown; client_time: string }>(from, `select seq, type, payload, client_time from process_events where submission_id = ${q(logId)} order by seq`);
  if (events.length === 0) throw new Error("That submission has no recorded events.");
  const t0 = Date.parse(events[0]!.client_time);
  const [viva] = queryRows<{ questions: { asked_at?: string; answered_at?: string }[]; understanding_score: number | null; summary: string | null; rubric: unknown; started_at: string; completed_at: string | null }>(
    from,
    `select questions, understanding_score, summary, rubric, started_at, completed_at from viva_sessions where submission_id = ${q(sub.id)}`,
  );
  const messages = queryRows<{ role: string; body: string; hint: string | null; created_at: string }>(from, `select role, body, hint, created_at from ustaad_messages where submission_id = ${q(sub.id)} order by created_at`);
  const rel = (iso: string | null | undefined) => (iso ? Date.parse(iso) - t0 : null);

  // The viva happens right after submitting: lay its questions out after the last event,
  // with realistic answer times for simulated students.
  const lastEventMs = Date.parse(events.at(-1)!.client_time) - t0;
  let cursor = lastEventMs + 20_000;
  const questions = viva
    ? viva.questions.map((x, i) => {
        if (!o.simulated) return { ...x, asked_at: undefined, answered_at: undefined, askedAtMs: rel(x.asked_at), answeredAtMs: rel(x.answered_at) };
        const secs = o.vivaSeconds?.[i] ?? 45;
        const askedAtMs = cursor;
        const answeredAtMs = askedAtMs + secs * 1000;
        cursor = answeredAtMs + 4_000;
        return { ...x, asked_at: undefined, answered_at: undefined, askedAtMs, answeredAtMs };
      })
    : [];

  const file = {
    label: o.label,
    student: o.as,
    alsoAs: o.alsoAs ?? [],
    assignment: sub.assignment_title,
    submittedDaysAgo: o.daysAgo ?? 1,
    recordedAt: events[0]!.client_time,
    source: o.simulated ? `simulated demo student (persona: ${o.simulated.persona}) run through the real platform` : `real session recorded on ${from}, submission ${sub.id}`,
    simulated: Boolean(o.simulated),
    persona: o.simulated?.persona ?? null,
    note: o.note ?? "",
    variant: sub.variant_params,
    content: sub.content,
    lastOutput: sub.last_output,
    testResults: sub.test_results,
    testsPassed: sub.tests_passed,
    testsTotal: sub.tests_total,
    submittedAtMs: o.simulated ? lastEventMs : rel(sub.submitted_at),
    events: events.map((e) => ({ seq: e.seq, ms: Date.parse(e.client_time) - t0, type: e.type, payload: e.payload })),
    viva: viva
      ? {
          understanding: viva.understanding_score,
          summary: viva.summary,
          rubric: viva.rubric,
          startedAtMs: questions[0]?.askedAtMs ?? rel(viva.started_at),
          completedAtMs: questions.at(-1)?.answeredAtMs ?? rel(viva.completed_at),
          questions,
        }
      : null,
    messages: messages.map((m, i) => ({ role: m.role, body: m.body, hint: m.hint, ms: o.messageAtMs?.[i] ?? Date.parse(m.created_at) - t0 })),
  };
  const dir = o.outDir ?? path.join(process.cwd(), "server/seed/sessions");
  mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `${o.label}.json`);
  writeFileSync(out, JSON.stringify(file, null, 2) + "\n");
  return { file: out, events: events.length, viva: viva?.understanding_score ?? null, tests: `${sub.tests_passed}/${sub.tests_total}` };
}
