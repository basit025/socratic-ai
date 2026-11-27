/**
 * A course's own space, the same shape for every course:
 *   Overview (announcements, what's coming up, where you are) · Lectures (slides and notes)
 *   Assignments (labs, written and handwritten work) · Quizzes · Marks (students) / Gradebook (teachers)
 * The tab is part of the URL, so Back and shared links land on the same place.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, NavLink, Navigate, useParams } from "react-router";
import {
  ArrowRight, BookOpenText, CalendarClock, CheckCircle2, ClipboardList, Copy, Eye, FileText, LayoutDashboard, ListChecks, Megaphone, Plus, Presentation, Table2, Timer, Trophy, Users,
} from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Markdown } from "../components/Markdown";
import { initials, useShellReload } from "../components/Shell";
import { Button, Card, Chip, EmptyState, ErrorState, Segmented, Skeleton, cx, type ChipTone } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { courseStyle } from "../lib/courseStyle";
import { dayDiff, formatDateTime, formatDue, timeAgo } from "../lib/format";
import { useMe } from "../lib/session";
import { toSlides } from "../lib/slides";
import { coursePercent, fmtMark, kindOf, needsWork, resultsLink, statusOf, type MySubmission } from "../lib/student";
import { useApi } from "../lib/useApi";
import { StudyChat, UstaadAvatar } from "../components/StudyPanel";
import { LectureView } from "./LectureView";

interface Item {
  id: string;
  title: string;
  type: string;
  status: "draft" | "published" | "closed";
  opensAt: string | null;
  dueAt: string | null;
  marks: number;
  language: string | null;
  timeLimitMinutes: number | null;
  vivaQuestions: number;
  pasteBlocked: boolean;
  fullscreen: boolean;
  questions: number | null;
  handedIn?: number;
  submission?: MySubmission | null;
}

interface CourseData {
  course: { id: string; code: string; name: string; section: string | null; term: string | null; teacher: string; students: number; joinCode?: string };
  weeks: { week: number; title: string; notes: string; assignments: Item[] }[];
  unscheduled: Item[];
  announcements: { id?: string; title: string; body: string; postedAt: string }[];
}

type Tab = "overview" | "lectures" | "assignments" | "quizzes" | "marks";
const TABS: Tab[] = ["overview", "lectures", "assignments", "quizzes", "marks"];

const open = (a: Item) => a.status === "published";
const asStudent = (a: Item) => ({ open: open(a), marks: a.marks, submission: a.submission ?? null });

function chipFor(a: Item, role: "teacher" | "student", students: number): { tone: ChipTone; label: string } {
  if (role === "teacher") {
    if (a.status === "draft") return { tone: "locked", label: "Draft" };
    return { tone: a.status === "published" ? "action" : "locked", label: `${a.handedIn ?? 0}/${students} handed in` };
  }
  return statusOf(asStudent(a));
}

/** The rules a student sees before opening the work, in plain words. */
function rulesLine(a: Item): string {
  if (a.type === "quiz")
    return [a.questions ? `${a.questions} questions` : null, a.timeLimitMinutes ? `${a.timeLimitMinutes} min` : null, a.fullscreen ? "full screen" : null].filter(Boolean).join(" · ");
  const lang = a.type === "code" ? (a.language === "javascript" ? "JavaScript lab" : a.language === "html" ? "HTML lab" : "Python lab") : kindOf(a.type).label;
  return [lang, a.type !== "handwritten" ? "Ustaad hints" : null, a.vivaQuestions ? `viva: ${a.vivaQuestions} questions` : null, a.pasteBlocked ? "paste off" : null].filter(Boolean).join(" · ");
}

// ---------------------------------------------------------------- lecture "viewed" marks (this browser only)
const viewedKey = (courseId: string) => `socratic.viewed.${courseId}`;
function readViewed(courseId: string): number[] {
  try {
    return JSON.parse(localStorage.getItem(viewedKey(courseId)) ?? "[]") as number[];
  } catch {
    return [];
  }
}
function markViewed(courseId: string, week: number) {
  try {
    const v = new Set(readViewed(courseId));
    v.add(week);
    localStorage.setItem(viewedKey(courseId), JSON.stringify([...v]));
  } catch {
    /* private mode */
  }
}

// ---------------------------------------------------------------- teacher: post an announcement
function PostAnnouncement({ courseId, students, onPosted }: { courseId: string; students: number; onPosted: (n: { title: string; body: string; postedAt: string }) => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [state, setState] = useState<"idle" | "posting" | "posted">("idle");
  const [error, setError] = useState<string | null>(null);
  const post = async () => {
    setState("posting");
    setError(null);
    try {
      onPosted(await api<{ title: string; body: string; postedAt: string }>(`/teacher/courses/${courseId}/announcements`, { body: { title, body } }));
      setTitle("");
      setBody("");
      setState("posted");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't post the announcement.");
      setState("idle");
    }
  };
  return (
    <Card className="space-y-2.5 p-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink-2">New announcement</span>
        <input value={title} onChange={(e) => { setTitle(e.target.value); setState("idle"); }} maxLength={120} placeholder="e.g. Lab moved to Thursday" className="min-h-11 w-full rounded-lg border border-line-strong px-3 focus:border-action focus:outline-none" />
      </label>
      <textarea value={body} onChange={(e) => { setBody(e.target.value); setState("idle"); }} maxLength={2000} rows={3} aria-label="Announcement message" placeholder="What should your students know?" className="w-full rounded-lg border border-line-strong px-3 py-2 focus:border-action focus:outline-none" />
      <div className="flex flex-wrap items-center gap-2">
        <Button icon={Megaphone} loading={state === "posting"} disabled={title.trim().length < 3 || body.trim().length < 3} onClick={post}>
          Post to {students} student{students === 1 ? "" : "s"}
        </Button>
        {state === "posted" && <span role="status" className="text-sm text-done">Posted. Students see it on their Home and here.</span>}
        {error && <span role="alert" className="text-sm text-danger">{error}</span>}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- small building blocks
function SectionTitle({ icon: Icon, children, action }: { icon: typeof Eye; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><Icon className="size-5 text-ink-3" aria-hidden /> {children}</h2>
      {action}
    </div>
  );
}

function WorkRow({ a, week, to, chip, color }: { a: Item; week: number | null; to: string; chip: { tone: ChipTone; label: string }; color: string }) {
  const k = kindOf(a.type);
  return (
    <li>
      <Link to={to} className="group flex items-center gap-3 px-4 py-3.5 hover:bg-canvas sm:px-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}14`, color }}>
          <k.icon className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium group-hover:text-action">{a.title}</span>
          <span className="block truncate text-sm text-ink-3">{week ? `Lecture ${week} · ` : ""}{rulesLine(a)}</span>
        </span>
        <span className="hidden shrink-0 text-right text-sm md:block">
          <span className="block text-ink-2">{a.status === "draft" ? "Not visible to students" : formatDue(a.dueAt, open(a)).split(" · ")[0]}</span>
          <span className="block text-xs text-ink-3">{a.dueAt ? formatDateTime(a.dueAt) : ""} · {a.marks} marks</span>
        </span>
        <Chip tone={chip.tone} className="shrink-0">{chip.label}</Chip>
      </Link>
    </li>
  );
}

function Group({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  if (!count) return null;
  return (
    <Card className="overflow-hidden">
      <p className="flex items-center justify-between border-b border-line bg-canvas px-5 py-2.5 text-sm font-semibold text-ink-2">
        {title} <span className="text-xs font-medium text-ink-3">{count}</span>
      </p>
      <ul className="divide-y divide-line">{children}</ul>
    </Card>
  );
}

// ---------------------------------------------------------------- the page
export function CoursePage() {
  const { id = "", tab: rawTab, sub } = useParams();
  const me = useMe();
  const reloadShell = useShellReload();
  const data = useApi<CourseData>(`/courses/${id}`);
  const [posted, setPosted] = useState<{ title: string; body: string; postedAt: string }[]>([]);
  const [kind, setKind] = useState<string>("all");
  const [copied, setCopied] = useState(false);
  const [viewed, setViewed] = useState<number[]>(() => readViewed(id));
  const tab: Tab = (TABS as string[]).includes(rawTab ?? "") ? (rawTab as Tab) : "overview";
  const base = me.role === "teacher" ? "/teacher" : "/student";
  const isStudent = me.role === "student";

  const d = data.status === "ready" ? data.data : null;
  const title = d ? `${d.course.code} · ${d.course.name}` : null;
  useEffect(() => {
    if (title) document.title = `${title} · Socratic AI`;
  }, [title]);
  useEffect(() => {
    setViewed(readViewed(id));
  }, [id]);

  const items = useMemo(() => (d ? [...d.weeks.flatMap((w) => w.assignments), ...d.unscheduled] : []), [d]);
  const weekOf = useMemo(() => new Map(d ? d.weeks.flatMap((w) => w.assignments.map((a) => [a.id, w.week] as const)) : []), [d]);
  // The current lecture: the one whose work is due next (else the last one).
  const currentWeek = useMemo(() => {
    if (!d) return null;
    const upcoming = d.weeks.filter((w) => w.assignments.some((a) => open(a) && a.dueAt && dayDiff(a.dueAt) >= 0));
    return upcoming[0]?.week ?? d.weeks.at(-1)?.week ?? null;
  }, [d]);

  // Opening a lecture marks it as viewed (for this student, in this browser).
  const lectureWeek = tab === "lectures" && sub ? Number(sub) : null;
  useEffect(() => {
    if (lectureWeek != null && isStudent) {
      markViewed(id, lectureWeek);
      setViewed(readViewed(id));
    }
  }, [lectureWeek, id, isStudent]);

  if (rawTab && !(TABS as string[]).includes(rawTab)) return <Navigate to={`${base}/courses/${id}`} replace />;
  if (rawTab === "marks" && !isStudent) return <Navigate to={`/teacher/courses/${id}/gradebook`} replace />;

  const linkFor = (a: Item) => (isStudent ? `/student/assignments/${a.id}` : `/teacher/assignments/${a.id}`);

  return (
    <AppShell>
      {data.status === "loading" && (
        <>
          <Skeleton className="h-40" />
          <Skeleton className="mt-4 h-12" />
          <Skeleton className="mt-6 h-80" />
        </>
      )}
      {data.status === "error" && <ErrorState message={data.message} onRetry={data.reload} />}
      {d && (() => {
        const cs = courseStyle(d.course.code);
        const work = items.filter((a) => a.type !== "quiz");
        const quizzes = items.filter((a) => a.type === "quiz");
        const announcements: { id?: string; title: string; body: string; postedAt: string }[] = [...posted, ...d.announcements];
        const progress = coursePercent(items.map(asStudent));
        const handedIn = items.filter((a) => a.submission && a.submission.status !== "in_progress").length;
        const comingUp = items.filter((a) => (isStudent ? needsWork(asStudent(a)) : open(a))).sort((a, b) => (a.dueAt ?? "9").localeCompare(b.dueAt ?? "9"));
        const current = d.weeks.find((w) => w.week === currentWeek) ?? null;
        const tabs: { key: Tab | "gradebook"; label: string; icon: typeof Eye; count?: number; to: string }[] = [
          { key: "overview", label: "Overview", icon: LayoutDashboard, to: `${base}/courses/${id}` },
          { key: "lectures", label: "Lectures", icon: Presentation, count: d.weeks.length, to: `${base}/courses/${id}/lectures` },
          { key: "assignments", label: "Assignments", icon: ClipboardList, count: work.length, to: `${base}/courses/${id}/assignments` },
          { key: "quizzes", label: "Quizzes", icon: ListChecks, count: quizzes.length, to: `${base}/courses/${id}/quizzes` },
          isStudent
            ? { key: "marks", label: "Marks", icon: Trophy, to: `${base}/courses/${id}/marks` }
            : { key: "gradebook", label: "Gradebook", icon: Table2, to: `/teacher/courses/${id}/gradebook` },
        ];

        return (
          <>
            {/* Course banner */}
            <div className="relative overflow-hidden rounded-2xl px-5 py-6 text-white sm:px-8 sm:py-7" style={{ backgroundColor: cs.color }}>
              <svg aria-hidden className="absolute inset-0 h-full w-full opacity-[0.12]" preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 120">
                <circle cx="360" cy="10" r="80" fill="#fff" />
                <circle cx="270" cy="140" r="56" fill="#fff" />
              </svg>
              <cs.icon className="absolute top-6 right-6 hidden size-14 opacity-80 sm:block" aria-hidden />
              <div className="relative">
                <p className="text-sm font-semibold tracking-wide opacity-90">{[d.course.code, d.course.term, d.course.section].filter(Boolean).join(" · ")}</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{d.course.name}</h1>
                <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 opacity-95">
                  <span>{d.course.teacher}</span>
                  <span className="flex items-center gap-1"><Users className="size-4" aria-hidden /> {d.course.students} students</span>
                  <span className="flex items-center gap-1"><Presentation className="size-4" aria-hidden /> {d.weeks.length} lectures</span>
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {isStudent ? (
                    <>
                      <span className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium">Handed in {handedIn} of {items.length}</span>
                      <span className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium">{progress ? `Marks so far ${progress.pct}%` : "No marks yet"}</span>
                    </>
                  ) : (
                    d.course.joinCode && (
                      <button
                        type="button"
                        onClick={() => { void navigator.clipboard?.writeText(d.course.joinCode!).then(() => setCopied(true)).catch(() => {}); }}
                        className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-white/15 px-3 text-sm font-medium hover:bg-white/25"
                        title="Students join with this code"
                      >
                        Join code <span className="font-mono font-bold tracking-widest">{d.course.joinCode}</span>
                        {copied ? <CheckCircle2 className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                        <span className="sr-only" role="status">{copied ? "Copied" : ""}</span>
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <nav aria-label="Course sections" className="sticky top-16 z-20 -mx-4 mb-6 border-b border-line bg-canvas/95 px-4 backdrop-blur sm:-mx-6 sm:px-6">
              <ul className="flex gap-1 overflow-x-auto">
                {tabs.map((t) => (
                  <li key={t.key}>
                    <NavLink
                      to={t.to}
                      end={t.key === "overview"}
                      className={({ isActive }) =>
                        cx(
                          "flex min-h-12 items-center gap-2 border-b-2 px-3 text-[15px] font-semibold whitespace-nowrap transition-colors",
                          isActive || tab === t.key ? "border-current" : "border-transparent text-ink-3 hover:text-ink",
                        )
                      }
                      style={({ isActive }) => (isActive || tab === t.key ? { color: cs.color } : undefined)}
                    >
                      <t.icon className="size-4" aria-hidden />
                      {t.label}
                      {t.count != null && <span className="rounded-full bg-locked-soft px-1.5 text-xs font-semibold text-ink-3 tabular-nums">{t.count}</span>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>

            {/* ---------------- Overview */}
            {tab === "overview" && (
              <div className="grid min-w-0 gap-6 lg:grid-cols-3">
                <div className="min-w-0 space-y-3 lg:col-span-2">
                  <SectionTitle icon={Megaphone}>Announcements</SectionTitle>
                  {!isStudent && <PostAnnouncement courseId={d.course.id} students={d.course.students} onPosted={(n) => { setPosted((p) => [n, ...p]); reloadShell(); }} />}
                  {announcements.length === 0 ? (
                    <EmptyState icon={Megaphone} title="No announcements yet" body={isStudent ? "When your teacher posts news for this course, it appears here and on your Home." : "Post news for the class above. Students see it here and on their Home."} />
                  ) : (
                    announcements.map((n, i) => (
                      <Card key={n.id ?? `p${i}`} as="article" className="p-5">
                        <div className="flex items-center gap-3">
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ backgroundColor: cs.color }} aria-hidden>
                            {initials(d.course.teacher)}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold leading-tight">{d.course.teacher}</p>
                            <p className="text-sm text-ink-3">{timeAgo(n.postedAt)}</p>
                          </div>
                        </div>
                        <h3 className="mt-3 text-lg font-semibold">{n.title}</h3>
                        <p className="mt-1 whitespace-pre-line text-ink-2">{n.body}</p>
                      </Card>
                    ))
                  )}
                </div>

                <aside className="min-w-0 space-y-6">
                  <section>
                    <SectionTitle icon={CalendarClock}>{isStudent ? "Coming up" : "Open now"}</SectionTitle>
                    <Card className="overflow-hidden">
                      {comingUp.length === 0 ? (
                        <p className="px-4 py-4 text-ink-3">{isStudent ? "Nothing due in this course. You're up to date." : "Nothing is open for students right now."}</p>
                      ) : (
                        <ul className="divide-y divide-line">
                          {comingUp.slice(0, 4).map((a) => {
                            const k = kindOf(a.type);
                            return (
                              <li key={a.id}>
                                <Link to={linkFor(a)} className="flex items-start gap-3 px-4 py-3 hover:bg-canvas">
                                  <k.icon className="mt-0.5 size-5 shrink-0" style={{ color: cs.color }} aria-hidden />
                                  <span className="min-w-0">
                                    <span className="block font-medium leading-snug">{a.title}</span>
                                    <span className="block text-sm text-ink-3">{isStudent ? formatDue(a.dueAt, true) : `${a.handedIn ?? 0}/${d.course.students} handed in · ${formatDue(a.dueAt, true).split(" · ")[0]}`}</span>
                                  </span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </Card>
                  </section>

                  {isStudent && <StudyChat courseId={d.course.id} courseCode={d.course.code} className="h-[26rem]" />}

                  {current && (
                    <section>
                      <SectionTitle icon={BookOpenText}>This week's lecture</SectionTitle>
                      <Link to={`${base}/courses/${id}/lectures/${current.week}`} className="group block overflow-hidden rounded-xl border border-line bg-surface hover:border-action">
                        <div className="h-2" style={{ backgroundColor: cs.color }} aria-hidden />
                        <div className="p-4">
                          <p className="text-sm font-semibold" style={{ color: cs.color }}>Lecture {current.week}</p>
                          <p className="font-semibold leading-snug group-hover:text-action">{current.title}</p>
                          <p className="mt-1 text-sm text-ink-3">{toSlides(current.title, current.notes).length + 1} slides and notes</p>
                          <p className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-action">Open the slides <ArrowRight className="size-4" aria-hidden /></p>
                        </div>
                      </Link>
                    </section>
                  )}

                  <section>
                    <SectionTitle icon={FileText}>About this course</SectionTitle>
                    <Card className="p-4">
                      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[15px]">
                        <dt className="text-ink-3">Teacher</dt><dd className="font-medium">{d.course.teacher}</dd>
                        {d.course.section && (<><dt className="text-ink-3">Section</dt><dd>{d.course.section}</dd></>)}
                        {d.course.term && (<><dt className="text-ink-3">Term</dt><dd>{d.course.term}</dd></>)}
                        <dt className="text-ink-3">Students</dt><dd>{d.course.students}</dd>
                        <dt className="text-ink-3">Work set</dt><dd>{work.length} assignment{work.length === 1 ? "" : "s"} · {quizzes.length} quiz{quizzes.length === 1 ? "" : "zes"}</dd>
                      </dl>
                    </Card>
                  </section>
                </aside>
              </div>
            )}

            {/* ---------------- Lectures */}
            {tab === "lectures" && lectureWeek == null && (
              <>
                <SectionTitle icon={Presentation}>Lectures</SectionTitle>
                {d.weeks.length === 0 ? (
                  <EmptyState icon={Presentation} title="No lectures yet" body="Lecture slides and notes appear here, week by week, as the teacher adds them." />
                ) : (
                  <Card className="overflow-hidden">
                    <ul className="divide-y divide-line">
                      {d.weeks.map((w) => {
                        const n = toSlides(w.title, w.notes).length + 1;
                        const seen = viewed.includes(w.week);
                        return (
                          <li key={w.week}>
                            <Link to={`${base}/courses/${id}/lectures/${w.week}`} className="group flex items-center gap-4 px-4 py-4 hover:bg-canvas sm:px-5">
                              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg text-lg font-bold tabular-nums" style={{ backgroundColor: cs.soft, color: cs.color }}>
                                {w.week}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-xs font-semibold text-ink-3">Lecture {w.week} · Week {w.week}</span>
                                <span className="block truncate font-semibold group-hover:text-action">{w.title}</span>
                                <span className="block text-sm text-ink-3">
                                  {n} slides
                                  {w.assignments.length > 0 && ` · ${w.assignments.length} task${w.assignments.length === 1 ? "" : "s"}: ${w.assignments.map((a) => kindOf(a.type).label.toLowerCase()).join(", ")}`}
                                </span>
                              </span>
                              {w.week === currentWeek && <Chip tone="action" icon={null}>This week</Chip>}
                              {isStudent && seen && <Chip tone="done" icon={Eye}>Viewed</Chip>}
                              <ArrowRight className="size-5 shrink-0 text-ink-3 group-hover:text-action" aria-hidden />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </Card>
                )}
              </>
            )}
            {tab === "lectures" && lectureWeek != null && (() => {
              const idx = d.weeks.findIndex((w) => w.week === lectureWeek);
              if (idx < 0) return <Navigate to={`${base}/courses/${id}/lectures`} replace />;
              const w = d.weeks[idx]!;
              return (
                <LectureView
                  course={d.course}
                  lecture={w}
                  prev={d.weeks[idx - 1] ?? null}
                  next={d.weeks[idx + 1] ?? null}
                  base={base}
                  tasks={w.assignments.map((a) => ({ id: a.id, title: a.title, type: a.type, meta: a.status === "draft" ? "Draft" : formatDue(a.dueAt, open(a)).split(" · ")[0]!, chip: chipFor(a, me.role, d.course.students), to: linkFor(a) }))}
                />
              );
            })()}

            {/* ---------------- Assignments */}
            {tab === "assignments" && (() => {
              const kinds = [...new Set(work.map((a) => a.type))];
              const shown = kind === "all" ? work : work.filter((a) => a.type === kind);
              const byDue = (xs: Item[], desc = false) => [...xs].sort((a, b) => (desc ? -1 : 1) * (a.dueAt ?? "9").localeCompare(b.dueAt ?? "9"));
              const row = (a: Item) => <WorkRow key={a.id} a={a} week={weekOf.get(a.id) ?? null} to={linkFor(a)} chip={chipFor(a, me.role, d.course.students)} color={cs.color} />;
              const groups: [string, Item[]][] = isStudent
                ? [
                    ["To do", byDue(shown.filter((a) => needsWork(asStudent(a))))],
                    ["Handed in", byDue(shown.filter((a) => a.submission && a.submission.status !== "in_progress"), true)],
                    ["Closed", byDue(shown.filter((a) => !open(a) && (!a.submission || a.submission.status === "in_progress")), true)],
                  ]
                : [
                    ["Open", byDue(shown.filter(open))],
                    ["Drafts", shown.filter((a) => a.status === "draft")],
                    ["Closed", byDue(shown.filter((a) => a.status === "closed"), true)],
                  ];
              return (
                <>
                  <SectionTitle
                    icon={ClipboardList}
                    action={
                      !isStudent && (
                        <Link to={`/teacher/assignments/new?course=${id}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-action px-4 font-semibold text-white hover:bg-action-hover">
                          <Plus className="size-5" aria-hidden /> New assignment
                        </Link>
                      )
                    }
                  >
                    Assignments
                  </SectionTitle>
                  {kinds.length > 1 && (
                    <div className="mb-4">
                      <Segmented label="Show" value={kind} onChange={setKind} options={[{ value: "all", label: `All (${work.length})` }, ...kinds.map((k) => ({ value: k, label: `${kindOf(k).plural} (${work.filter((a) => a.type === k).length})` }))]} />
                    </div>
                  )}
                  {work.length === 0 ? (
                    <EmptyState icon={ClipboardList} title="No assignments yet" body={isStudent ? "Labs, written and handwritten work appear here when your teacher sets them." : "Create a lab, written or handwritten assignment for this course."} />
                  ) : (
                    <div className="space-y-4">
                      {groups.map(([t, xs]) => (
                        <Group key={t} title={t} count={xs.length}>{xs.map(row)}</Group>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}

            {/* ---------------- Quizzes */}
            {tab === "quizzes" && (
              <>
                <SectionTitle icon={ListChecks}>Quizzes</SectionTitle>
                {isStudent && quizzes.length > 0 && (
                  <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-action-line bg-action-soft px-4 py-3">
                    <UstaadAvatar className="size-9" />
                    <p className="min-w-0 flex-1 text-[15px] text-ink-2">
                      <strong className="text-ink">Revise with Ustaad first.</strong> Every lecture has practice questions and an AI tutor. During a graded quiz Ustaad is off, so the mark is all yours.
                    </p>
                    <Link to={`${base}/courses/${id}/lectures`} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-surface px-4 font-semibold text-action ring-1 ring-action-line hover:bg-white">
                      Go to lectures <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  </div>
                )}
                {quizzes.length === 0 ? (
                  <EmptyState icon={ListChecks} title="No quizzes yet" body={isStudent ? "Timed quizzes appear here when your teacher publishes them." : "Create a timed quiz from the assignment builder."} />
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {[...quizzes].sort((a, b) => Number(open(b)) - Number(open(a)) || (a.dueAt ?? "").localeCompare(b.dueAt ?? "")).map((q) => {
                      const chip = chipFor(q, me.role, d.course.students);
                      const s = q.submission;
                      const finished = s && s.status !== "in_progress";
                      const action = !isStudent ? "See results" : finished ? "See my result" : !open(q) ? "View" : s ? "Continue quiz" : "Start quiz";
                      return (
                        <Card key={q.id} className="flex flex-col p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-ink-3">{weekOf.get(q.id) ? `Lecture ${weekOf.get(q.id)} · ` : ""}{q.marks} marks</p>
                              <h3 className="text-lg leading-snug font-semibold">{q.title}</h3>
                            </div>
                            <Chip tone={chip.tone} className="shrink-0">{chip.label}</Chip>
                          </div>
                          <ul className="mt-3 flex flex-wrap gap-2 text-sm text-ink-2">
                            {q.questions != null && <li className="flex items-center gap-1.5 rounded-md bg-locked-soft px-2 py-1"><ListChecks className="size-4" aria-hidden /> {q.questions} questions</li>}
                            {q.timeLimitMinutes && <li className="flex items-center gap-1.5 rounded-md bg-locked-soft px-2 py-1"><Timer className="size-4" aria-hidden /> {q.timeLimitMinutes} minutes</li>}
                            {q.fullscreen && <li className="flex items-center gap-1.5 rounded-md bg-locked-soft px-2 py-1">Full screen</li>}
                          </ul>
                          <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-3"><CalendarClock className="size-4" aria-hidden /> {q.status === "draft" ? "Draft, not visible to students" : formatDue(q.dueAt, open(q))}</p>
                          <div className="mt-auto pt-4">
                            <Link
                              to={isStudent && finished ? resultsLink(q.id, q.type) : linkFor(q)}
                              className={cx(
                                "inline-flex min-h-11 items-center gap-2 rounded-lg px-4 font-semibold",
                                isStudent && open(q) && !finished ? "bg-action text-white hover:bg-action-hover" : "border border-line-strong bg-surface hover:border-action hover:text-action",
                              )}
                            >
                              {action} <ArrowRight className="size-4" aria-hidden />
                            </Link>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* ---------------- Marks (student) */}
            {tab === "marks" && isStudent && (
              <>
                <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "Marks so far", value: progress ? `${fmtMark(progress.got)} / ${progress.outOf}` : "–" },
                    { label: "Percentage", value: progress ? `${progress.pct}%` : "–" },
                    { label: "Handed in", value: `${handedIn} of ${items.length}` },
                    {
                      label: "Average viva",
                      value: (() => {
                        const v = items.map((a) => a.submission?.vivaScore).filter((x): x is number => x != null);
                        return v.length ? `${Math.round(v.reduce((a, b) => a + b, 0) / v.length)}/100` : "–";
                      })(),
                    },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl border border-line bg-surface px-4 py-3">
                      <p className="text-xs font-medium text-ink-3">{s.label}</p>
                      <p className="text-xl font-bold tabular-nums">{s.value}</p>
                    </div>
                  ))}
                </div>
                <Card className="overflow-x-auto">
                  <table className="w-full min-w-[40rem] text-left">
                    <thead className="border-b border-line bg-canvas text-xs font-semibold tracking-wide text-ink-3 uppercase">
                      <tr>
                        <th className="px-5 py-2.5">Work</th>
                        <th className="px-3 py-2.5">Due</th>
                        <th className="px-3 py-2.5 text-right">Viva</th>
                        <th className="px-3 py-2.5 text-right">Mark</th>
                        <th className="px-5 py-2.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {[...items].sort((a, b) => (a.dueAt ?? "9").localeCompare(b.dueAt ?? "9")).map((a) => {
                        const k = kindOf(a.type);
                        const st = statusOf(asStudent(a));
                        const finished = a.submission && a.submission.status !== "in_progress";
                        return (
                          <tr key={a.id} className="hover:bg-canvas">
                            <td className="px-5 py-3">
                              <Link to={finished ? resultsLink(a.id, a.type) : linkFor(a)} className="font-medium hover:text-action">{a.title}</Link>
                              <span className="block text-xs text-ink-3"><k.icon className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />{k.label}{weekOf.get(a.id) ? ` · Lecture ${weekOf.get(a.id)}` : ""}</span>
                            </td>
                            <td className="px-3 py-3 text-sm text-ink-2">{a.dueAt ? formatDateTime(a.dueAt) : "–"}</td>
                            <td className="px-3 py-3 text-right text-sm tabular-nums">{a.submission?.vivaScore != null ? `${a.submission.vivaScore}/100` : "–"}</td>
                            <td className="px-3 py-3 text-right font-semibold tabular-nums">
                              {a.submission?.grade != null ? `${fmtMark(a.submission.grade)}/${a.marks}` : <span className="font-normal text-ink-3">–/{a.marks}</span>}
                              {a.submission?.grade != null && !a.submission.confirmed && <span className="block text-xs font-normal text-ink-3">suggested</span>}
                            </td>
                            <td className="px-5 py-3 text-right"><Chip tone={st.tone}>{st.label}</Chip></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Card>
                <p className="mt-3 text-sm text-ink-3">"Suggested" marks come from tests and the viva and become final when your teacher confirms them.</p>
              </>
            )}
          </>
        );
      })()}
    </AppShell>
  );
}
