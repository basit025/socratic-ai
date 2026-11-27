/**
 * Marks across all courses: one row per course with its total so far, expandable into every marked task.
 * A mark is "confirmed" once the teacher has reviewed it; until then it's the platform's suggestion.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ChevronDown, Trophy } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { useStudentData } from "../components/Shell";
import { Card, Chip, ErrorState, PageHeader, Skeleton, cx } from "../components/ui";
import { courseStyle } from "../lib/courseStyle";
import { formatDay } from "../lib/format";
import { coursePercent, fmtMark, kindOf, resultsLink, statusOf } from "../lib/student";

export function StudentMarks() {
  const home = useStudentData();
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    document.title = "Marks · Socratic AI";
  }, []);

  const courses = home.status === "ready" ? home.data.courses : [];
  const overall = coursePercent(courses.flatMap((c) => c.assignments));

  return (
    <AppShell>
      <PageHeader
        title="Marks"
        subtitle="Your marks in every course. A mark is final once your teacher confirms it."
        action={
          overall && (
            <div className="rounded-xl border border-line bg-surface px-4 py-2 text-right">
              <p className="text-xs font-medium text-ink-3">Across all courses</p>
              <p className={cx("text-2xl font-bold tabular-nums", overall.pct >= 50 ? "text-done" : "text-attention")}>{overall.pct}%</p>
            </div>
          )
        }
      />
      {home.status === "loading" && <Skeleton className="h-96" />}
      {home.status === "error" && <ErrorState message={home.message} onRetry={home.reload} />}
      {home.status === "ready" && (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[1fr_8rem_8rem_7rem_2.5rem] gap-3 border-b border-line bg-canvas px-5 py-2.5 text-xs font-semibold tracking-wide text-ink-3 uppercase sm:grid">
            <span>Course</span>
            <span className="text-right">Marked</span>
            <span className="text-right">Marks so far</span>
            <span className="text-right">Total</span>
            <span />
          </div>
          <ul className="divide-y divide-line">
            {courses.map((c) => {
              const st = courseStyle(c.code);
              const pct = coursePercent(c.assignments);
              const marked = c.assignments.filter((a) => a.submission?.grade != null);
              const isOpen = open === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : c.id)}
                    aria-expanded={isOpen}
                    className="grid w-full grid-cols-[1fr_auto_2.5rem] items-center gap-3 px-5 py-3.5 text-left hover:bg-canvas sm:grid-cols-[1fr_8rem_8rem_7rem_2.5rem]"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md text-white" style={{ backgroundColor: st.color }}>
                        <st.icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-ink-3">{c.code}</span>
                        <span className="block truncate font-semibold">{c.name}</span>
                      </span>
                    </span>
                    <span className="hidden text-right text-ink-2 tabular-nums sm:block">{marked.length} of {c.assignments.length}</span>
                    <span className="hidden text-right text-ink-2 tabular-nums sm:block">{pct ? `${fmtMark(pct.got)} / ${pct.outOf}` : "–"}</span>
                    <span className={cx("text-right text-lg font-bold tabular-nums", !pct ? "text-ink-3" : pct.pct >= 50 ? "text-done" : "text-attention")}>{pct ? `${pct.pct}%` : "–"}</span>
                    <ChevronDown className={cx("size-5 justify-self-end text-ink-3 transition-transform", isOpen && "rotate-180")} aria-hidden />
                  </button>
                  {isOpen && (
                    <div className="border-t border-line bg-canvas px-5 py-3">
                      {c.assignments.length === 0 ? (
                        <p className="py-2 text-ink-3">No work set in this course yet.</p>
                      ) : (
                        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
                          {c.assignments.map((a) => {
                            const s = statusOf(a);
                            const k = kindOf(a.type);
                            const done = a.submission && a.submission.status !== "in_progress";
                            return (
                              <li key={a.id}>
                                <Link to={done ? resultsLink(a.id, a.type) : `/student/assignments/${a.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 hover:bg-canvas">
                                  <k.icon className="size-4 shrink-0 text-ink-3" aria-hidden />
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate font-medium">{a.title}</span>
                                    <span className="block text-xs text-ink-3">
                                      {k.label}{a.dueAt ? ` · due ${formatDay(a.dueAt)}` : ""}
                                      {a.submission?.vivaScore != null && ` · viva ${a.submission.vivaScore}/100`}
                                      {a.submission?.grade != null && (a.submission.confirmed ? " · confirmed by your teacher" : " · suggested, waiting for your teacher")}
                                    </span>
                                  </span>
                                  <Chip tone={s.tone}>{s.label}</Chip>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      <Link to={`/student/courses/${c.id}/marks`} className="mt-2 inline-flex min-h-9 items-center text-sm font-semibold text-action hover:underline">
                        Open {c.code} marks
                      </Link>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {courses.length === 0 && (
            <p className="flex items-center gap-2 px-5 py-6 text-ink-3"><Trophy className="size-5" aria-hidden /> Join a course to see your marks here.</p>
          )}
        </Card>
      )}
    </AppShell>
  );
}
