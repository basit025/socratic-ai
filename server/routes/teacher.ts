/**
 * Teacher views: an assignment's submissions, one submission's integrity report, and decisions.
 * Every query checks the assignment belongs to a course this teacher teaches, in their sandbox.
 * Teachers may see expected test answers (students never do).
 */
import { Router } from "express";
import { z } from "zod";
import { requireSession } from "../lib/auth.js";
import { randomUUID } from "node:crypto";
import { eq, insert, select, update } from "../lib/db.js";
import { templates } from "../seed/templates.js";
import { notFound, PublicError } from "../lib/errors.js";
import { expectedFor, type HiddenTest, type MarkedTest } from "../integrity/grading.js";
import type { VariantSpec } from "../lib/variants.js";
import type { VivaQuestion } from "../viva.js";
import type { ProcessEvent } from "../../shared/events.js";
import { markQuiz, parseQuizState, type QuizQuestionRow } from "../../shared/quiz.js";

export const teacherRouter = Router();

const uuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);
type SubStatus = "in_progress" | "submitted" | "viva_in_progress" | "graded";

interface FlagRow {
  id: string;
  rule: string;
  severity: "low" | "medium" | "high";
  message: string;
  evidence: { from_seq: number; to_seq: number };
  teacher_status: "open" | "dismissed" | "followed_up";
}

const severityRank = { high: 3, medium: 2, low: 1 } as const;

// ---------------------------------------------------------------- an assignment's submissions
teacherRouter.get("/teacher/assignments/:id", requireSession("teacher"), async (req, res, next) => {
  try {
    const { sid, pid } = req.session!;
    const id = String(req.params.id);
    if (!uuid(id)) throw notFound("That assignment");
    const [a] = await select<{
      id: string;
      title: string;
      type: string;
      status: "draft" | "published" | "closed";
      due_at: string | null;
      marks: number;
      instructions_md: string;
      course: { id: string; code: string; name: string; section: string | null };
      rules: { paste_blocked: boolean; workflow: string; viva_questions: number; viva_seconds_per_q: number; viva_weight: number; variants_on: boolean } | null;
    }>(
      `assignments?select=id,title,type,status,due_at,marks,instructions_md,course:courses!inner(id,code,name,section,teacher_id),rules:integrity_rules(paste_blocked,workflow,viva_questions,viva_seconds_per_q,viva_weight,variants_on)&id=${eq(id)}&sandbox_id=${eq(sid)}&course.teacher_id=${eq(pid)}`,
    );
    if (!a) throw notFound("That assignment");
    const [roster, subs] = await Promise.all([
      select<{ student: { id: string; full_name: string; initials: string } }>(`enrollments?select=student:profiles(id,full_name,initials)&course_id=${eq(a.course.id)}`),
      select<{
        id: string;
        student_id: string;
        status: SubStatus;
        tests_passed: number | null;
        tests_total: number | null;
        viva_score: number | null;
        suggested_grade: number | null;
        final_grade: number | null;
        teacher_decision: string | null;
        submitted_at: string | null;
        flags: Pick<FlagRow, "rule" | "severity" | "teacher_status" | "message">[];
      }>(
        `submissions?select=id,student_id,status,tests_passed,tests_total,viva_score,suggested_grade,final_grade,teacher_decision,submitted_at,flags(rule,severity,teacher_status,message)&assignment_id=${eq(a.id)}&sandbox_id=${eq(sid)}`,
      ),
    ]);
    const byStudent = new Map(subs.map((s) => [s.student_id, s]));
    const rows = roster
      .map(({ student }) => {
        const s = byStudent.get(student.id);
        const open = s?.flags.filter((f) => f.teacher_status === "open") ?? [];
        return {
          student: { id: student.id, name: student.full_name, initials: student.initials },
          submission: s
            ? {
                id: s.id,
                status: s.status,
                testsPassed: s.tests_passed,
                testsTotal: s.tests_total,
                vivaScore: s.viva_score,
                grade: s.final_grade ?? s.suggested_grade,
                decision: s.teacher_decision,
                submittedAt: s.submitted_at,
                openFlags: open.map((f) => ({ rule: f.rule, severity: f.severity, message: f.message })),
                maxSeverity: open.reduce((m, f) => Math.max(m, severityRank[f.severity]), 0),
              }
            : null,
        };
      })
      .sort((x, y) => {
        const rank = (r: (typeof rows)[number]) =>
          !r.submission ? 0 : r.submission.status === "in_progress" ? 1 : r.submission.status === "viva_in_progress" ? 2 : 3;
        return (y.submission?.maxSeverity ?? 0) - (x.submission?.maxSeverity ?? 0) || rank(y) - rank(x) || x.student.name.localeCompare(y.student.name);
      });
    res.set("Cache-Control", "no-store").json({
      assignment: {
        id: a.id,
        title: a.title,
        type: a.type,
        status: a.status,
        dueAt: a.due_at,
        marks: a.marks,
        course: { id: a.course.id, code: a.course.code, name: a.course.name, section: a.course.section },
        rules: a.rules && { pasteBlocked: a.rules.paste_blocked, workflow: a.rules.workflow, vivaQuestions: a.rules.viva_questions, vivaSecondsPerQ: a.rules.viva_seconds_per_q, vivaWeight: a.rules.viva_weight, variantsOn: a.rules.variants_on },
      },
      rows,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------- one submission's integrity report
async function teacherSubmission(sid: string, pid: string, id: string) {
  if (!uuid(id)) throw notFound("That submission");
  const [s] = await select<{
    id: string;
    status: SubStatus;
    content: string;
    last_output: string | null;
    test_results: MarkedTest[] | null;
    tests_passed: number | null;
    tests_total: number | null;
    viva_score: number | null;
    suggested_grade: number | null;
    final_grade: number | null;
    teacher_comment: string | null;
    teacher_decision: string | null;
    started_at: string;
    submitted_at: string | null;
    event_source_id: string | null;
    student: { id: string; full_name: string; initials: string };
    variant: { params: Record<string, string>; rendered_instructions: string } | null;
    assignment: {
      id: string;
      title: string;
      type: string;
      marks: number;
      starter_code: string;
      instructions_md: string;
      course: { id: string; code: string; teacher_id: string };
      rules: { viva_weight: number; paste_blocked: boolean } | null;
      secrets: { hidden_tests: HiddenTest[]; variant_spec: VariantSpec } | null;
    };
  }>(
    `submissions?select=id,status,content,last_output,test_results,tests_passed,tests_total,viva_score,suggested_grade,final_grade,teacher_comment,teacher_decision,started_at,submitted_at,event_source_id,student:profiles(id,full_name,initials),variant:variants(params,rendered_instructions),assignment:assignments!inner(id,title,type,marks,starter_code,instructions_md,course:courses!inner(id,code,teacher_id),rules:integrity_rules(viva_weight,paste_blocked),secrets:assignment_secrets(hidden_tests,variant_spec))&id=${eq(id)}&sandbox_id=${eq(sid)}&assignment.course.teacher_id=${eq(pid)}`,
  );
  if (!s) throw notFound("That submission");
  return s;
}

teacherRouter.get("/teacher/submissions/:id", requireSession("teacher"), async (req, res, next) => {
  try {
    const { sid, pid } = req.session!;
    const s = await teacherSubmission(sid, pid, String(req.params.id));
    const logId = s.event_source_id ?? s.id; // demo copies replay the seed submission's log
    const [events, flags, vivas, messages] = await Promise.all([
      select<{ seq: number; type: ProcessEvent["type"]; payload: unknown; client_time: string; server_time: string }>(
        `process_events?select=seq,type,payload,client_time,server_time&submission_id=${eq(logId)}&order=seq`,
      ),
      select<FlagRow>(`flags?select=id,rule,severity,message,evidence,teacher_status&submission_id=${eq(s.id)}&order=created_at`),
      select<{ status: string; questions: VivaQuestion[]; understanding_score: number | null; summary: string | null; rubric: Record<string, unknown> | null }>(
        `viva_sessions?select=status,questions,understanding_score,summary,rubric&submission_id=${eq(s.id)}`,
      ),
      select<{ role: "student" | "ustaad"; body: string; hint: string | null; created_at: string }>(
        `ustaad_messages?select=role,body,hint,created_at&submission_id=${eq(s.id)}&order=created_at`,
      ),
    ]);
    const param = s.assignment.secrets?.variant_spec?.param;
    const option = param && s.variant ? (s.variant.params[param] ?? null) : null;
    const tests = (s.assignment.secrets?.hidden_tests ?? []).map((t) => {
      const marked = s.test_results?.find((m) => m.name === t.name);
      return { name: t.name, call: t.call, expected: expectedFor(t, option), actual: marked?.actual ?? null, passed: marked?.passed ?? null };
    });
    const viva = vivas[0];
    // Timed quiz: each answer, right or wrong, the correct answer (teachers may see keys) and time spent.
    let quiz: unknown = null;
    if (s.assignment.type === "quiz") {
      const state = parseQuizState(s.content);
      const pool = await select<QuizQuestionRow>(`quiz_questions?select=id,position,kind,prompt_md,options,answer_key,marks&assignment_id=${eq(s.assignment.id)}&sandbox_id=${eq(sid)}`);
      if (state) {
        const mark = markQuiz(state, pool);
        let prev = 0;
        quiz = {
          startedAt: state.startedAt,
          finishedAt: state.finishedAt,
          correct: mark.correct,
          total: mark.total,
          questions: state.order.map((qid, i) => {
            const q = pool.find((x) => x.id === qid);
            const a = state.answers[qid];
            const seconds = a ? Math.round((a.atMs - prev) / 1000) : null;
            if (a) prev = a.atMs;
            const show = (v: number | string | null | undefined) => (v == null || v === "" ? null : q?.kind === "mcq" && typeof v === "number" ? (q.options?.[v] ?? null) : String(v));
            return {
              index: i,
              kind: q?.kind ?? "mcq",
              prompt: q?.prompt_md ?? "(question removed)",
              answer: show(a?.value),
              correctAnswer: q ? ("correct" in q.answer_key ? (q.options?.[q.answer_key.correct] ?? null) : q.answer_key.accepted[0] ?? null) : null,
              correct: mark.perQuestion[i]?.correct ?? false,
              seconds,
            };
          }),
        };
      }
    }
    res.set("Cache-Control", "no-store").json({
      submission: {
        id: s.id,
        status: s.status,
        code: s.content,
        startedAt: s.started_at,
        submittedAt: s.submitted_at,
        testsPassed: s.tests_passed,
        testsTotal: s.tests_total,
        vivaScore: s.viva_score,
        suggestedGrade: s.suggested_grade,
        finalGrade: s.final_grade,
        decision: s.teacher_decision,
        comment: s.teacher_comment,
      },
      student: { id: s.student.id, name: s.student.full_name, initials: s.student.initials },
      quiz,
      assignment: { id: s.assignment.id, title: s.assignment.title, type: s.assignment.type, marks: s.assignment.marks, starterCode: s.assignment.starter_code, courseCode: s.assignment.course.code, vivaWeight: s.assignment.rules?.viva_weight ?? 50, variant: option },
      // Times: client time drives the replay; server time is the tamper-proof record.
      events: events.map((e) => ({ seq: e.seq, t: Date.parse(e.client_time), serverTime: e.server_time, type: e.type, payload: e.payload })),
      flags: flags.map((f) => ({ id: f.id, rule: f.rule, severity: f.severity, message: f.message, fromSeq: f.evidence.from_seq, toSeq: f.evidence.to_seq, status: f.teacher_status })),
      viva: viva && {
        status: viva.status,
        score: viva.understanding_score,
        summary: viva.summary,
        rubric: viva.rubric,
        questions: viva.questions.map((q) => ({
          kind: q.kind,
          prompt: q.prompt,
          answer: q.answer ?? "",
          secondsAllowed: q.seconds_allowed,
          secondsTaken: q.answered_at ? Math.round((Date.parse(q.answered_at) - Date.parse(q.asked_at)) / 1000) : null,
          late: Boolean(q.late),
          awayMs: q.away_ms ?? 0,
          check: q.auto_check ?? null,
          score: q.score ?? null,
          feedback: q.feedback ?? null,
        })),
      },
      messages: messages.map((m) => ({ role: m.role, text: m.body, hint: m.hint, at: m.created_at })),
      tests,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------- the teacher's decision
const DecisionBody = z.object({
  decision: z.enum(["looks_fine", "talk_to_student"]),
  comment: z.string().max(1000).optional(),
  finalGrade: z.number().min(0).max(1000).nullable().optional(),
});

teacherRouter.post("/teacher/submissions/:id/decision", requireSession("teacher"), async (req, res, next) => {
  try {
    const { sid, pid } = req.session!;
    const body = DecisionBody.safeParse(req.body);
    if (!body.success) throw new PublicError(400, "Choose \"Looks fine\" or \"Talk to student\".", "bad_decision");
    const s = await teacherSubmission(sid, pid, String(req.params.id));
    if (s.status === "in_progress" || s.status === "viva_in_progress") throw new PublicError(409, "The student hasn't finished yet.", "not_finished");
    if (body.data.finalGrade != null && body.data.finalGrade > s.assignment.marks) throw new PublicError(400, `The mark can't be more than ${s.assignment.marks}.`, "bad_grade");
    const patch: Record<string, unknown> = { teacher_decision: body.data.decision };
    if (body.data.comment !== undefined) patch.teacher_comment = body.data.comment;
    if (body.data.finalGrade !== undefined) {
      patch.final_grade = body.data.finalGrade;
      patch.status = body.data.finalGrade == null ? "submitted" : "graded";
      patch.graded_at = body.data.finalGrade == null ? null : new Date().toISOString();
    }
    await update("submissions", `id=${eq(s.id)}`, patch);
    await update("flags", `submission_id=${eq(s.id)}&teacher_status=eq.open`, { teacher_status: body.data.decision === "looks_fine" ? "dismissed" : "followed_up" });
    res.json({ ok: true, decision: body.data.decision });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------- assignment builder
teacherRouter.get("/teacher/builder", requireSession("teacher"), async (req, res, next) => {
  try {
    const { sid, pid } = req.session!;
    const courses = await select<{ id: string; code: string; name: string; section: string | null }>(
      `courses?select=id,code,name,section&teacher_id=${eq(pid)}&sandbox_id=${eq(sid)}&order=code`,
    );
    res.set("Cache-Control", "no-store").json({ courses, templates });
  } catch (err) {
    next(err);
  }
});

const Expected = z.union([z.string().max(2000), z.record(z.string(), z.string().max(2000))]);
const CreateBody = z.object({
  courseId: z.string().regex(/^[0-9a-f-]{36}$/i),
  type: z.enum(["code", "written"]).default("code"),
  language: z.enum(["python", "javascript"]).nullable().default("python"),
  title: z.string().trim().min(2).max(120),
  instructions: z.string().trim().min(10).max(10_000),
  starterCode: z.string().max(20_000),
  referenceSolution: z.string().max(20_000),
  tests: z.array(z.object({ name: z.string().trim().min(1).max(80), call: z.string().trim().min(1).max(300), expected: Expected })).max(20),
  variants: z
    .object({ param: z.string().regex(/^[a-z_]{1,30}$/), options: z.array(z.string().trim().min(1).max(40)).min(2).max(6), fills: z.record(z.string(), z.record(z.string(), z.string().max(200))) })
    .nullable(),
  marks: z.number().int().min(1).max(100),
  dueAt: z.string().datetime({ offset: true }),
  status: z.enum(["draft", "published"]),
  rules: z.object({
    pasteBlocked: z.boolean(),
    workflow: z.enum(["run_first", "explain_first"]),
    vivaQuestions: z.number().int().min(0).max(5),
    vivaSecondsPerQ: z.number().int().min(30).max(300),
    vivaWeight: z.number().int().min(0).max(100),
    variantsOn: z.boolean(),
  }),
});

teacherRouter.post("/teacher/assignments", requireSession("teacher"), async (req, res, next) => {
  try {
    const { sid, pid } = req.session!;
    const body = CreateBody.safeParse(req.body);
    if (!body.success) {
      const issue = body.error.issues[0];
      throw new PublicError(400, `Please check "${issue?.path.join(" → ") || "the form"}": ${issue?.message ?? "invalid"}.`, "bad_assignment");
    }
    const b = body.data;
    const [course] = await select<{ id: string }>(`courses?select=id&id=${eq(b.courseId)}&teacher_id=${eq(pid)}&sandbox_id=${eq(sid)}`);
    if (!course) throw notFound("That course");
    if (b.rules.variantsOn && !b.variants) throw new PublicError(400, "Variants are on, but no versions are set up.", "bad_variants");
    if (b.type === "code" && (b.tests.length === 0 || !b.language)) throw new PublicError(400, "A coding lab needs a language and at least one hidden test.", "bad_tests");
    if (Date.parse(b.dueAt) < Date.now() && b.status === "published") throw new PublicError(400, "The due date is in the past.", "bad_due");
    const id = randomUUID();
    await insert("assignments", {
      id,
      sandbox_id: sid,
      course_id: course.id,
      type: b.type,
      title: b.title,
      instructions_md: b.instructions,
      language: b.type === "code" ? b.language : null,
      starter_code: b.starterCode,
      marks: b.marks,
      status: b.status,
      opens_at: new Date().toISOString(),
      due_at: b.dueAt,
    });
    await insert("integrity_rules", {
      assignment_id: id,
      sandbox_id: sid,
      paste_blocked: b.rules.pasteBlocked,
      workflow: b.rules.workflow,
      viva_questions: b.rules.vivaQuestions,
      viva_seconds_per_q: b.rules.vivaSecondsPerQ,
      viva_weight: b.rules.vivaWeight,
      variants_on: b.rules.variantsOn,
    });
    await insert("assignment_secrets", {
      assignment_id: id,
      sandbox_id: sid,
      reference_solution: b.referenceSolution,
      hidden_tests: b.type === "code" ? b.tests : [],
      variant_spec: b.rules.variantsOn && b.variants ? b.variants : {},
    });
    res.status(201).json({ id, status: b.status });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------- gradebook (FR-24, FR-25)
teacherRouter.get("/teacher/courses/:id/gradebook", requireSession("teacher"), async (req, res, next) => {
  try {
    const { sid, pid } = req.session!;
    const id = String(req.params.id);
    if (!uuid(id)) throw notFound("That course");
    const [c] = await select<{ id: string; code: string; name: string; section: string | null }>(`courses?select=id,code,name,section&id=${eq(id)}&teacher_id=${eq(pid)}&sandbox_id=${eq(sid)}`);
    if (!c) throw notFound("That course");
    const [roster, assignments] = await Promise.all([
      select<{ student: { id: string; full_name: string; initials: string } }>(`enrollments?select=student:profiles(id,full_name,initials)&course_id=${eq(c.id)}`),
      select<{ id: string; title: string; status: string; marks: number; due_at: string | null; submissions: { id: string; student_id: string; status: SubStatus; viva_score: number | null; suggested_grade: number | null; final_grade: number | null; teacher_decision: string | null; flags: { teacher_status: string }[] }[] }>(
        `assignments?select=id,title,status,marks,due_at,submissions(id,student_id,status,viva_score,suggested_grade,final_grade,teacher_decision,flags(teacher_status))&course_id=${eq(c.id)}&status=neq.draft&order=due_at`,
      ),
    ]);
    const students = roster.map((r) => r.student).sort((a, b) => a.full_name.localeCompare(b.full_name));
    const cols = assignments.map((a) => {
      const done = a.submissions.filter((s) => s.status === "submitted" || s.status === "graded");
      const vivas = done.map((s) => s.viva_score).filter((v): v is number => v != null);
      return {
        id: a.id,
        title: a.title,
        status: a.status,
        marks: a.marks,
        handedIn: done.length,
        avgViva: vivas.length ? Math.round(vivas.reduce((x, y) => x + y, 0) / vivas.length) : null,
        flagged: a.submissions.filter((s) => s.flags.some((f) => f.teacher_status === "open")).length,
      };
    });
    const cells: Record<string, Record<string, { submissionId: string; status: SubStatus; grade: number | null; final: boolean; viva: number | null; flagged: boolean; decision: string | null }>> = {};
    for (const a of assignments) {
      for (const s of a.submissions) {
        (cells[s.student_id] ??= {})[a.id] = {
          submissionId: s.id,
          status: s.status,
          grade: s.final_grade ?? s.suggested_grade,
          final: s.final_grade != null,
          viva: s.viva_score,
          flagged: s.flags.some((f) => f.teacher_status === "open"),
          decision: s.teacher_decision,
        };
      }
    }
    const flaggedStudents = students.filter((st) => Object.values(cells[st.id] ?? {}).some((x) => x.flagged)).map((st) => st.full_name);
    res.set("Cache-Control", "no-store").json({
      course: c,
      assignments: cols,
      students: students.map((s) => ({ id: s.id, name: s.full_name, initials: s.initials })),
      cells,
      flaggedStudents,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------- confirm or override a mark, with a comment
const GradeBody = z.object({ finalGrade: z.number().min(0).max(1000), comment: z.string().max(1000).optional() });

teacherRouter.post("/teacher/submissions/:id/grade", requireSession("teacher"), async (req, res, next) => {
  try {
    const { sid, pid } = req.session!;
    const body = GradeBody.safeParse(req.body);
    if (!body.success) throw new PublicError(400, "Enter a mark as a number.", "bad_grade");
    const s = await teacherSubmission(sid, pid, String(req.params.id));
    if (s.status === "in_progress" || s.status === "viva_in_progress") throw new PublicError(409, "The student hasn't finished yet.", "not_finished");
    if (body.data.finalGrade > s.assignment.marks) throw new PublicError(400, `The mark can't be more than ${s.assignment.marks}.`, "bad_grade");
    await update("submissions", `id=${eq(s.id)}`, { final_grade: body.data.finalGrade, teacher_comment: body.data.comment ?? null, status: "graded", graded_at: new Date().toISOString() });
    res.json({ ok: true, finalGrade: body.data.finalGrade });
  } catch (err) {
    next(err);
  }
});
