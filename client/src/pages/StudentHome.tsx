/**
 * The student's Home: what to do, by date, and what's new, across every course.
 *   Left:  To-do, grouped by day (Today, Tomorrow, each day this week, Later).
 *   Right: Notifications (announcements, new work, marks released, reminders).
 * Courses live in the sidebar (My courses), so Home stays about what to do next.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { BellRing, BookOpen, CalendarCheck2, CalendarDays, PartyPopper } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { noticeView, useStudentData } from "../components/Shell";
import { Card, Chip, EmptyState, ErrorState, Skeleton, cx } from "../components/ui";
import { courseStyle } from "../lib/courseStyle";
import { dayDiff, dayKey, firstName, formatDay, formatTime, greeting, timeAgo } from "../lib/format";
import { useMe } from "../lib/session";
import { kindOf, needsWork, statusOf, type StudentAssignment, type StudentCourse } from "../lib/student";
import { preloadRunnerWhenIdle } from "../runner/runner";

type Item = StudentAssignment & { course: StudentCourse };

const longDay = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", weekday: "long", day: "numeric", month: "long" });

export function groupByDay(items: Item[], now = Date.now()) {
  const groups = new Map<string, { label: string; sub: string; items: Item[] }>();
  for (const a of items) {
    let key: string, label: string, sub = "";
    if (!a.dueAt) [key, label] = ["~none", "No due date"];
    else {
      const d = dayDiff(a.dueAt, now);
      if (d > 7) [key, label] = ["~later", "Later"];
      else {
        key = dayKey(a.dueAt);
        label = d <= 0 ? "Today" : d === 1 ? "Tomorrow" : longDay.format(Date.parse(a.dueAt)).split(" ")[0]!;
        sub = formatDay(a.dueAt);
      }
    }
    if (!groups.has(key)) groups.set(key, { label, sub, items: [] });
    groups.get(key)!.items.push(a);
  }
  // Plain code-point order: ISO dates first, then "~later" and "~none" (localeCompare would put "~" first).
  return [...groups.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, g]) => g);
}

function TodoRow({ a }: { a: Item }) {
  const st = statusOf(a);
  const k = kindOf(a.type);
  const cs = courseStyle(a.course.code);
  return (
    <li>
      <Link to={`/student/assignments/${a.id}`} className="group flex items-center gap-3 py-3 pr-4 pl-3 hover:bg-canvas sm:pr-5">
        <span className="h-10 w-1 shrink-0 rounded-full" style={{ backgroundColor: cs.color }} aria-hidden />
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: cs.soft, color: cs.text }} title={k.label}>
          <k.icon className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-ink group-hover:text-action">{a.title}</span>
          <span className="block truncate text-sm text-ink-3">
            {k.label} · <span className="font-medium text-ink-2">{a.course.code}</span> {a.course.name}
          </span>
        </span>
        <span className="hidden shrink-0 text-right text-sm sm:block">
          <span className="block font-medium text-ink-2">{a.dueAt ? formatTime(a.dueAt) : ""}</span>
          <span className="block text-xs text-ink-3">{a.marks} marks</span>
        </span>
        <Chip tone={st.tone} className="shrink-0">{st.label}</Chip>
      </Link>
    </li>
  );
}

export function StudentHome() {
  const me = useMe();
  const home = useStudentData();
  const [allNotices, setAllNotices] = useState(false);

  useEffect(() => {
    document.title = "Home · Socratic AI";
    preloadRunnerWhenIdle();
    // Fetch the workspace code in the background so opening an assignment is instant.
    const t = setTimeout(() => void import("./Workspace"), 1500);
    return () => clearTimeout(t);
  }, []);

  const data = home.status === "ready" ? home.data : null;
  const all: Item[] = data ? data.courses.flatMap((c) => c.assignments.map((a) => ({ ...a, course: c }))) : [];
  const todo = all.filter(needsWork).sort((a, b) => (a.dueAt ?? "9").localeCompare(b.dueAt ?? "9"));
  const [allTodo, setAllTodo] = useState(false);
  const TODO_LIMIT = 12;
  const groups = groupByDay(allTodo ? todo : todo.slice(0, TODO_LIMIT));
  const notices = data?.notifications ?? [];
  const shownNotices = allNotices ? notices : notices.slice(0, 7);

  return (
    <AppShell>
      <div className="mb-6">
        <p className="text-sm font-medium text-ink-3">{longDay.format(Date.now())}</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{greeting()}, {firstName(me.name)}</h1>
      </div>

      {home.status === "loading" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      )}
      {home.status === "error" && <ErrorState message={home.message} onRetry={home.reload} />}

      {data && data.courses.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title="You're not in a course yet"
          body="Ask your teacher for the 6-character join code for your course."
          action={<Link to="/student/courses" className="inline-flex min-h-11 items-center rounded-lg bg-action px-4 font-semibold text-white hover:bg-action-hover">Join a course</Link>}
        />
      )}

      {data && data.courses.length > 0 && (
          <div className="grid min-w-0 gap-6 lg:grid-cols-3">
            {/* To-do, by date */}
            <Card className="min-w-0 overflow-hidden lg:col-span-2">
              <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
                <h2 className="flex items-center gap-2 text-lg font-semibold"><CalendarCheck2 className="size-5 text-ink-3" aria-hidden /> To-do</h2>
                <Link to="/student/calendar" className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-action hover:underline">
                  <CalendarDays className="size-4" aria-hidden /> Calendar
                </Link>
              </div>
              {groups.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-12 text-center">
                  <PartyPopper className="size-8 text-done" aria-hidden />
                  <p className="mt-3 font-semibold">Nothing to do right now</p>
                  <p className="mt-1 max-w-sm text-ink-3">New work appears here, by its due date, as soon as a teacher publishes it.</p>
                </div>
              ) : (
                groups.map((g) => (
                  <section key={g.label + g.sub} aria-label={g.label}>
                    <p className={cx("flex items-baseline gap-2 border-b border-line bg-canvas px-5 py-2 text-sm font-semibold", g.label === "Today" ? "text-attention" : "text-ink-2")}>
                      {g.label}
                      {g.sub && <span className="font-normal text-ink-3">{g.sub}</span>}
                      <span className="ml-auto text-xs font-medium text-ink-3">{g.items.length} task{g.items.length === 1 ? "" : "s"}</span>
                    </p>
                    <ul className="divide-y divide-line">{g.items.map((a) => <TodoRow key={a.id} a={a} />)}</ul>
                  </section>
                ))
              )}
              {todo.length > TODO_LIMIT && (
                <button type="button" onClick={() => setAllTodo((v) => !v)} className="min-h-11 w-full border-t border-line text-sm font-semibold text-action hover:bg-action-soft">
                  {allTodo ? "Show the first 12 only" : `Show all ${todo.length} tasks`}
                </button>
              )}
            </Card>

            {/* Notifications */}
            <Card className="min-w-0 self-start overflow-hidden">
              <h2 className="flex items-center gap-2 border-b border-line px-5 py-4 text-lg font-semibold"><BellRing className="size-5 text-ink-3" aria-hidden /> Notifications</h2>
              {notices.length === 0 ? (
                <p className="px-5 py-6 text-ink-3">Nothing new. Announcements, new work and marks appear here.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {shownNotices.map((n) => {
                    const v = noticeView(n);
                    return (
                      <li key={n.id}>
                        <Link to={v.to} className="group flex gap-3 px-5 py-3 hover:bg-canvas">
                          <span className={cx("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", v.tone)}>
                            <v.icon className="size-4" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs text-ink-3">{v.line.split(" · ")[0]} · {timeAgo(n.at)}</span>
                            <span className="block font-medium leading-snug text-ink group-hover:text-action">{n.title}</span>
                            {n.kind === "announcement" && <span className="mt-0.5 line-clamp-2 block text-sm text-ink-3">{n.body}</span>}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
              {notices.length > 7 && (
                <button type="button" onClick={() => setAllNotices((v) => !v)} className="min-h-11 w-full border-t border-line text-sm font-semibold text-action hover:bg-action-soft">
                  {allNotices ? "Show fewer" : `Show all ${notices.length}`}
                </button>
              )}
            </Card>
          </div>
      )}
    </AppShell>
  );
}
