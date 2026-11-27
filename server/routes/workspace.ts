/**
 * Student workspace: open an assignment (starts the submission), save the process-event log,
 * and ask Ustaad for a hint. Every route checks the submission belongs to the caller's
 * sandbox and identity. Hidden tests and reference solutions are never selected here.
 */
import { Router } from "express";
import { z } from "zod";
import { requireSession } from "../lib/auth.js";
import { eq, insert, insertIgnoringDuplicates, select, update } from "../lib/db.js";
import { notFound, PublicError } from "../lib/errors.js";
import { enforceAi } from "../lib/limits.js";
import { ipHash } from "../lib/session.js";
import { fence, looksLikeInstructionToAi, verifiedQuote } from "../lib/promptSafety.js";
import { chooseOption, renderInstructions, type VariantSpec } from "../lib/variants.js";
import { generateJson } from "../llm.js";
import { buildUstaadPrompt, USTAAD_SYSTEM_PROMPT, USTAAD_WRITING_PROMPT, UstaadReplySchema } from "../ustaad.js";
import { EventBatchSchema, MAX_DOC_LENGTH } from "../../shared/events.js";

export const workspaceRouter = Router();

type Workflow = "run_first" | "explain_first";

interface AssignmentForStudent {
  id: string;
  title: string;
  type: "code" | "written" | "quiz";
  language: string | null;
  starter_code: string;
  instructions_md: string;
  marks: number;
  status: "draft" | "published" | "closed";
  due_at: string | null;
  course: { id: string; code: string; name: string };
  rules: { paste_blocked: boolean; workflow: Workflow; viva_questions: number; viva_seconds_per_q: number; viva_weight: number; variants_on: boolean; time_limit_minutes: number | null } | null;
  secrets: { variant_spec: VariantSpec } | null; // only variant_spec is selected (display text, not secret)
}

interface SubmissionRow {
  id: string;
  status: "in_progress" | "submitted" | "viva_in_progress" | "graded";
  content: string;
  last_output: string | null;
  started_at: string;
  submitted_at: string | null;
  viva_score: number | null;
  final_grade: number | null;
  suggested_grade: number | null;
  tests_passed: number | null;
  tests_total: number | null;
}

const SUBMISSION_FIELDS = "id,status,content,last_output,started_at,submitted_at,viva_score,final_grade,suggested_grade,tests_passed,tests_total";

async function loadAssignment(sid: string, id: string): Promise<AssignmentForStudent | null> {
  const rows = await select<AssignmentForStudent>(
    `assignments?select=id,title,type,language,starter_code,instructions_md,marks,status,due_at,course:courses(id,code,name),rules:integrity_rules(paste_blocked,workflow,viva_questions,viva_seconds_per_q,viva_weight,variants_on,time_limit_minutes),secrets:assignment_secrets(variant_spec)&id=${eq(id)}&sandbox_id=${eq(sid)}`,
  );
  return rows[0] ?? null;
}

/** The caller's own submission, or a 404 (never reveals whether someone else's exists). */
export async function ownSubmission(sid: string, pid: string, submissionId: string) {
  const rows = await select<SubmissionRow & { assignment_id: string }>(
    `submissions?select=${SUBMISSION_FIELDS},assignment_id&id=${eq(submissionId)}&student_id=${eq(pid)}&sandbox_id=${eq(sid)}`,
  );
  if (!rows[0]) throw notFound("That submission");
  return rows[0];
}

// ---------------------------------------------------------------- open an assignment
workspaceRouter.get("/student/assignments/:id", requireSession("student"), async (req, res, next) => {
  try {
    const { sid, pid } = req.session!;
    const id = String(req.params.id);
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound("That assignment");
    const a = await loadAssignment(sid, id);
    if (!a || a.status === "draft") throw notFound("That assignment");
    const enrolled = await select<{ student_id: string }>(`enrollments?select=student_id&course_id=${eq(a.course.id)}&student_id=${eq(pid)}`);
    if (!enrolled[0]) throw notFound("That assignment");

    const spec = a.secrets?.variant_spec ?? {};
    let submission = (await select<SubmissionRow>(`submissions?select=${SUBMISSION_FIELDS}&assignment_id=${eq(a.id)}&student_id=${eq(pid)}`))[0];
    let instructions = renderInstructions(a.instructions_md, spec, null);

    if (a.rules?.variants_on) {
      const existing = (await select<{ id: string; rendered_instructions: string }>(`variants?select=id,rendered_instructions&assignment_id=${eq(a.id)}&student_id=${eq(pid)}`))[0];
      if (existing) {
        instructions = existing.rendered_instructions;
      } else if (a.status === "published") {
        const option = chooseOption(spec, pid, a.id);
        instructions = renderInstructions(a.instructions_md, spec, option);
        await insertIgnoringDuplicates("variants", [{ sandbox_id: sid, assignment_id: a.id, student_id: pid, params: { [spec.param ?? "option"]: option }, rendered_instructions: instructions }], "assignment_id,student_id");
      }
    }

    // Opening a published assignment starts the submission (the "Understand" step begins now).
    if (!submission && a.status === "published") {
      const variant = (await select<{ id: string }>(`variants?select=id&assignment_id=${eq(a.id)}&student_id=${eq(pid)}`))[0];
      await insertIgnoringDuplicates(
        "submissions",
        [{ sandbox_id: sid, assignment_id: a.id, student_id: pid, variant_id: variant?.id ?? null, content: a.starter_code }],
        "assignment_id,student_id",
      );
      submission = (await select<SubmissionRow>(`submissions?select=${SUBMISSION_FIELDS}&assignment_id=${eq(a.id)}&student_id=${eq(pid)}`))[0];
    }

    const [lastEvent, messages, runs] = submission
      ? await Promise.all([
          select<{ seq: number }>(`process_events?select=seq&submission_id=${eq(submission.id)}&order=seq.desc&limit=1`),
          select<{ role: "student" | "ustaad"; body: string; hint: string | null; created_at: string }>(
            `ustaad_messages?select=role,body,hint,created_at&submission_id=${eq(submission.id)}&order=created_at`,
          ),
          select<{ seq: number }>(`process_events?select=seq&submission_id=${eq(submission.id)}&type=eq.run&limit=1`),
        ])
      : [[], [], []];

    res.set("Cache-Control", "no-store").json({
      assignment: {
        id: a.id,
        title: a.title,
        type: a.type,
        language: a.language,
        starterCode: a.starter_code,
        instructions,
        marks: a.marks,
        open: a.status === "published",
        dueAt: a.due_at,
        course: a.course,
        rules: a.rules && {
          pasteBlocked: a.rules.paste_blocked,
          workflow: a.rules.workflow,
          vivaQuestions: a.rules.viva_questions,
          vivaSecondsPerQ: a.rules.viva_seconds_per_q,
          vivaWeight: a.rules.viva_weight,
          variantsOn: a.rules.variants_on,
        },
      },
      submission: submission && {
        id: submission.id,
        status: submission.status,
        content: submission.content,
        lastOutput: submission.last_output,
        startedAt: submission.started_at,
        submittedAt: submission.submitted_at,
        nextSeq: (lastEvent[0]?.seq ?? 0) + 1,
        hasRun: runs.length > 0,
        vivaScore: submission.viva_score,
        grade: submission.final_grade ?? submission.suggested_grade,
        testsPassed: submission.tests_passed,
        testsTotal: submission.tests_total,
      },
      messages: messages.map((m) => ({ role: m.role, text: m.body, hint: m.hint, at: m.created_at })),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------- save the process-event log
const SaveBody = z.object({
  events: EventBatchSchema.shape.events.optional(),
  doc: z.string().max(MAX_DOC_LENGTH).optional(),          // current editor text (autosave)
  lastOutput: z.string().max(10_000).optional(),
});

workspaceRouter.post("/submissions/:id/events", requireSession("student"), async (req, res, next) => {
  try {
    const { sid, pid } = req.session!;
    const body = SaveBody.safeParse(req.body);
    if (!body.success) throw new PublicError(400, "Couldn't save your work: the data was malformed. Refresh the page.", "bad_events");
    if (body.data.events && !EventBatchSchema.safeParse({ events: body.data.events }).success) {
      throw new PublicError(400, "Couldn't save your work: events were out of order. Refresh the page.", "bad_events");
    }
    const sub = await ownSubmission(sid, pid, String(req.params.id));
    if (sub.status !== "in_progress") throw new PublicError(409, "This assignment has been submitted, so it can't be changed.", "submitted");

    const events = body.data.events ?? [];
    if (events.length) {
      await insertIgnoringDuplicates(
        "process_events",
        events.map((e) => ({ sandbox_id: sid, submission_id: sub.id, seq: e.seq, type: e.type, payload: e.payload, client_time: new Date(e.t).toISOString() })),
        "submission_id,seq",
      );
    }
    const patch: Record<string, unknown> = {};
    if (body.data.doc !== undefined) patch.content = body.data.doc;
    if (body.data.lastOutput !== undefined) patch.last_output = body.data.lastOutput;
    if (Object.keys(patch).length) await update("submissions", `id=${eq(sub.id)}`, patch);

    res.json({ savedThrough: events.at(-1)?.seq ?? null, savedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------- Ustaad hint
const UstaadBody = z.object({
  message: z.string().trim().min(1).max(1500),
  code: z.string().max(MAX_DOC_LENGTH),
  output: z.string().max(10_000).nullable().optional(),
  hasRun: z.boolean(),
});

workspaceRouter.post("/submissions/:id/ustaad", requireSession("student"), async (req, res, next) => {
  try {
    const { sid, pid } = req.session!;
    const body = UstaadBody.safeParse(req.body);
    if (!body.success) throw new PublicError(400, "Write a message to Ustaad first (up to 1,500 characters).", "bad_message");
    const sub = await ownSubmission(sid, pid, String(req.params.id));
    if (sub.status !== "in_progress") throw new PublicError(409, "Hints are for work in progress. This assignment is already submitted.", "submitted");
    const a = await loadAssignment(sid, sub.assignment_id);
    if (!a) throw notFound("That assignment");
    const workflow = a.rules?.workflow ?? "run_first";

    // A message that tries to instruct the AI never reaches it (prompt injection). It is still saved,
    // so the teacher sees the attempt in the chat.
    if (looksLikeInstructionToAi(body.data.message)) {
      const text = "I can only talk about your work, not take instructions about how I check it. Tell me in your own words what your code does.";
      await insert("ustaad_messages", [
        { sandbox_id: sid, submission_id: sub.id, role: "student", body: body.data.message, hint: null },
        { sandbox_id: sid, submission_id: sub.id, role: "ustaad", body: text, hint: null },
      ]);
      res.json({ reply: { text, hint: null, nextStep: null, allowExecution: workflow !== "explain_first", checks: { goalClear: false, logicExplained: false, outputInterpreted: false } } });
      return;
    }
    await enforceAi(sid, ipHash(req));

    const variant = (await select<{ rendered_instructions: string }>(`variants?select=rendered_instructions&assignment_id=${eq(a.id)}&student_id=${eq(pid)}`))[0];
    const history = await select<{ role: "student" | "ustaad"; body: string }>(
      `ustaad_messages?select=role,body&submission_id=${eq(sub.id)}&order=created_at.desc&limit=6`,
    );
    // Earlier student turns are fenced too, and an earlier instruction attempt is left out entirely.
    const priorTurns = history.reverse().filter((m) => m.role === "ustaad" || !looksLikeInstructionToAi(m.body));
    const prompt = buildUstaadPrompt({
      assignmentTitle: a.title,
      instructions: variant?.rendered_instructions ?? renderInstructions(a.instructions_md, a.secrets?.variant_spec ?? {}, null),
      language: a.language ?? "text",
      kind: a.type === "written" ? "written" : "code",
      workflow: a.rules?.workflow ?? "run_first",
      hasRun: body.data.hasRun,
      code: body.data.code,
      output: body.data.output ?? null,
      studentMessage: body.data.message,
    });
    const result = await generateJson(
      {
        purpose: "hint",
        system: a.type === "written" ? USTAAD_WRITING_PROMPT : USTAAD_SYSTEM_PROMPT,
        messages: [
          ...priorTurns.map((m) => (m.role === "ustaad" ? { role: "assistant" as const, content: m.body } : { role: "user" as const, content: `<student_message>\n${fence(m.body)}\n</student_message>` })),
          { role: "user" as const, content: prompt },
        ],
        schema: UstaadReplySchema,
        schemaName: "ustaad_reply",
        maxOutputTokens: 600,
        sandboxId: sid,
        timeoutMs: 6_000,
      },
    );
    const r = result.data;
    // A check counts only when Ustaad quotes the student's own chat words and the server finds them
    // there. Code comments, Ustaad's own words and instruction attempts never count.
    const own = [...priorTurns.filter((m) => m.role === "student").map((m) => m.body), body.data.message];
    const c = r.comprehensionChecks;
    const checks = {
      goalClear: c.goalClear && verifiedQuote(c.goalEvidence, own),
      logicExplained: c.logicExplained && verifiedQuote(c.logicEvidence, own),
      outputInterpreted: c.outputInterpreted && body.data.hasRun && verifiedQuote(c.outputEvidence, own),
    };
    // Explain-first: running unlocks only on a verified plan (goal and logic), not on the model's say-so.
    const allowExecution = workflow === "explain_first" ? r.allowExecution && checks.goalClear && checks.logicExplained : true;
    await insert("ustaad_messages", [
      { sandbox_id: sid, submission_id: sub.id, role: "student", body: body.data.message, hint: null },
      { sandbox_id: sid, submission_id: sub.id, role: "ustaad", body: r.message, hint: r.hint },
    ]);
    res.json({
      reply: {
        text: r.message,
        hint: r.hint,
        nextStep: r.nextStepInstruction,
        allowExecution,
        checks,
      },
    });
  } catch (err) {
    next(err);
  }
});
