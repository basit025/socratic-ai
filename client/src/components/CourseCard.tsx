/** A course as a card: its colour band, code, name, teacher and how far the student has got. */
import { Link } from "react-router";
import { courseStyle } from "../lib/courseStyle";
import { coursePercent, needsWork, type StudentCourse } from "../lib/student";

export function CourseCard({ c }: { c: StudentCourse }) {
  const st = courseStyle(c.code);
  const total = c.assignments.length;
  const handedIn = c.assignments.filter((a) => a.submission && a.submission.status !== "in_progress").length;
  const todo = c.assignments.filter(needsWork).length;
  const pct = coursePercent(c.assignments);
  return (
    <Link to={`/student/courses/${c.id}`} data-course-card className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-shadow hover:shadow-md focus-visible:shadow-md">
      <div className="relative h-24 px-4 pt-3 text-white" style={{ backgroundColor: st.color }}>
        <svg aria-hidden className="absolute inset-0 h-full w-full opacity-[0.13]" preserveAspectRatio="none" viewBox="0 0 200 80">
          <circle cx="170" cy="10" r="42" fill="#fff" />
          <circle cx="120" cy="90" r="34" fill="#fff" />
        </svg>
        <p className="relative text-sm font-semibold tracking-wide opacity-95">{c.code}</p>
        <st.icon className="absolute right-4 bottom-3 size-8 opacity-90" aria-hidden />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="leading-snug font-semibold text-ink group-hover:text-action">{c.name}</p>
        <p className="mt-0.5 text-sm text-ink-3">{c.teacher}{c.section ? ` · ${c.section}` : ""}</p>
        <div className="mt-auto pt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-locked-line" aria-hidden>
            <div className="h-full rounded-full" style={{ width: `${total ? Math.round((handedIn / total) * 100) : 0}%`, backgroundColor: st.color }} />
          </div>
          <p className="mt-1.5 flex justify-between gap-2 text-xs text-ink-3">
            <span>{handedIn}/{total} handed in</span>
            <span className={todo ? "font-semibold text-action" : ""}>{todo ? `${todo} to do` : pct ? `${pct.pct}% so far` : "Nothing due"}</span>
          </p>
        </div>
      </div>
    </Link>
  );
}
