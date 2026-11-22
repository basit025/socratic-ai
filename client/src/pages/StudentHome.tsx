import { useEffect } from "react";
import { Link } from "react-router";
import { ArrowRight, BookOpen, CalendarClock } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Card, Chip, EmptyState, ErrorState, PageHeader, Skeleton, type ChipTone } from "../components/ui";
import { firstName, formatDue } from "../lib/format";
import { useMe } from "../lib/session";
import { useApi } from "../lib/useApi";
import { preloadRunnerWhenIdle } from "../runner/runner";

type SubmissionStatus = "in_progress" | "submitted" | "viva_in_progress" | "graded";

interface StudentAssignment {
  id: string;
  title: string;
  type: string;
  open: boolean;
  dueAt: string | null;
  marks: number;
  submission: { status: SubmissionStatus; vivaScore: number | null; grade: number | null } | null;
}

interface StudentHomeData {
  name: string;
  courses: { id: string; code: string; name: string; section: string | null; term: string | null; teacher: string; assignments: StudentAssignment[] }[];
}

/** One status per assignment, in classroom words, with a colour from the shared language. */
export function studentStatus(a: StudentAssignment): { tone: ChipTone; label: string } {
  const s = a.submission?.status;
  if (s === "graded") return { tone: "done", label: a.submission?.grade != null ? `Marked: ${a.submission.grade}/${a.marks}` : "Marked" };
  if (s === "submitted") return { tone: "done", label: "Submitted" };
  if (s === "viva_in_progress") return { tone: "attention", label: "Viva not finished" };
  if (s === "in_progress") return a.open ? { tone: "attention", label: "In progress" } : { tone: "locked", label: "Closed, not submitted" };
  return a.open ? { tone: "action", label: "To do" } : { tone: "locked", label: "Closed" };
}

const needsWork = (a: StudentAssignment) => a.open && (!a.submission || a.submission.status === "in_progress" || a.submission.status === "viva_in_progress");

export function StudentHome() {
  const me = useMe();
  const home = useApi<StudentHomeData>("/student/home");

  useEffect(() => {
    document.title = "My courses · Socratic AI";
    preloadRunnerWhenIdle();
  }, []);

  const next =
    home.status === "ready"
      ? home.data.courses
          .flatMap((c) => c.assignments.map((a) => ({ ...a, course: c })))
          .filter(needsWork)
          .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""))[0]
      : undefined;

  return (
    <AppShell>
      <PageHeader title={`Assalam-o-Alaikum, ${firstName(me.name)}`} subtitle="Here's what's due. Work inside Socratic AI: your teacher sees how your answer was made." />

      {home.status === "loading" && (
        <div className="space-y-4">
          <Skeleton className="h-36" />
          <Skeleton className="h-56" />
        </div>
      )}
      {home.status === "error" && <ErrorState message={home.message} onRetry={home.reload} />}

      {home.status === "ready" && (
        <>
          {next ? (
            <Card className="mb-8 border-action-line bg-action-soft/60 p-5 sm:p-6">
              <p className="text-sm font-semibold text-action">Next up</p>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">{next.title}</h2>
                  <p className="mt-1 flex items-center gap-1.5 text-ink-2">
                    <CalendarClock className="size-4" aria-hidden />
                    {next.course.code} · {formatDue(next.dueAt, next.open)}
                  </p>
                </div>
                <Link
                  to={`/student/assignments/${next.id}`}
                  className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-action px-5 font-semibold text-white hover:bg-action-hover"
                >
                  {next.submission ? "Continue assignment" : "Open assignment"}
                  <ArrowRight className="size-5" aria-hidden />
                </Link>
              </div>
            </Card>
          ) : (
            home.data.courses.length > 0 && (
              <Card className="mb-8 border-done-line bg-done-soft p-5">
                <p className="font-semibold text-done">You're all caught up. Nothing is due right now.</p>
              </Card>
            )
          )}

          {home.data.courses.length === 0 ? (
            <EmptyState icon={BookOpen} title="You're not in a course yet" body="Ask your teacher for the 6-letter join code for your course." />
          ) : (
            <div className="space-y-6">
              {home.data.courses.map((c) => (
                <Card key={c.id}>
                  <div className="border-b border-line px-5 py-4">
                    <h2 className="text-lg font-semibold">
                      {c.code} · {c.name}
                    </h2>
                    <p className="text-sm text-ink-3">
                      {[c.section, c.term, c.teacher].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {c.assignments.length === 0 ? (
                    <p className="px-5 py-6 text-ink-3">No assignments yet. Your teacher will post them here.</p>
                  ) : (
                    <ul className="divide-y divide-line">
                      {c.assignments.map((a) => {
                        const st = studentStatus(a);
                        return (
                          <li key={a.id}>
                            <Link to={`/student/assignments/${a.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-canvas">
                              <span>
                                <span className="block font-medium">{a.title}</span>
                                <span className="block text-sm text-ink-3">{formatDue(a.dueAt, a.open)} · {a.marks} marks</span>
                              </span>
                              <Chip tone={st.tone}>{st.label}</Chip>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
