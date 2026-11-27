/**
 * Home screens. Every query is scoped to the caller's sandbox AND identity from the signed session.
 */
import { Router } from "express";
import { eq, select } from "../lib/db.js";
import { requireSession } from "../lib/auth.js";
import { notFound } from "../lib/errors.js";

export const homeRouter = Router();

type SubmissionStatus = "in_progress" | "submitted" | "viva_in_progress" | "graded";

interface AssignmentRow {
  id: string;
  title: string;
  type: "code" | "written" | "handwritten" | "quiz";
  status: "draft" | "published" | "closed";
  due_at: string | null;
  marks: number;
}

// ---------------------------------------------------------------- student
type HomeAssignment = AssignmentRow & { opens_at: string | null };
interface HomeSubmission {
  assignment_id: string;
  status: SubmissionStatus;
  viva_score: number | null;
  final_grade: number | null;
  suggested_grade: number | null;
  submitted_at: string | null;
  graded_at: string | null;
}

export interface Notice {
  id: string;
  kind: "announcement" | "new_work" | "marked" | "due_soon";
  courseId: string;
  courseCode: string;
  title: string;
  body: string;
  at: string;
  assignmentId?: string;
  assignmentType?: string;
  dueAt?: string | null;
}

const DAY = 86_400_000;

/**
 * One feed for everything that happened in the student's courses: teachers' news, new work, marks released,
 * and reminders for work due in the next two days. Built from existing rows, so it never goes stale.
 */
export function buildNotices(
  courses: { id: string; code: string; assignments: { id: string; title: string; type: string; open: boolean; dueAt: string | null; opensAt: string | null; marks: number; submission: { status: SubmissionStatus; grade: number | null; confirmed: boolean; gradedAt: string | null } | null }[] }[],
  news: { id: string; course_id: string; title: string; body: string; posted_at: string }[],
  now = Date.now(),
): Notice[] {
  const code = new Map(courses.map((c) => [c.id, c.code]));
  const out: Notice[] = news
    .filter((n) => Date.parse(n.posted_at) <= now)
    .map((n) => ({ id: `a:${n.id}`, kind: "announcement", courseId: n.course_id, courseCode: code.get(n.course_id) ?? "", title: n.title, body: n.body, at: n.posted_at }));
  for (const c of courses) {
    for (const a of c.assignments) {
      const base = { courseId: c.id, courseCode: c.code, assignmentId: a.id, assignmentType: a.type, dueAt: a.dueAt };
      const s = a.submission;
      const opened = a.opensAt ? Date.parse(a.opensAt) : NaN;
      if (a.open && opened <= now && now - opened <= 7 * DAY) out.push({ ...base, id: `n:${a.id}`, kind: "new_work", title: a.title, body: "", at: a.opensAt! });
      const graded = s?.gradedAt ? Date.parse(s.gradedAt) : NaN;
      if (s?.confirmed && graded <= now && now - graded <= 14 * DAY) out.push({ ...base, id: `m:${a.id}`, kind: "marked", title: a.title, body: `${s.grade}/${a.marks}`, at: s.gradedAt! });
      const due = a.dueAt ? Date.parse(a.dueAt) : NaN;
      const pending = !s || s.status === "in_progress" || s.status === "viva_in_progress";
      if (a.open && pending && due > now && due - now <= 2 * DAY) out.push({ ...base, id: `d:${a.id}`, kind: "due_soon", title: a.title, body: "", at: new Date(Math.max(due - 2 * DAY, opened || 0)).toISOString() });
    }
  }
  return out.sort((x, y) => y.at.localeCompare(x.at)).slice(0, 30);
}

homeRouter.get("/student/home", requireSession("student"), async (req, res, next) => {
  try {
    const { sid, pid, name } = req.session!;
    const [enrollments, submissions] = await Promise.all([
      select<{ course: { id: string; code: string; name: string; section: string | null; term: string | null; teacher: { full_name: string }; assignments: HomeAssignment[] } }>(
        `enrollments?select=course:courses(id,code,name,section,term,teacher:profiles!courses_teacher_id_fkey(full_name),assignments(id,title,type,status,opens_at,due_at,marks))&student_id=${eq(pid)}&sandbox_id=${eq(sid)}`,
      ),
      select<HomeSubmission>(`submissions?select=assignment_id,status,viva_score,final_grade,suggested_grade,submitted_at,graded_at&student_id=${eq(pid)}&sandbox_id=${eq(sid)}`),
    ]);
    const byAssignment = new Map(submissions.map((s) => [s.assignment_id, s]));
    const courses = enrollments
      .map(({ course: c }) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        section: c.section,
        term: c.term,
        teacher: c.teacher.full_name,
        assignments: c.assignments
          .filter((a) => a.status !== "draft") // students never see drafts
          .sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""))
          .map((a) => {
            const s = byAssignment.get(a.id);
            return {
              id: a.id,
              title: a.title,
              type: a.type,
              open: a.status === "published",
              opensAt: a.opens_at,
              dueAt: a.due_at,
              marks: a.marks,
              submission: s
                ? { status: s.status, vivaScore: s.viva_score, grade: s.final_grade ?? s.suggested_grade, confirmed: s.final_grade != null, submittedAt: s.submitted_at, gradedAt: s.graded_at }
                : null,
            };
          }),
      }))
      .sort((a, b) => a.code.localeCompare(b.code));
    // The latest news from every course, in one place (no WhatsApp groups to scroll through).
    const ids = courses.map((c) => c.id);
    const news = ids.length
      ? await select<{ id: string; course_id: string; title: string; body: string; posted_at: string }>(
          `announcements?select=id,course_id,title,body,posted_at&course_id=in.(${ids.map(encodeURIComponent).join(",")})&sandbox_id=${eq(sid)}&order=posted_at.desc&limit=20`,
        )
      : [];
    const code = new Map(courses.map((c) => [c.id, c.code]));
    res.set("Cache-Control", "no-store").json({
      name,
      courses,
      announcements: news.map((n) => ({ id: n.id, courseId: n.course_id, courseCode: code.get(n.course_id) ?? "", title: n.title, body: n.body, postedAt: n.posted_at })),
      notifications: buildNotices(courses, news),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------- teacher
homeRouter.get("/teacher/home", requireSession("teacher"), async (req, res, next) => {
  try {
    const { sid, pid, name } = req.session!;
    const rows = await select<{
      id: string;
      code: string;
      name: string;
      section: string | null;
      term: string | null;
      join_code: string;
      enrollments: { count: number }[];
      assignments: (AssignmentRow & { submissions: { id: string; status: SubmissionStatus; flags: { teacher_status: string }[] }[] })[];
    }>(
      `courses?select=id,code,name,section,term,join_code,enrollments(count),assignments(id,title,type,status,due_at,marks,submissions(id,status,flags(teacher_status)))&teacher_id=${eq(pid)}&sandbox_id=${eq(sid)}&order=code`,
    );
    const courses = rows.map((c) => {
      const assignments = c.assignments
        .sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""))
        .map((a) => {
          const handedIn = a.submissions.filter((s) => s.status !== "in_progress");
          const toReview = a.submissions.filter((s) => s.status === "submitted").length;
          const flagged = a.submissions.filter((s) => s.flags.some((f) => f.teacher_status === "open")).length;
          return { id: a.id, title: a.title, type: a.type, status: a.status, dueAt: a.due_at, marks: a.marks, submitted: handedIn.length, toReview, flagged };
        });
      return {
        id: c.id,
        code: c.code,
        name: c.name,
        section: c.section,
        term: c.term,
        joinCode: c.join_code,
        students: c.enrollments[0]?.count ?? 0,
        toReview: assignments.reduce((n, a) => n + a.toReview, 0),
        flagged: assignments.reduce((n, a) => n + a.flagged, 0),
        assignments,
      };
    });
    res.set("Cache-Control", "no-store").json({ name, courses });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------- a course page (both roles)
homeRouter.get("/courses/:id", requireSession(), async (req, res, next) => {
  try {
    const { sid, pid, role } = req.session!;
    const id = String(req.params.id);
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound("That course");
    const [c] = await select<{ id: string; code: string; name: string; section: string | null; term: string | null; join_code: string; teacher_id: string; teacher: { full_name: string } }>(
      `courses?select=id,code,name,section,term,join_code,teacher_id,teacher:profiles!courses_teacher_id_fkey(full_name)&id=${eq(id)}&sandbox_id=${eq(sid)}`,
    );
    if (!c) throw notFound("That course");
    if (role === "teacher" && c.teacher_id !== pid) throw notFound("That course");
    if (role === "student") {
      const [e] = await select<{ student_id: string }>(`enrollments?select=student_id&course_id=${eq(c.id)}&student_id=${eq(pid)}`);
      if (!e) throw notFound("That course");
    }
    const [modules, announcements, assignmentRows, enrolled, mySubs] = await Promise.all([
      select<{ id: string; week: number; title: string; notes_md: string }>(`modules?select=id,week,title,notes_md&course_id=${eq(c.id)}&order=week`),
      select<{ id: string; title: string; body: string; posted_at: string }>(`announcements?select=id,title,body,posted_at&course_id=${eq(c.id)}&order=posted_at.desc`),
      select<
        AssignmentRow & {
          module_id: string | null;
          opens_at: string | null;
          language: string | null;
          submissions: { status: SubmissionStatus }[];
          rules: { time_limit_minutes: number | null; viva_questions: number; paste_blocked: boolean; fullscreen_required: boolean } | null;
          quiz_questions: { count: number }[];
          secrets: { variant_spec: { draw?: number } | null } | null;
        }
      >(
        `assignments?select=id,title,type,status,opens_at,due_at,marks,language,module_id,submissions(status),rules:integrity_rules(time_limit_minutes,viva_questions,paste_blocked,fullscreen_required),quiz_questions(count),secrets:assignment_secrets(variant_spec)&course_id=${eq(c.id)}&order=due_at`,
      ),
      select<{ count: number }>(`enrollments?select=count&course_id=${eq(c.id)}`),
      role === "student"
        ? select<HomeSubmission>(`submissions?select=assignment_id,status,viva_score,final_grade,suggested_grade,submitted_at,graded_at&student_id=${eq(pid)}&sandbox_id=${eq(sid)}`)
        : Promise.resolve([]),
    ]);
    const mine = new Map(mySubs.map((s) => [s.assignment_id, s]));
    const visible = assignmentRows.filter((a) => role === "teacher" || a.status !== "draft");
    const toItem = (a: (typeof visible)[number]) => {
      const pool = a.quiz_questions[0]?.count ?? 0;
      const s = mine.get(a.id);
      return {
        id: a.id,
        title: a.title,
        type: a.type,
        status: a.status,
        opensAt: a.opens_at,
        dueAt: a.due_at,
        marks: a.marks,
        language: a.language,
        // Only the numbers a student sees on the assignment's rules chips (never answers or tests).
        timeLimitMinutes: a.rules?.time_limit_minutes ?? null,
        vivaQuestions: a.type === "quiz" ? 0 : (a.rules?.viva_questions ?? 0),
        pasteBlocked: a.rules?.paste_blocked ?? false,
        fullscreen: a.rules?.fullscreen_required ?? false,
        questions: a.type === "quiz" ? Math.min(a.secrets?.variant_spec?.draw ?? pool, pool) : null,
        ...(role === "teacher"
          ? { handedIn: a.submissions.filter((x) => x.status !== "in_progress").length }
          : {
              submission: s
                ? { status: s.status, grade: s.final_grade ?? s.suggested_grade, confirmed: s.final_grade != null, vivaScore: s.viva_score, submittedAt: s.submitted_at, gradedAt: s.graded_at }
                : null,
            }),
      };
    };
    res.set("Cache-Control", "no-store").json({
      course: { id: c.id, code: c.code, name: c.name, section: c.section, term: c.term, teacher: c.teacher.full_name, students: enrolled[0]?.count ?? 0, ...(role === "teacher" ? { joinCode: c.join_code } : {}) },
      weeks: modules.map((m) => ({ week: m.week, title: m.title, notes: m.notes_md, assignments: visible.filter((a) => a.module_id === m.id).map(toItem) })),
      unscheduled: visible.filter((a) => !a.module_id || !modules.some((m) => m.id === a.module_id)).map(toItem),
      announcements: announcements.filter((a) => Date.parse(a.posted_at) <= Date.now()).map((a) => ({ id: a.id, title: a.title, body: a.body, postedAt: a.posted_at })),
    });
  } catch (err) {
    next(err);
  }
});
