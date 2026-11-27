/**
 * A month calendar of every due date across all courses (Pakistan time, weeks start on Monday).
 * Pick a day to see its work in full. Narrow screens get the same month as an agenda list.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { useStudentData } from "../components/Shell";
import { Button, Card, Chip, ErrorState, PageHeader, Skeleton, cx } from "../components/ui";
import { courseStyle } from "../lib/courseStyle";
import { dayKey, formatTime } from "../lib/format";
import { kindOf, statusOf, type StudentAssignment, type StudentCourse } from "../lib/student";

type Item = StudentAssignment & { course: StudentCourse };
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const dayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const keyOf = (t: number) => new Date(t).toISOString().slice(0, 10);

function ItemRow({ a }: { a: Item }) {
  const st = statusOf(a);
  const k = kindOf(a.type);
  const cs = courseStyle(a.course.code);
  return (
    <li>
      <Link to={`/student/assignments/${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-canvas">
        <span className="h-9 w-1 shrink-0 rounded-full" style={{ backgroundColor: cs.color }} aria-hidden />
        <k.icon className="size-5 shrink-0 text-ink-3" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{a.title}</span>
          <span className="block truncate text-sm text-ink-3">{a.course.code} · {k.label} · {a.dueAt ? formatTime(a.dueAt) : ""}</span>
        </span>
        <Chip tone={st.tone}>{st.label}</Chip>
      </Link>
    </li>
  );
}

export function StudentCalendar() {
  const home = useStudentData();
  const today = dayKey(Date.now());
  const [month, setMonth] = useState(() => today.slice(0, 7)); // YYYY-MM
  const [picked, setPicked] = useState(today);
  useEffect(() => {
    document.title = "Calendar · Socratic AI";
  }, []);

  const byDay = useMemo(() => {
    const m = new Map<string, Item[]>();
    if (home.status !== "ready") return m;
    for (const c of home.data.courses)
      for (const a of c.assignments) {
        if (!a.dueAt) continue;
        const k = dayKey(a.dueAt);
        m.set(k, [...(m.get(k) ?? []), { ...a, course: c }]);
      }
    for (const xs of m.values()) xs.sort((x, y) => x.dueAt!.localeCompare(y.dueAt!));
    return m;
  }, [home]);

  const [y, mo] = month.split("-").map(Number) as [number, number];
  const first = Date.UTC(y, mo - 1, 1);
  const lead = (new Date(first).getUTCDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((lead + daysInMonth) / 7) * 7 }, (_, i) => first + (i - lead) * 86_400_000);
  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, mo - 1 + n, 1));
    setMonth(keyOf(d.getTime()).slice(0, 7));
  };
  const pickedItems = byDay.get(picked) ?? [];
  const monthDays = [...byDay.keys()].filter((k) => k.startsWith(month)).sort();

  return (
    <AppShell>
      <PageHeader title="Calendar" subtitle="Every due date across your courses. Pick a day to see what's due." />
      {home.status === "loading" && <Skeleton className="h-[32rem]" />}
      {home.status === "error" && <ErrorState message={home.message} onRetry={home.reload} />}
      {home.status === "ready" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <h2 className="flex-1 text-lg font-semibold">{monthFmt.format(first)}</h2>
              <Button variant="secondary" onClick={() => { setMonth(today.slice(0, 7)); setPicked(today); }}>Today</Button>
              <Button variant="ghost" icon={ChevronLeft} onClick={() => shift(-1)} aria-label="Previous month" />
              <Button variant="ghost" icon={ChevronRight} onClick={() => shift(1)} aria-label="Next month" />
            </div>

            {/* Month grid (tablet and up) */}
            <div className="hidden md:block">
              <div className="grid grid-cols-7 border-b border-line bg-canvas text-center text-xs font-semibold tracking-wide text-ink-3 uppercase">
                {WEEKDAYS.map((d) => <div key={d} className="py-2">{d}</div>)}
              </div>
              <div className="grid grid-cols-7">
                {cells.map((t) => {
                  const k = keyOf(t);
                  const inMonth = k.startsWith(month);
                  const items = byDay.get(k) ?? [];
                  const isToday = k === today;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setPicked(k)}
                      aria-pressed={picked === k}
                      aria-label={`${dayFmt.format(t)}: ${items.length ? `${items.length} due` : "nothing due"}`}
                      className={cx(
                        "flex min-h-28 flex-col gap-1 border-r border-b border-line p-1.5 text-left align-top transition-colors last:border-r-0 [&:nth-child(7n)]:border-r-0",
                        inMonth ? "bg-surface hover:bg-canvas" : "bg-canvas/60 text-ink-3",
                        picked === k && "ring-2 ring-action ring-inset",
                      )}
                    >
                      <span className={cx("flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums", isToday ? "bg-action text-white" : inMonth ? "text-ink-2" : "text-ink-3")}>
                        {new Date(t).getUTCDate()}
                      </span>
                      {items.slice(0, 3).map((a) => {
                        const cs = courseStyle(a.course.code);
                        const done = a.submission && a.submission.status !== "in_progress";
                        return (
                          <span key={a.id} className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-xs font-medium" style={{ backgroundColor: cs.soft, color: cs.color }}>
                            {done && <CheckCircle2 className="size-3 shrink-0" aria-hidden />}
                            <span className="truncate">{a.course.code} {a.title}</span>
                          </span>
                        );
                      })}
                      {items.length > 3 && <span className="px-1 text-xs font-medium text-ink-3">+{items.length - 3} more</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Agenda (phones) */}
            <div className="md:hidden">
              {monthDays.length === 0 ? (
                <p className="px-4 py-6 text-ink-3">Nothing is due this month.</p>
              ) : (
                monthDays.map((k) => (
                  <section key={k}>
                    <p className={cx("border-b border-line bg-canvas px-4 py-2 text-sm font-semibold", k === today ? "text-action" : "text-ink-2")}>
                      {dayFmt.format(Date.parse(`${k}T00:00:00Z`))}{k === today ? " · Today" : ""}
                    </p>
                    <ul className="divide-y divide-line">{byDay.get(k)!.map((a) => <ItemRow key={a.id} a={a} />)}</ul>
                  </section>
                ))
              )}
            </div>
          </Card>

          {/* The picked day */}
          <Card className="hidden self-start overflow-hidden md:block">
            <h2 className="border-b border-line px-4 py-3 font-semibold">
              {dayFmt.format(Date.parse(`${picked}T00:00:00Z`))}
              {picked === today && <span className="ml-2 text-sm font-medium text-action">Today</span>}
            </h2>
            {pickedItems.length === 0 ? (
              <p className="px-4 py-6 text-ink-3">Nothing is due on this day.</p>
            ) : (
              <ul className="divide-y divide-line">{pickedItems.map((a) => <ItemRow key={a.id} a={a} />)}</ul>
            )}
          </Card>
        </div>
      )}
    </AppShell>
  );
}
