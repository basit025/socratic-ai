/**
 * Timed quizzes (FR-13, FR-16): one question at a time, no going back.
 * - Each student gets their own draw from the question pool, in their own order, with shuffled options.
 * - The clock runs on the SERVER (started_at + time limit + a short grace); late answers are refused.
 * - Answer keys never leave the server. Marking is deterministic (no AI).
 * - Leaving fullscreen or the tab is logged by the browser as process events and becomes a flag.
 */
import { Router } from "express";
import { z } from "zod";
import { requireSession } from "../lib/auth.js";
import { eq, insert, select, update } from "../lib/db.js";
import { notFound, PublicError } from "../lib/errors.js";
import { computeFlags } from "../integrity/flags.js";
import { ownSubmission } from "./workspace.js";
import { markQuiz, newQuizState, parseQuizState, quizSecondsLeft, quizTimeUp, seedFrom, type QuizQuestionRow, type QuizState } from "../../shared/quiz.js";
import type { ProcessEvent } from "../../shared/events.js";

export const quizRouter = Router();

interface QuizCtx {
  sub: Awaited<ReturnType<typeof ownSubmission>>;
  a: {
    id: string;
    title: string;
    type: string;
    marks: number;
    status: string;
    rules: { time_limit_minutes: number | null; fullscreen_required: boolean } | null;
    secrets: { variant_spec: { draw?: number } | null } | null;
  };
  questions: QuizQuestionRow[]; // includes answer keys: never send these to the browser
}

async function quizContext(sid: string, pid: string, submissionId: string): Promise<QuizCtx> {
  const sub = await ownSubmission(sid, pid, submissionId);
  const [a] = await select<QuizCtx["a"]>(
    `assignments?select=id,title,type,marks,status,rules:integrity_rules(time_limit_minutes,fullscreen_required),secrets:assignment_secrets(variant_spec)&id=${eq(sub.assignment_id)}&sandbox_id=${eq(sid)}`,
  );
  if (!a || a.type !== "quiz") throw notFound("That quiz");
  const questions = await select<QuizQuestionRow>(`quiz_questions?select=id,position,kind,prompt_md,options,answer_key,marks&assignment_id=${eq(a.id)}&sandbox_id=${eq(sid)}&order=position`);
  return { sub, a, questions };
}

const limit = (ctx: QuizCtx) => ctx.a.rules?.time_limit_minutes ?? null;

/** What the student sees: the current question only (options in their own order), never a key. */
function view(ctx: QuizCtx, state: QuizState | null) {
  const base = {
    title: ctx.a.title,
    total: state ? state.order.length : Math.min(ctx.a.secrets?.variant_spec?.draw ?? ctx.questions.length, ctx.questions.length),
    timeLimitMinutes: limit(ctx),
    fullscreenRequired: Boolean(ctx.a.rules?.fullscreen_required),
    marks: ctx.a.marks,
  };
  if (!state) return { ...base, status: "not_started" as const };
  if (state.finishedAt || ctx.sub.status !== "in_progress") return { ...base, status: "done" as const, result: result(ctx, state) };
  const q = ctx.questions.find((x) => x.id === state.order[state.current]);
  if (!q) throw new PublicError(500, "This quiz has changed since you started. Please tell your teacher.", "quiz_changed");
  const order = state.optionOrder[q.id];
  return {
    ...base,
    status: "in_progress" as const,
    secondsLeft: quizSecondsLeft(state, limit(ctx)),
    answered: state.current,
    current: {
      index: state.current,
      kind: q.kind,
      prompt: q.prompt_md,
      marks: q.marks,
      options: q.kind === "mcq" && q.options ? (order ?? q.options.map((_, i) => i)).map((i) => q.options![i]!) : null,
    },
  };
}

function result(ctx: QuizCtx, state: QuizState) {
  const mark = markQuiz(state, ctx.questions);
  const byId = new Map(ctx.questions.map((q) => [q.id, q]));
  return {
    correct: mark.correct,
    total: mark.total,
    earned: mark.earned,
    possible: mark.possible,
    grade: ctx.sub.final_grade ?? ctx.sub.suggested_grade,
    finishedAt: state.finishedAt,
    // Right or wrong per question, but no answer keys: classmates may still be taking it.
    questions: mark.perQuestion.map((p, i) => {
      const q = byId.get(p.id)!;
      const v = state.answers[p.id]?.value;
      return { index: i, prompt: q.prompt_md, correct: p.correct, answered: p.answered, yourAnswer: v == null || v === "" ? null : q.kind === "mcq" && typeof v === "number" ? (q.options?.[v] ?? null) : String(v) };
    }),
  };
}

/** Marks the quiz, locks it, and raises flags from the process log. Safe to call twice. */
async function finish(sid: string, ctx: QuizCtx, state: QuizState): Promise<void> {
  if (ctx.sub.status !== "in_progress") return;
  const done: QuizState = { ...state, finishedAt: new Date().toISOString() };
  const mark = markQuiz(done, ctx.questions);
  const grade = mark.possible ? Math.round(((ctx.a.marks * mark.earned) / mark.possible) * 100) / 100 : 0;
  const locked = await update<{ id: string }>("submissions", `id=${eq(ctx.sub.id)}&status=eq.in_progress`, {
    content: JSON.stringify(done),
    status: "submitted",
    submitted_at: done.finishedAt,
    tests_passed: mark.correct,
    tests_total: mark.total,
    test_results: mark.perQuestion.map((p, i) => ({ name: `Question ${i + 1}`, passed: p.correct })),
    suggested_grade: grade,
  });
  if (!locked.length) return; // someone else (a parallel request) finished it first
  const rows = await select<{ seq: number; type: ProcessEvent["type"]; payload: unknown; client_time: string }>(`process_events?select=seq,type,payload,client_time&submission_id=${eq(ctx.sub.id)}&order=seq`);
  const events = rows.map((r) => ({ seq: r.seq, t: Date.parse(r.client_time), type: r.type, payload: r.payload }) as ProcessEvent);
  const flags = computeFlags({ events, testsPassed: mark.correct, testsTotal: mark.total, vivaScore: null, quiz: true });
  if (flags.length) await insert("flags", flags.map((f) => ({ sandbox_id: sid, submission_id: ctx.sub.id, rule: f.rule, severity: f.severity, message: f.message, evidence: f.evidence })));
  ctx.sub.status = "submitted";
  ctx.sub.suggested_grade = grade;
}

/** Loads the state and finishes the quiz if its time ran out while the student was away. */
async function current(sid: string, ctx: QuizCtx): Promise<QuizState | null> {
  const state = parseQuizState(ctx.sub.content);
  if (state && !state.finishedAt && ctx.sub.status === "in_progress" && quizTimeUp(state, limit(ctx))) {
    await finish(sid, ctx, state);
    return { ...state, finishedAt: new Date().toISOString() };
  }
  return state;
}

quizRouter.get("/submissions/:id/quiz", requireSession("student"), async (req, res, next) => {
  try {
    const { sid, pid } = req.session!;
    const ctx = await quizContext(sid, pid, String(req.params.id));
    res.set("Cache-Control", "no-store").json(view(ctx, await current(sid, ctx)));
  } catch (err) {
    next(err);
  }
});

quizRouter.post("/submissions/:id/quiz/start", requireSession("student"), async (req, res, next) => {
  try {
    const { sid, pid } = req.session!;
    const ctx = await quizContext(sid, pid, String(req.params.id));
    let state = await current(sid, ctx);
    if (!state) {
      if (ctx.sub.status !== "in_progress" || ctx.a.status !== "published") throw new PublicError(409, "This quiz isn't open.", "quiz_closed");
      if (!ctx.questions.length) throw new PublicError(409, "This quiz has no questions yet. Please tell your teacher.", "quiz_empty");
      state = newQuizState(ctx.questions, ctx.a.secrets?.variant_spec?.draw, seedFrom(ctx.sub.id), new Date().toISOString());
      // Only the first start counts (a double click can't restart the clock).
      const saved = await update<{ id: string }>("submissions", `id=${eq(ctx.sub.id)}&status=eq.in_progress&content=eq.`, { content: JSON.stringify(state) });
      if (!saved.length) state = parseQuizState((await ownSubmission(sid, pid, ctx.sub.id)).content);
      ctx.sub.content = JSON.stringify(state);
    }
    res.json(view(ctx, state));
  } catch (err) {
    next(err);
  }
});

const AnswerBody = z.object({
  index: z.number().int().min(0).max(200),
  // mcq: the option's position as shown to the student; short: the typed answer
  value: z.union([z.number().int().min(0).max(20), z.string().max(500), z.null()]),
});

quizRouter.post("/submissions/:id/quiz/answer", requireSession("student"), async (req, res, next) => {
  try {
    const { sid, pid } = req.session!;
    const body = AnswerBody.safeParse(req.body);
    if (!body.success) throw new PublicError(400, "Couldn't read your answer. Please try again.", "bad_answer");
    const ctx = await quizContext(sid, pid, String(req.params.id));
    const state = await current(sid, ctx);
    if (!state) throw new PublicError(409, "Start the quiz first.", "not_started");
    if (state.finishedAt || ctx.sub.status !== "in_progress") {
      res.json({ ...view(ctx, state), late: true }); // time ran out: show the result
      return;
    }
    if (body.data.index !== state.current) {
      res.json(view(ctx, state)); // a repeated click: just show where they are
      return;
    }
    const qid = state.order[state.current]!;
    const q = ctx.questions.find((x) => x.id === qid)!;
    let value: number | string | null = body.data.value;
    if (q.kind === "mcq") {
      const order = state.optionOrder[qid] ?? (q.options ?? []).map((_, i) => i);
      value = typeof value === "number" && value < order.length ? order[value]! : null;
    } else {
      value = typeof value === "string" ? value.trim().slice(0, 500) : null;
    }
    const after: QuizState = { ...state, answers: { ...state.answers, [qid]: { value, atMs: Date.now() - Date.parse(state.startedAt) } }, current: state.current + 1 };
    if (after.current >= after.order.length) {
      await finish(sid, ctx, after);
      res.json(view(ctx, { ...after, finishedAt: new Date().toISOString() }));
      return;
    }
    const saved = await update<{ id: string }>("submissions", `id=${eq(ctx.sub.id)}&status=eq.in_progress`, { content: JSON.stringify(after) });
    if (!saved.length) throw new PublicError(409, "This quiz has already been handed in.", "submitted");
    ctx.sub.content = JSON.stringify(after);
    res.json(view(ctx, after));
  } catch (err) {
    next(err);
  }
});
