/**
 * Study with Ustaad: a tutor on the course's lectures, and practice questions made from a lecture.
 * Nothing here is marked. Both roles may use it on their own courses (teachers see what students get).
 * Every query is scoped to the caller's sandbox and identity; AI calls are rate-limited like hints.
 */
import { Router } from "express";
import { z } from "zod";
import { eq, select } from "../lib/db.js";
import { requireSession } from "../lib/auth.js";
import { notFound, PublicError } from "../lib/errors.js";
import { enforceAi } from "../lib/limits.js";
import { ipHash } from "../lib/session.js";
import { generateJson } from "../llm.js";
import { fence } from "../lib/promptSafety.js";
import { deckFor, deckPages } from "../lib/lectureSlides.js";
import {
  buildPracticePrompt,
  buildTutorPrompt,
  cleanPractice,
  PRACTICE_SYSTEM_PROMPT,
  PracticeSchema,
  TUTOR_SYSTEM_PROMPT,
  TutorReplySchema,
  type Practice,
} from "../study.js";

export const studyRouter = Router();

interface CourseRow {
  id: string;
  code: string;
  name: string;
  teacher_id: string;
}

/** The course, if the caller teaches it or is enrolled in it; otherwise a 404. */
async function accessibleCourse(sid: string, pid: string, role: "student" | "teacher", id: string): Promise<CourseRow> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound("That course");
  const [c] = await select<CourseRow>(`courses?select=id,code,name,teacher_id&id=${eq(id)}&sandbox_id=${eq(sid)}`);
  if (!c) throw notFound("That course");
  if (role === "teacher" && c.teacher_id !== pid) throw notFound("That course");
  if (role === "student") {
    const [e] = await select<{ student_id: string }>(`enrollments?select=student_id&course_id=${eq(c.id)}&student_id=${eq(pid)}`);
    if (!e) throw notFound("That course");
  }
  return c;
}

const lecturesOf = (courseId: string) =>
  select<{ id: string; week: number; title: string; notes_md: string }>(`modules?select=id,week,title,notes_md&course_id=${eq(courseId)}&order=week`);

// ---------------------------------------------------------------- the teacher's own slides
/**
 * Signed links to the pages of a lecture's original slide deck (and each page's text, for Ustaad).
 * Decks belong to the institution's own courses, so real accounts' courses never pick one up by code.
 */
studyRouter.get("/courses/:id/lectures/:week/slides", requireSession(), async (req, res, next) => {
  try {
    const { sid, pid, role, demo } = req.session!;
    const week = Number(req.params.week);
    if (!Number.isInteger(week) || week < 1 || week > 60) throw notFound("That lecture");
    const c = await accessibleCourse(sid, pid, role, String(req.params.id));
    const deck = demo === false ? null : deckFor(c.code, week);
    if (!deck) return void res.json({ pages: [] });
    res.setHeader("Cache-Control", "private, max-age=1800");
    res.json({ pages: await deckPages(deck) });
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------- tutor chat
const TutorBody = z.object({
  message: z.string().trim().min(1).max(1500),
  week: z.number().int().min(0).max(60).nullable().optional(),
  slide: z.object({ heading: z.string().max(300), body: z.string().max(6000) }).nullable().optional(),
  history: z
    .array(z.object({ role: z.enum(["student", "ustaad"]), text: z.string().max(4000) }))
    .max(20)
    .optional(),
});

studyRouter.post("/courses/:id/tutor", requireSession(), async (req, res, next) => {
  try {
    const { sid, pid, role } = req.session!;
    const body = TutorBody.safeParse(req.body);
    if (!body.success) throw new PublicError(400, "Write a question for Ustaad first (up to 1,500 characters).", "bad_message");
    const c = await accessibleCourse(sid, pid, role, String(req.params.id));
    await enforceAi(sid, ipHash(req));
    const [lectures, graded] = await Promise.all([
      lecturesOf(c.id),
      select<{ title: string }>(`assignments?select=title&course_id=${eq(c.id)}&status=neq.draft`),
    ]);
    const prompt = buildTutorPrompt({
      courseCode: c.code,
      courseName: c.name,
      lectures: lectures.map((l) => ({ week: l.week, title: l.title, notes: l.notes_md })),
      week: body.data.week ?? null,
      slide: body.data.slide ?? null,
      gradedTitles: graded.map((g) => g.title),
      message: body.data.message,
    });
    // History comes from the browser: student turns are fenced like the current message, and no turn can
    // close one of our tags. (The tutor grades nothing, so a forged tutor turn can't change a mark.)
    const history = (body.data.history ?? []).slice(-6).map((m) =>
      m.role === "ustaad" ? { role: "assistant" as const, content: fence(m.text) } : { role: "user" as const, content: `<student_message>\n${fence(m.text)}\n</student_message>` },
    );
    const result = await generateJson({
      purpose: "hint",
      system: TUTOR_SYSTEM_PROMPT,
      messages: [...history, { role: "user" as const, content: prompt }],
      schema: TutorReplySchema,
      schemaName: "tutor_reply",
      maxOutputTokens: 900,
      sandboxId: sid,
      timeoutMs: 7_000,
    });
    res.json({ reply: { text: result.data.message, followUps: result.data.followUps.slice(0, 3) } });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------- practice questions
const PracticeBody = z.object({
  week: z.number().int().min(0).max(60),
  count: z.number().int().min(3).max(10).optional(),
  avoid: z.array(z.string().max(400)).max(30).optional(),
});

/** First set per lecture is reused per server instance, so most "Quiz me" clicks cost no AI call. */
const firstSet = new Map<string, { at: number; questions: Practice["questions"] }>();
const CACHE_MS = 6 * 3_600_000;

studyRouter.post("/courses/:id/practice", requireSession(), async (req, res, next) => {
  try {
    const { sid, pid, role } = req.session!;
    const body = PracticeBody.safeParse(req.body);
    if (!body.success) throw new PublicError(400, "Pick a lecture to practise.", "bad_request");
    const c = await accessibleCourse(sid, pid, role, String(req.params.id));
    const lecture = (await lecturesOf(c.id)).find((l) => l.week === body.data.week);
    if (!lecture) throw notFound("That lecture");
    if (lecture.notes_md.trim().length < 80) throw new PublicError(409, "This lecture doesn't have enough material yet to make practice questions.", "no_material");
    const count = body.data.count ?? 5;
    const avoid = body.data.avoid ?? [];
    const key = `${c.code}:${lecture.week}:${lecture.notes_md.length}:${count}`;
    const cached = firstSet.get(key);
    if (!avoid.length && cached && Date.now() - cached.at < CACHE_MS) {
      res.json({ questions: cached.questions });
      return;
    }
    await enforceAi(sid, ipHash(req));
    const result = await generateJson({
      purpose: "other",
      system: PRACTICE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildPracticePrompt(c, { week: lecture.week, title: lecture.title, notes: lecture.notes_md }, count, avoid) }],
      schema: PracticeSchema,
      schemaName: "practice_questions",
      maxOutputTokens: 2_500,
      temperature: avoid.length ? 0.9 : 0.4,
      sandboxId: sid,
      timeoutMs: 15_000,
    });
    const questions = cleanPractice(result.data, count);
    if (questions.length < Math.min(3, count)) throw new PublicError(502, "Ustaad couldn't make good questions this time. Please try again.", "bad_practice");
    if (!avoid.length) firstSet.set(key, { at: Date.now(), questions });
    res.json({ questions });
  } catch (err) {
    next(err);
  }
});
