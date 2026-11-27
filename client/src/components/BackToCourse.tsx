import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";

/** "← CS-341 · Data Mining / Assignments": back to where this work lives in its course. */
export function BackToCourse({ course, tab = "assignments", className = "mb-4" }: { course?: { id?: string; code: string; name: string } | null; tab?: "assignments" | "quizzes" | "marks"; className?: string }) {
  const label = tab === "quizzes" ? "Quizzes" : tab === "marks" ? "Marks" : "Assignments";
  if (!course?.id)
    return (
      <Link to="/student" className={`${className} inline-flex min-h-9 items-center gap-1.5 font-medium text-action hover:underline`}>
        <ArrowLeft className="size-4" aria-hidden /> Home
      </Link>
    );
  return (
    <Link to={`/student/courses/${course.id}/${tab}`} className={`${className} inline-flex min-h-9 max-w-full items-center gap-1.5 font-medium text-action hover:underline`}>
      <ArrowLeft className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{course.code} · {course.name}</span>
      <span className="text-ink-3">/ {label}</span>
    </Link>
  );
}
