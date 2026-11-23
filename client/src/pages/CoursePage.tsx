/**
 * A course, week by week: notes, that week's assignments with their status, and announcements.
 * The current week is open by default; the rest are one click away (progressive disclosure).
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, BookOpen, ChevronDown, Megaphone, Table2, Users } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Card, Chip, ErrorState, Skeleton, cx, type ChipTone } from "../components/ui";
import { dayDiff, formatDue } from "../lib/format";
import { useMe } from "../lib/session";
import { useApi } from "../lib/useApi";

interface Item {
  id: string;
  title: string;
  type: string;
  status: "draft" | "published" | "closed";
  dueAt: string | null;
  marks: number;
  handedIn?: number;
  submission?: { status: string; grade: number | null } | null;
}

interface CourseData {
  course: { id: string; code: string; name: string; section: string | null; term: string | null; teacher: string; students: number; joinCode?: string };
  weeks: { week: number; title: string; notes: string; assignments: Item[] }[];
  unscheduled: Item[];
  announcements: { title: string; body: string; postedAt: string }[];
}

function Notes({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((p, i) => (
        <p key={i} className="mb-2 last:mb-0">
          {p.split(/(`[^`]+`)/g).map((part, j) => (part.startsWith("`") ? <code key={j} className="rounded bg-locked-soft px-1 font-mono text-[0.9em]">{part.slice(1, -1)}</code> : part))}
        </p>
      ))}
    </>
  );
}

function statusChip(item: Item, role: "teacher" | "student", students: number): { tone: ChipTone; label: string } {
  if (role === "teacher") {
    if (item.status === "draft") return { tone: "locked", label: "Draft" };
    return { tone: item.status === "published" ? "action" : "locked", label: `${item.handedIn ?? 0}/${students} handed in` };
  }
  const s = item.submission?.status;
  if (s === "graded") return { tone: "done", label: item.submission?.grade != null ? `Marked: ${item.submission.grade}/${item.marks}` : "Marked" };
  if (s === "submitted") return { tone: "done", label: "Submitted" };
  if (s === "viva_in_progress") return { tone: "attention", label: "Viva not finished" };
  if (s === "in_progress") return item.status === "published" ? { tone: "attention", label: "In progress" } : { tone: "locked", label: "Closed, not submitted" };
  return item.status === "published" ? { tone: "action", label: "To do" } : { tone: "locked", label: "Closed" };
}

const kindLabel = (t: string) => (t === "written" ? "Written" : t === "quiz" ? "Quiz" : "Lab");

export function CoursePage() {
  const { id = "" } = useParams();
  const me = useMe();
  const data = useApi<CourseData>(`/courses/${id}`);
  const [open, setOpen] = useState<Set<number>>(new Set());

  const title = data.status === "ready" ? `${data.data.course.code} · ${data.data.course.name}` : null;
  useEffect(() => {
    if (title) document.title = `${title} · Socratic AI`;
  }, [title]);

  // Open the week with the nearest upcoming deadline (the "current" week).
  const currentWeek = useMemo(() => {
    if (data.status !== "ready") return null;
    const upcoming = data.data.weeks.filter((w) => w.assignments.some((a) => a.status === "published" && a.dueAt && dayDiff(a.dueAt) >= 0));
    return upcoming[0]?.week ?? data.data.weeks.at(-1)?.week ?? null;
  }, [data]);
  useEffect(() => {
    if (currentWeek != null) setOpen(new Set([currentWeek]));
  }, [currentWeek]);

  const base = me.role === "teacher" ? "/teacher" : "/student";
  return (
    <AppShell>
      <Link to={base} className="mb-4 inline-flex items-center gap-1.5 font-medium text-action hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> My courses
      </Link>
      {data.status === "loading" && <Skeleton className="h-96" />}
      {data.status === "error" && <ErrorState message={data.message} onRetry={data.reload} />}
      {data.status === "ready" && (
        <>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 text-ink-3">
                <span>{[data.data.course.section, data.data.course.term, data.data.course.teacher].filter(Boolean).join(" · ")}</span>
                <span className="flex items-center gap-1"><Users className="size-4" aria-hidden /> {data.data.course.students} students</span>
              </p>
            </div>
            {me.role === "teacher" && (
              <Link to={`/teacher/courses/${data.data.course.id}/gradebook`} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line-strong bg-surface px-4 font-semibold hover:border-action hover:text-action">
                <Table2 className="size-5" aria-hidden /> Gradebook
              </Link>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-3 lg:col-span-2">
              <h2 className="flex items-center gap-2 font-semibold"><BookOpen className="size-5 text-ink-3" aria-hidden /> Weeks</h2>
              {data.data.weeks.length === 0 && <p className="text-ink-3">No weekly material yet.</p>}
              {data.data.weeks.map((w) => {
                const isOpen = open.has(w.week);
                return (
                  <Card key={w.week} className={cx(w.week === currentWeek && "border-action-line")}>
                    <button
                      type="button"
                      onClick={() => setOpen((o) => { const n = new Set(o); if (n.has(w.week)) n.delete(w.week); else n.add(w.week); return n; })}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                    >
                      <span>
                        <span className="text-sm font-semibold text-ink-3">Week {w.week}{w.week === currentWeek ? " · this week" : ""}</span>
                        <span className="block text-lg font-semibold">{w.title}</span>
                      </span>
                      <span className="flex items-center gap-3">
                        {w.assignments.length > 0 && <span className="text-sm text-ink-3">{w.assignments.length} task{w.assignments.length === 1 ? "" : "s"}</span>}
                        <ChevronDown className={cx("size-5 text-ink-3 transition-transform", isOpen && "rotate-180")} aria-hidden />
                      </span>
                    </button>
                    {isOpen && (
                      <div className="border-t border-line px-5 py-4">
                        <div className="text-[15px] leading-relaxed text-ink-2"><Notes text={w.notes} /></div>
                        {w.assignments.length > 0 && (
                          <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
                            {w.assignments.map((a) => {
                              const st = statusChip(a, me.role, data.data.course.students);
                              return (
                                <li key={a.id}>
                                  <Link to={me.role === "teacher" ? `/teacher/assignments/${a.id}` : `/student/assignments/${a.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-canvas">
                                    <span>
                                      <span className="block font-medium">{a.title} <span className="ml-1 rounded bg-locked-soft px-1.5 py-0.5 text-xs font-medium text-ink-2">{kindLabel(a.type)}</span></span>
                                      <span className="block text-sm text-ink-3">{a.status === "draft" ? "Not visible to students yet" : formatDue(a.dueAt, a.status === "published")}</span>
                                    </span>
                                    <Chip tone={st.tone}>{st.label}</Chip>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>

            <aside className="space-y-3">
              <h2 className="flex items-center gap-2 font-semibold"><Megaphone className="size-5 text-ink-3" aria-hidden /> Announcements</h2>
              {data.data.announcements.length === 0 ? (
                <p className="text-ink-3">No announcements yet.</p>
              ) : (
                data.data.announcements.map((n, i) => (
                  <Card key={i} className="p-4">
                    <p className="font-semibold">{n.title}</p>
                    <p className="mt-1 text-[15px] text-ink-2">{n.body}</p>
                    <p className="mt-2 text-xs text-ink-3">{Math.abs(dayDiff(n.postedAt)) === 0 ? "Today" : `${Math.abs(dayDiff(n.postedAt))} days ago`}</p>
                  </Card>
                ))
              )}
            </aside>
          </div>
        </>
      )}
    </AppShell>
  );
}
