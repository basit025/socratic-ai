/** Shared student-side types and the classroom words used for every assignment status. */
import { Camera, Code2, ListChecks, PenLine, type LucideIcon } from "lucide-react";
import type { ChipTone } from "../components/ui";

export type SubmissionStatus = "in_progress" | "submitted" | "viva_in_progress" | "graded";

export interface MySubmission {
  status: SubmissionStatus;
  vivaScore: number | null;
  grade: number | null;
  confirmed: boolean;
  submittedAt: string | null;
  gradedAt: string | null;
}

export interface StudentAssignment {
  id: string;
  title: string;
  type: string;
  open: boolean;
  opensAt: string | null;
  dueAt: string | null;
  marks: number;
  submission: MySubmission | null;
}

export interface StudentCourse {
  id: string;
  code: string;
  name: string;
  section: string | null;
  term: string | null;
  teacher: string;
  assignments: StudentAssignment[];
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

export interface StudentHomeData {
  name: string;
  courses: StudentCourse[];
  announcements: { id: string; courseId: string; courseCode: string; title: string; body: string; postedAt: string }[];
  notifications: Notice[];
}

/** One status per assignment, in classroom words, with a colour from the shared language. */
export function statusOf(a: { open: boolean; marks: number; submission: Pick<MySubmission, "status" | "grade" | "confirmed"> | null | undefined }): { tone: ChipTone; label: string } {
  const s = a.submission?.status;
  if (s === "graded") return { tone: "done", label: a.submission?.grade != null ? `Marked: ${fmtMark(a.submission.grade)}/${a.marks}` : "Marked" };
  if (s === "submitted") return { tone: "done", label: "Submitted" };
  if (s === "viva_in_progress") return { tone: "attention", label: "Viva not finished" };
  if (s === "in_progress") return a.open ? { tone: "attention", label: "In progress" } : { tone: "locked", label: "Missed" };
  return a.open ? { tone: "action", label: "To do" } : { tone: "locked", label: "Closed" };
}

export const fmtMark = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export const needsWork = (a: { open: boolean; submission: { status: SubmissionStatus } | null | undefined }) =>
  a.open && (!a.submission || a.submission.status === "in_progress" || a.submission.status === "viva_in_progress");

export function kindOf(type: string): { icon: LucideIcon; label: string; plural: string } {
  if (type === "quiz") return { icon: ListChecks, label: "Quiz", plural: "Quizzes" };
  if (type === "written") return { icon: PenLine, label: "Written", plural: "Written tasks" };
  if (type === "handwritten") return { icon: Camera, label: "Handwritten", plural: "Handwritten tasks" };
  return { icon: Code2, label: "Lab", plural: "Labs" };
}

/** Where a finished piece of work shows its marks and feedback. */
export const resultsLink = (id: string, type: string) => (type === "quiz" ? `/student/assignments/${id}` : `/student/assignments/${id}/viva`);

/** Percentage over marked work, weighted by each task's marks (like a real course total). */
export function coursePercent(xs: { marks: number; submission: { grade: number | null } | null | undefined }[]): { got: number; outOf: number; pct: number } | null {
  const marked = xs.filter((a) => a.submission?.grade != null && a.marks > 0);
  if (!marked.length) return null;
  const got = marked.reduce((n, a) => n + a.submission!.grade!, 0);
  const outOf = marked.reduce((n, a) => n + a.marks, 0);
  return { got, outOf, pct: Math.round((got / outOf) * 100) };
}
