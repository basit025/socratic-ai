/**
 * Home screens. Every query is scoped to the caller's sandbox AND identity from the signed session.
 */
import { Router } from "express";
import { eq, select } from "../lib/db.js";
import { requireSession } from "../lib/auth.js";

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
homeRouter.get("/student/home", requireSession("student"), async (req, res, next) => {
  try {
    const { sid, pid, name } = req.session!;
    const [enrollments, submissions] = await Promise.all([
      select<{ course: { id: string; code: string; name: string; section: string | null; term: string | null; teacher: { full_name: string }; assignments: AssignmentRow[] } }>(
        `enrollments?select=course:courses(id,code,name,section,term,teacher:profiles!courses_teacher_id_fkey(full_name),assignments(id,title,type,status,due_at,marks))&student_id=${eq(pid)}&sandbox_id=${eq(sid)}`,
      ),
      select<{ assignment_id: string; status: SubmissionStatus; viva_score: number | null; final_grade: number | null; suggested_grade: number | null }>(
        `submissions?select=assignment_id,status,viva_score,final_grade,suggested_grade&student_id=${eq(pid)}&sandbox_id=${eq(sid)}`,
      ),
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
              dueAt: a.due_at,
              marks: a.marks,
              submission: s ? { status: s.status, vivaScore: s.viva_score, grade: s.final_grade ?? s.suggested_grade } : null,
            };
          }),
      }))
      .sort((a, b) => a.code.localeCompare(b.code));
    res.set("Cache-Control", "no-store").json({ name, courses });
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
