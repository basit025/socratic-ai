/**
 * The student's home: one organized place for every course. Three regions:
 *   1. What to do now (the next task, then everything due, grouped by when).
 *   2. Feedback (recently marked work).
 *   3. My courses, news from teachers, and joining a course.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, BookOpen, CalendarClock, Camera, Code2, GraduationCap, ListChecks, Megaphone, PenLine, Sparkles, Trophy } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { JoinCourseCard } from "../components/CourseActions";
import { Card, Chip, EmptyState, ErrorState, PageHeader, Skeleton, cx, type ChipTone } from "../components/ui";
import { dayDiff, firstName, formatDue } from "../lib/format";
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
  submission: { status: SubmissionStatus; vivaScore: number | null; grade: number | null; confirmed?: boolean } | null;
}

interface StudentCourse {
  id: string;
  code: string;
  name: string;
  section: string | null;
  term: string | null;
  teacher: string;
  assignments: StudentAssignment[];
}

interface StudentHomeData {
  name: string;
  courses: StudentCourse[];
  announcements?: { id: string; courseId: string; courseCode: string; title: string; body: string; postedAt: string }[];
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
const kind = (t: string) =>
  t === "quiz" ? { icon: ListChecks, label: "Quiz" } : t === "written" ? { icon: PenLine, label: "Written" } : t === "handwritten" ? { icon: Camera, label: "Handwritten" } : { icon: Code2, label: "Lab" };
const resultsLink = (a: StudentAssignment) => (a.type === "quiz" ? `/student/assignments/${a.id}` : `/student/assignments/${a.id}/viva`);
const pct = (xs: StudentAssignment[]) => {
  const marked = xs.filter((a) => a.submission?.grade != null && a.marks > 0);
  return marked.length ? Math.round((marked.reduce((n, a) => n + a.submission!.grade! / a.marks, 0) / marked.length) * 100) : null;
};
const ago = (iso: string) => {
  const d = -dayDiff(iso);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};

type Item = StudentAssignment & { course: StudentCourse };

function TaskRow({ a }: { a: Item }) {
  const st = studentStatus(a);
  const k = kind(a.type);
  return (
    <li>
      <Link to={`/student/assignments/${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-canvas sm:px-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-action-soft text-action" title={k.label}>
          <k.icon className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-ink">{a.title}</span>
          <span className="block truncate text-sm text-ink-3">
            <span className="font-semibold text-ink-2">{a.course.code}</span> · {k.label} · {formatDue(a.dueAt, a.open)}
          </span>
        </span>
        <Chip tone={st.tone} className="shrink-0">{st.label}</Chip>
      </Link>
    </li>
  );
}

export function StudentHome() {
  const me = useMe();
  const home = useApi<StudentHomeData>("/student/home");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    document.title = "My courses · Socratic AI";
    preloadRunnerWhenIdle();
    // Fetch the workspace code in the background so opening an assignment is instant.
    const t = setTimeout(() => void import("./Workspace"), 1500);
    return () => clearTimeout(t);
  }, []);

  const data = home.status === "ready" ? home.data : null;
  const all: Item[] = data ? data.courses.flatMap((c) => c.assignments.map((a) => ({ ...a, course: c }))) : [];
  const todo = all.filter(needsWork).sort((a, b) => (a.dueAt ?? "9").localeCompare(b.dueAt ?? "9"));
  const next = todo[0];
  const LIMIT = 8;
  const shown = showAll ? todo : todo.slice(0, LIMIT);
  const groups = [
    { label: "Due today or tomorrow", items: shown.filter((a) => a.dueAt && dayDiff(a.dueAt) <= 1) },
    { label: "This week", items: shown.filter((a) => a.dueAt && dayDiff(a.dueAt) > 1 && dayDiff(a.dueAt) <= 7) },
    { label: "Later", items: shown.filter((a) => !a.dueAt || dayDiff(a.dueAt) > 7) },
  ].filter((g) => g.items.length);
  const marked = all
    .filter((a) => a.submission && (a.submission.status === "graded" || a.submission.status === "submitted") && a.submission.grade != null)
    .sort((a, b) => (b.dueAt ?? "").localeCompare(a.dueAt ?? ""))
    .slice(0, 5);
  const average = pct(all);
  const dueThisWeek = todo.filter((a) => a.dueAt && dayDiff(a.dueAt) <= 7).length;
  const openQuizzes = todo.filter((a) => a.type === "quiz").length;

  return (
    <AppShell>
      <PageHeader title={`Assalam-o-Alaikum, ${firstName(me.name)}`} subtitle="Everything for your courses in one place: what's due, your marks, and news from your teachers." />

      {home.status === "loading" && (
        <div className="space-y-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-36" />
          <Skeleton className="h-72" />
        </div>
      )}
      {home.status === "error" && <ErrorState message={home.message} onRetry={home.reload} />}

      {data && data.courses.length === 0 && (
        <EmptyState icon={BookOpen} title="You're not in a course yet" body="Ask your teacher for the 6-character join code for your course, then enter it below." />
      )}

      {data && data.courses.length > 0 && (
        <>
          {/* At a glance */}
          <dl className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="At a glance">
            {[
              { icon: CalendarClock, label: "Due this week", value: String(dueThisWeek), tone: dueThisWeek ? "text-attention" : "text-ink" },
              { icon: ListChecks, label: "Quizzes open", value: String(openQuizzes), tone: "text-ink" },
              { icon: Trophy, label: "Average mark", value: average != null ? `${average}%` : "–", tone: average != null && average >= 50 ? "text-done" : "text-ink" },
              { icon: GraduationCap, label: "Courses", value: String(data.courses.length), tone: "text-ink" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
                <s.icon className="size-5 shrink-0 text-ink-3" aria-hidden />
                <div>
                  <dt className="text-xs font-medium text-ink-3">{s.label}</dt>
                  <dd className={cx("text-xl font-bold tabular-nums", s.tone)}>{s.value}</dd>
                </div>
              </div>
            ))}
          </dl>

          {next ? (
            <Card className="mb-6 border-action-line bg-gradient-to-r from-action-soft to-surface p-5 sm:p-6">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-action"><Sparkles className="size-4" aria-hidden /> Next up</p>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold">{next.title}</h2>
                  <p className="mt-1 flex items-center gap-1.5 text-ink-2">
                    <CalendarClock className="size-4" aria-hidden />
                    {next.course.code} · {next.course.name} · {formatDue(next.dueAt, next.open)}
                  </p>
                </div>
                <Link to={`/student/assignments/${next.id}`} className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-action px-5 font-semibold text-white hover:bg-action-hover">
                  {next.type === "quiz" ? (next.submission ? "Continue quiz" : "Open quiz") : next.submission ? "Continue assignment" : "Open assignment"}
                  <ArrowRight className="size-5" aria-hidden />
                </Link>
              </div>
            </Card>
          ) : (
            <Card className="mb-6 border-done-line bg-done-soft p-5">
              <p className="font-semibold text-done">You're all caught up. Nothing is due right now.</p>
            </Card>
          )}

          <div className="grid min-w-0 gap-6 lg:grid-cols-3">
            {/* 1 + 2: work and feedback */}
            <div className="min-w-0 space-y-6 lg:col-span-2">
              <Card>
                <h2 className="flex items-center gap-2 border-b border-line px-5 py-4 font-semibold"><CalendarClock className="size-5 text-ink-3" aria-hidden /> Due next, across all courses</h2>
                {groups.length === 0 ? (
                  <p className="px-5 py-4 text-ink-3">Nothing open right now. New work appears here as soon as a teacher publishes it.</p>
                ) : (
                  groups.map((g) => (
                    <div key={g.label}>
                      <p className="bg-canvas px-5 py-2 text-xs font-semibold tracking-wide text-ink-3 uppercase">{g.label}</p>
                      <ul className="divide-y divide-line">{g.items.map((a) => <TaskRow key={a.id} a={a} />)}</ul>
                    </div>
                  ))
                )}
                {todo.length > LIMIT && (
                  <button type="button" onClick={() => setShowAll((v) => !v)} className="min-h-11 w-full border-t border-line px-5 text-sm font-semibold text-action hover:bg-action-soft">
                    {showAll ? "Show the next 8 only" : `Show all ${todo.length} open tasks`}
                  </button>
                )}
              </Card>

              <Card>
                <h2 className="flex items-center gap-2 border-b border-line px-5 py-4 font-semibold"><Trophy className="size-5 text-ink-3" aria-hidden /> Recently marked</h2>
                {marked.length === 0 ? (
                  <p className="px-5 py-4 text-ink-3">Your marks appear here after you hand in work and your teacher reviews it.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {marked.map((a) => (
                      <li key={a.id}>
                        <Link to={resultsLink(a)} className="flex items-center gap-3 px-5 py-3 hover:bg-canvas">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{a.title}</span>
                            <span className="block text-sm text-ink-3">
                              {a.course.code} · {a.submission!.confirmed ? "confirmed by your teacher" : "suggested mark, waiting for your teacher"}
                              {a.submission!.vivaScore != null && ` · viva ${a.submission!.vivaScore}/100`}
                            </span>
                          </span>
                          <Chip tone={a.submission!.confirmed ? "done" : "locked"}>{a.submission!.confirmed ? `Marked: ${a.submission!.grade}/${a.marks}` : `${a.submission!.grade}/${a.marks}`}</Chip>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            {/* 3: courses, news, join */}
            <div className="min-w-0 space-y-6">
              <section aria-label="My courses">
                <h2 className="mb-3 flex items-center gap-2 font-semibold"><BookOpen className="size-5 text-ink-3" aria-hidden /> My courses</h2>
                <ul className="space-y-2.5">
                  {data.courses.map((c) => {
                    const visible = c.assignments.length;
                    const done = c.assignments.filter((a) => a.submission && a.submission.status !== "in_progress").length;
                    const avg = pct(c.assignments);
                    const open = c.assignments.filter(needsWork).length;
                    return (
                      <li key={c.id} data-course-card>
                        <Link to={`/student/courses/${c.id}`} className="block rounded-xl border border-line bg-surface p-4 transition-colors hover:border-action">
                          <p className="text-sm font-semibold text-action">{c.code}</p>
                          <p className="font-semibold leading-snug text-ink">{c.name}</p>
                          <p className="mt-0.5 text-sm text-ink-3">{c.teacher}</p>
                          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-locked-line" aria-hidden>
                            <div className="h-full rounded-full bg-done" style={{ width: `${visible ? Math.round((done / visible) * 100) : 0}%` }} />
                          </div>
                          <p className="mt-1.5 flex justify-between text-xs text-ink-3">
                            <span>{done} of {visible} handed in{open ? ` · ${open} to do` : ""}</span>
                            <span>{avg != null ? `Average ${avg}%` : "No marks yet"}</span>
                          </p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>

              {data.announcements && data.announcements.length > 0 && (
                <Card className="p-5">
                  <h2 className="mb-3 flex items-center gap-2 font-semibold"><Megaphone className="size-5 text-ink-3" aria-hidden /> From your teachers</h2>
                  <ul className="space-y-3.5">
                    {data.announcements.slice(0, 4).map((n) => (
                      <li key={n.id}>
                        <Link to={`/student/courses/${n.courseId}`} className="group block">
                          <p className="text-xs text-ink-3"><span className="font-semibold text-ink-2">{n.courseCode}</span> · {ago(n.postedAt)}</p>
                          <p className="font-medium text-ink group-hover:text-action">{n.title}</p>
                          <p className="line-clamp-2 text-sm text-ink-3">{n.body}</p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <JoinCourseCard onJoined={home.reload} />
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
