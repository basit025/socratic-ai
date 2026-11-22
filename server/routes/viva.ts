/**
 * Submit → hidden tests → viva → grade + flags.
 * State machine: in_progress → (submit: code locked) viva_in_progress → (viva done) submitted → (teacher) graded.
 * Hidden-test INPUTS reach the browser only after the code is locked; expected outputs never do.
 * Viva timing is enforced on the server (asked_at + seconds + grace).
 */
import { Router } from "express";
import { z } from "zod";
import { requireSession } from "../lib/auth.js";
import { eq, insert, select, update } from "../lib/db.js";
import { notFound, PublicError } from "../lib/errors.js";
import { enforceAi } from "../lib/limits.js";
import { ipHash } from "../lib/session.js";
import { renderInstructions, type VariantSpec } from "../lib/variants.js";
import { computeFlags } from "../integrity/flags.js";
import { markTests, suggestedGrade, type HiddenTest, type MarkedTest } from "../integrity/grading.js";
import { generateQuestion, KIND_ORDER, predictionMatches, scoreViva, type VivaQuestion } from "../viva.js";
import { ownSubmission } from "./workspace.js";
import { MAX_DOC_LENGTH, type ProcessEvent } from "../../shared/events.js";

export const vivaRouter = Router();

const GRACE_SECONDS = 15;

interface Ctx {
  sub: Awaited<ReturnType<typeof ownSubmission>> & { test_results?: MarkedTest[] | null };
  a: {
    id: string;
    title: string;
    marks: number;
    instructions_md: string;
    rules: { viva_questions: number; viva_seconds_per_q: number; viva_weight: number } | null;
    secrets: { hidden_tests: HiddenTest[]; variant_spec: VariantSpec } | null;
  };
  variant: { params: Record<string, string>; rendered_instructions: string } | null;
}

async function context(sid: string, pid: string, submissionId: string): Promise<Ctx> {
  const sub = await ownSubmission(sid, pid, submissionId);
  const [a] = await select<Ctx["a"]>(
    `assignments?select=id,title,marks,instructions_md,rules:integrity_rules(viva_questions,viva_seconds_per_q,viva_weight),secrets:assignment_secrets(hidden_tests,variant_spec)&id=${eq(sub.assignment_id)}&sandbox_id=${eq(sid)}`,
  );
  if (!a) throw notFound("That assignment");
  const [variant] = await select<NonNullable<Ctx["variant"]>>(`variants?select=params,rendered_instructions&assignment_id=${eq(a.id)}&student_id=${eq(pid)}`);
  const [tr] = await select<{ test_results: MarkedTest[] | null }>(`submissions?select=test_results&id=${eq(sub.id)}`);
  return { sub: { ...sub, test_results: tr?.test_results ?? null }, a, variant: variant ?? null };
}

const variantOption = (ctx: Ctx) => {
  const param = ctx.a.secrets?.variant_spec?.param;
  return param && ctx.variant ? (ctx.variant.params[param] ?? null) : null;
};
const testCalls = (ctx: Ctx) => (ctx.a.secrets?.hidden_tests ?? []).map((t) => t.call);
const instructions = (ctx: Ctx) => ctx.variant?.rendered_instructions ?? renderInstructions(ctx.a.instructions_md, ctx.a.secrets?.variant_spec ?? {}, null);
const testsSummary = (ctx: Ctx) =>
  ctx.sub.tests_total ? `${ctx.sub.tests_passed}/${ctx.sub.tests_total} passed` : "not run";

interface VivaRow {
  id: string;
  status: "in_progress" | "completed" | "abandoned";
  questions: VivaQuestion[];
  current_index: number;
  understanding_score: number | null;
  summary: string | null;
  rubric: Record<string, unknown> | null;
}

async function loadViva(subId: string): Promise<VivaRow | null> {
  const [v] = await select<VivaRow>(`viva_sessions?select=id,status,questions,current_index,understanding_score,summary,rubric&submission_id=${eq(subId)}`);
  return v ?? null;
}

/** What the student may see of a question (no internal fields). */
function publicQuestion(q: VivaQuestion, index: number, now = Date.now()) {
  const left = Math.max(0, Math.round((Date.parse(q.asked_at) + q.seconds_allowed * 1000 - now) / 1000));
  return { index, kind: q.kind, prompt: q.prompt, secondsAllowed: q.seconds_allowed, secondsLeft: left, needsGroundTruth: q.kind === "predict_output" && Boolean(q.input_call), call: q.input_call };
}

async function finalize(sid: string, ctx: Ctx, viva: VivaRow | null, understanding: number | null, summary: string | null, rubric: unknown, perQuestion: { score: number; feedback: string }[] | null, reviseNext: string | null) {
  const weight = ctx.a.rules?.viva_weight ?? 50;
  const grade = suggestedGrade({ marks: ctx.a.marks, testsPassed: ctx.sub.tests_passed, testsTotal: ctx.sub.tests_total, vivaScore: understanding, vivaWeight: weight });
  if (viva) {
    const questions = viva.questions.map((q, i) => ({ ...q, score: perQuestion?.[i]?.score, feedback: perQuestion?.[i]?.feedback }));
    await update("viva_sessions", `id=${eq(viva.id)}`, {
      status: "completed",
      questions,
      understanding_score: understanding,
      summary: summary ?? "The viva couldn't be scored automatically (AI unavailable). Please read the transcript.",
      rubric: rubric ? { ...(rubric as object), revise_next: reviseNext } : null,
      completed_at: new Date().toISOString(),
    });
  }
  await update("submissions", `id=${eq(ctx.sub.id)}`, { status: "submitted", viva_score: understanding, suggested_grade: grade });

  // Integrity flags from the evidence log (rule-based; never verdicts).
  const rows = await select<{ seq: number; type: ProcessEvent["type"]; payload: ProcessEvent["payload"]; client_time: string }>(
    `process_events?select=seq,type,payload,client_time&submission_id=${eq(ctx.sub.id)}&order=seq`,
  );
  const events = rows.map((r) => ({ seq: r.seq, t: Date.parse(r.client_time), type: r.type, payload: r.payload }) as ProcessEvent);
  const flags = computeFlags({ events, testsPassed: ctx.sub.tests_passed, testsTotal: ctx.sub.tests_total, vivaScore: understanding });
  if (flags.length) {
    await insert(
      "flags",
      flags.map((f) => ({ sandbox_id: sid, submission_id: ctx.sub.id, rule: f.rule, severity: f.severity, message: f.message, evidence: f.evidence })),
    );
  }
  return grade;
}

// ---------------------------------------------------------------- submit (locks the code)
const SubmitBody = z.object({ doc: z.string().max(MAX_DOC_LENGTH) });

vivaRouter.post("/submissions/:id/submit", requireSession("student"), async (req, res, next) => {
  try {
    const { sid, pid } = req.session!;
    const body = SubmitBody.safeParse(req.body);
    if (!body.success) throw new PublicError(400, "Couldn't read your code. Refresh and try again.", "bad_submit");
    const ctx = await context(sid, pid, String(req.params.id));
    if (ctx.sub.status === "in_progress") {
      await update("submissions", `id=${eq(ctx.sub.id)}&status=eq.in_progress`, { content: body.data.doc, status: "viva_in_progress", submitted_at: new Date().toISOString() });
    } else if (ctx.sub.status !== "viva_in_progress") {
      throw new PublicError(409, "This assignment has already been submitted.", "submitted");
    }
    // Inputs only. Expected values stay on the server.
    res.json({ testCalls: ctx.sub.test_results ? [] : testCalls(ctx), code: ctx.sub.status === "in_progress" ? body.data.doc : ctx.sub.content });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------- hidden test results (marked here)
const TestsBody = z.object({
  results: z.array(z.object({ call: z.string().max(300), ok: z.boolean(), repr: z.string().max(2000).optional(), error: z.string().max(500).optional() })).max(50),
});

vivaRouter.post("/submissions/:id/tests", requireSession("student"), async (req, res, next) => {
  try {
    const { sid, pid } = req.session!;
    const body = TestsBody.safeParse(req.body);
    if (!body.success) throw new PublicError(400, "Couldn't read the test results.", "bad_tests");
    const ctx = await context(sid, pid, String(req.params.id));
    if (ctx.sub.status !== "viva_in_progress") throw new PublicError(409, "Tests run once, right after submitting.", "wrong_state");
    if (ctx.sub.test_results) {
      res.json({ passed: ctx.sub.tests_passed, total: ctx.sub.tests_total, results: ctx.sub.test_results.map((t) => ({ name: t.name, passed: t.passed })) });
      return;
    }
    const marked = markTests(ctx.a.secrets?.hidden_tests ?? [], body.data.results, variantOption(ctx));
    const passed = marked.filter((m) => m.passed).length;
    await update("submissions", `id=${eq(ctx.sub.id)}`, { test_results: marked, tests_passed: passed, tests_total: marked.length });
    ctx.sub.tests_passed = passed;
    ctx.sub.tests_total = marked.length;
    // No viva on this assignment: finish now.
    if ((ctx.a.rules?.viva_questions ?? 0) === 0) await finalize(sid, ctx, null, null, null, null, null, null);
    res.json({ passed, total: marked.length, results: marked.map((m) => ({ name: m.name, passed: m.passed })) });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------- viva state
vivaRouter.get("/submissions/:id/viva", requireSession("student"), async (req, res, next) => {
  try {
    const { sid, pid } = req.session!;
    const ctx = await context(sid, pid, String(req.params.id));
    const viva = await loadViva(ctx.sub.id);
    const total = ctx.a.rules?.viva_questions ?? 0;
    const base = {
      submissionId: ctx.sub.id,
      assignmentId: ctx.a.id,
      title: ctx.a.title,
      submissionStatus: ctx.sub.status,
      total,
      secondsPerQ: ctx.a.rules?.viva_seconds_per_q ?? 90,
      vivaWeight: ctx.a.rules?.viva_weight ?? 50,
      marks: ctx.a.marks,
      testsPending: ctx.sub.status === "viva_in_progress" && !ctx.sub.test_results,
      testCalls: ctx.sub.status === "viva_in_progress" && !ctx.sub.test_results ? testCalls(ctx) : [],
      code: ctx.sub.content,
      tests: ctx.sub.test_results ? { passed: ctx.sub.tests_passed, total: ctx.sub.tests_total, results: ctx.sub.test_results.map((t) => ({ name: t.name, passed: t.passed })) } : null,
    };
    if (ctx.sub.status === "in_progress") throw new PublicError(409, "Submit your work first. The viva starts after you submit.", "not_submitted");
    if (!viva) {
      res.set("Cache-Control", "no-store").json({ ...base, status: ctx.sub.status === "viva_in_progress" ? "not_started" : "completed" });
      return;
    }
    if (viva.status === "completed") {
      const [s] = await select<{ suggested_grade: number | null; final_grade: number | null; viva_score: number | null }>(`submissions?select=suggested_grade,final_grade,viva_score&id=${eq(ctx.sub.id)}`);
      res.set("Cache-Control", "no-store").json({
        ...base,
        status: "completed",
        result: {
          vivaScore: s?.viva_score ?? null,
          grade: s?.final_grade ?? s?.suggested_grade ?? null,
          reviseNext: (viva.rubric as { revise_next?: string } | null)?.revise_next ?? null,
          questions: viva.questions.map((q) => ({ prompt: q.prompt, answer: q.answer ?? "", score: q.score ?? null, feedback: q.feedback ?? null, late: Boolean(q.late) })),
        },
      });
      return;
    }
    res.set("Cache-Control", "no-store").json({ ...base, status: "in_progress", current: publicQuestion(viva.questions[viva.current_index]!, viva.current_index) });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------- start the viva (first question)
vivaRouter.post("/submissions/:id/viva/start", requireSession("student"), async (req, res, next) => {
  try {
    const { sid, pid } = req.session!;
    const ctx = await context(sid, pid, String(req.params.id));
    if (ctx.sub.status !== "viva_in_progress") throw new PublicError(409, "The viva can only start right after submitting.", "wrong_state");
    const existing = await loadViva(ctx.sub.id);
    if (existing) {
      res.json({ current: publicQuestion(existing.questions[existing.current_index]!, existing.current_index) });
      return;
    }
    await enforceAi(sid, ipHash(req));
    const q = await generateQuestion({ title: ctx.a.title, instructions: instructions(ctx), code: ctx.sub.content, testsSummary: testsSummary(ctx), previous: [], kind: KIND_ORDER[0]!, sandboxId: sid });
    const question: VivaQuestion = { kind: KIND_ORDER[0]!, prompt: q.prompt, input_call: q.input_call, seconds_allowed: ctx.a.rules?.viva_seconds_per_q ?? 90, asked_at: new Date().toISOString(), ...(q.fallback ? { fallback: true } : {}) };
    await insert("viva_sessions", { sandbox_id: sid, submission_id: ctx.sub.id, questions: [question], current_index: 0 });
    res.status(201).json({ current: publicQuestion(question, 0) });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------- answer → next question or result
const AnswerBody = z.object({
  index: z.number().int().min(0).max(10),
  answer: z.string().max(2000),
  awayMs: z.number().int().min(0).max(3_600_000).optional(),
  groundTruth: z.object({ call: z.string().max(300), ok: z.boolean(), repr: z.string().max(2000).optional(), error: z.string().max(500).optional() }).optional(),
});

vivaRouter.post("/submissions/:id/viva/answer", requireSession("student"), async (req, res, next) => {
  try {
    const { sid, pid } = req.session!;
    const body = AnswerBody.safeParse(req.body);
    if (!body.success) throw new PublicError(400, "Couldn't read your answer.", "bad_answer");
    const ctx = await context(sid, pid, String(req.params.id));
    const viva = await loadViva(ctx.sub.id);
    if (!viva || viva.status !== "in_progress") throw new PublicError(409, "This viva isn't running.", "wrong_state");
    if (body.data.index !== viva.current_index) {
      // A repeated click: return the current state instead of double-answering.
      res.json({ current: publicQuestion(viva.questions[viva.current_index]!, viva.current_index) });
      return;
    }
    const now = Date.now();
    const q = viva.questions[viva.current_index]!;
    q.answer = body.data.answer.trim();
    q.answered_at = new Date(now).toISOString();
    q.late = now > Date.parse(q.asked_at) + (q.seconds_allowed + GRACE_SECONDS) * 1000;
    q.away_ms = body.data.awayMs ?? 0;
    if (q.kind === "predict_output" && q.input_call && body.data.groundTruth?.call === q.input_call) {
      const actual = body.data.groundTruth.ok ? (body.data.groundTruth.repr ?? "") : `Error: ${body.data.groundTruth.error ?? "unknown"}`;
      q.auto_check = { call: q.input_call, actual: actual.slice(0, 300), predicted_match: q.answer ? predictionMatches(q.answer, actual) : false };
    }

    const total = ctx.a.rules?.viva_questions ?? 3;
    const nextIndex = viva.current_index + 1;
    if (nextIndex < total) {
      await enforceAi(sid, ipHash(req));
      const kind = KIND_ORDER[nextIndex % KIND_ORDER.length]!;
      const n = await generateQuestion({
        title: ctx.a.title,
        instructions: instructions(ctx),
        code: ctx.sub.content,
        testsSummary: testsSummary(ctx),
        previous: viva.questions.map((x) => ({ prompt: x.prompt, answer: x.answer ?? "" })),
        kind,
        sandboxId: sid,
      });
      const next: VivaQuestion = { kind, prompt: n.prompt, input_call: n.input_call, seconds_allowed: ctx.a.rules?.viva_seconds_per_q ?? 90, asked_at: new Date().toISOString(), ...(n.fallback ? { fallback: true } : {}) };
      const questions = [...viva.questions, next];
      await update("viva_sessions", `id=${eq(viva.id)}&current_index=eq.${viva.current_index}`, { questions, current_index: nextIndex });
      res.json({ current: publicQuestion(next, nextIndex) });
      return;
    }

    // Last answer: score, grade, flag.
    await update("viva_sessions", `id=${eq(viva.id)}`, { questions: viva.questions });
    const scored = await scoreViva({ title: ctx.a.title, code: ctx.sub.content, questions: viva.questions, sandboxId: sid });
    const grade = await finalize(
      sid,
      ctx,
      viva,
      scored?.understanding ?? null,
      scored?.score.teacher_summary ?? null,
      scored?.score.rubric ?? null,
      scored?.score.per_question ?? null,
      scored?.score.revise_next ?? null,
    );
    res.json({ done: true, vivaScore: scored?.understanding ?? null, grade });
  } catch (err) {
    next(err);
  }
});
