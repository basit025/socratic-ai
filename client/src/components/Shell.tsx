/**
 * The signed-in frame, like a real campus platform: a sidebar (Home, My courses, Calendar, Marks) that folds to an
 * icon rail, a top bar (light/dark switch, notifications, the person) and the page. It stays mounted while pages change,
 * so navigating never flashes a loading screen. While doing an assignment the sidebar folds away (focus mode).
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import {
  ArrowLeftRight, Bell, BookOpen, CalendarDays, CheckCircle2, ChevronDown, Clock, FilePlus2, Home, LayoutGrid, LogOut, Megaphone, Menu, Moon, PanelLeftClose, PanelLeftOpen,
  RotateCcw, Sun, Trophy, X,
} from "lucide-react";
import { Dialog } from "./Dialog";
import { Logo } from "./Logo";
import { Button, cx } from "./ui";
import { api } from "../lib/api";
import { useMe } from "../lib/session";
import { useApi, type Loadable } from "../lib/useApi";
import { courseStyle } from "../lib/courseStyle";
import { formatDue, timeAgo } from "../lib/format";
import { kindOf, needsWork, type Notice, type StudentHomeData } from "../lib/student";
import { readPref, useTheme, writePref } from "../lib/theme";


interface TeacherNavCourse {
  id: string;
  code: string;
  name: string;
  section: string | null;
  toReview: number;
  flagged: number;
}

interface ShellState {
  student: (Loadable<StudentHomeData> & { reload: () => void }) | null;
  teacher: (Loadable<{ courses: TeacherNavCourse[] }> & { reload: () => void }) | null;
}
const ShellContext = createContext<ShellState>({ student: null, teacher: null });

/** The student's courses, to-dos and notifications, fetched once for the whole signed-in session. */
export function useStudentData() {
  const s = useContext(ShellContext).student;
  if (!s) throw new Error("useStudentData must be used inside the student shell");
  return s;
}

/** Refresh the sidebar's course list (after creating or joining a course). */
export function useShellReload() {
  const s = useContext(ShellContext);
  return () => {
    s.student?.reload();
    s.teacher?.reload();
  };
}

export function initials(name: string) {
  return name
    .replace(/^(Dr|Mr|Ms|Mrs|Prof)\.?\s+/i, "") // "Dr. Nauman Shamim" → NS
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// ---------------------------------------------------------------- notifications
const seenKey = (me: { name: string; expiresAt: string }) => `socratic.seen.${me.name}.${me.expiresAt}`;
function readSeen(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}
function writeSeen(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* private mode: notifications simply stay "new" */
  }
}

export function noticeView(n: Notice): { icon: typeof Bell; tone: string; line: string; to: string } {
  const k = kindOf(n.assignmentType ?? "code");
  const work = n.assignmentId ? `/student/assignments/${n.assignmentId}` : `/student/courses/${n.courseId}`;
  if (n.kind === "announcement") return { icon: Megaphone, tone: "text-action bg-action-soft", line: `Announcement in ${n.courseCode}`, to: `/student/courses/${n.courseId}` };
  if (n.kind === "new_work") return { icon: FilePlus2, tone: "text-action bg-action-soft", line: `New ${k.label.toLowerCase()} in ${n.courseCode} · ${formatDue(n.dueAt ?? null, true).split(" · ")[0]}`, to: work };
  if (n.kind === "marked")
    return { icon: CheckCircle2, tone: "text-done bg-done-soft", line: `Marked in ${n.courseCode}: ${n.body}`, to: n.assignmentType === "quiz" ? work : `${work}/viva` };
  return { icon: Clock, tone: "text-attention bg-attention-soft", line: `Reminder in ${n.courseCode} · ${formatDue(n.dueAt ?? null, true).split(" · ")[0]}`, to: work };
}

function NotificationBell({ notices }: { notices: Notice[] }) {
  const me = useMe();
  const key = seenKey(me);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(() => readSeen(key));
  const [seenWhenOpened, setSeenWhenOpened] = useState(seen);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notices.filter((n) => n.at > seen).length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open) {
      // Opening the panel marks everything as read; this time the new ones still show their dot.
      setSeenWhenOpened(seen);
      const newest = notices[0]?.at ?? new Date().toISOString();
      writeSeen(key, newest);
      setSeen(newest);
    }
    setOpen((o) => !o);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} new` : "Notifications"}
        className="relative flex size-11 items-center justify-center rounded-lg text-ink-2 hover:bg-locked-soft hover:text-ink"
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-semibold">Notifications</p>
            <Link to="/student" onClick={() => setOpen(false)} className="text-sm font-medium text-action hover:underline">
              See all on Home
            </Link>
          </div>
          {notices.length === 0 ? (
            <p className="px-4 py-6 text-center text-ink-3">Nothing new. Announcements, new work and marks will appear here.</p>
          ) : (
            <ul className="max-h-[26rem] divide-y divide-line overflow-y-auto">
              {notices.slice(0, 12).map((n) => {
                const v = noticeView(n);
                return (
                  <li key={n.id}>
                    <Link to={v.to} onClick={() => setOpen(false)} className="flex gap-3 px-4 py-3 hover:bg-canvas">
                      <span className={cx("flex size-9 shrink-0 items-center justify-center rounded-full", v.tone)}>
                        <v.icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium text-ink">{n.title}</span>
                        <span className="block truncate text-sm text-ink-3">{v.line}</span>
                        <span className="block text-xs text-ink-3">{timeAgo(n.at)}</span>
                      </span>
                      {n.at > seenWhenOpened && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-action" aria-label="New" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- person menu
function PersonMenu() {
  const me = useMe();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const startOver = async () => {
    setResetting(true);
    try {
      const r = await api<{ home: string }>("/demo/start", { body: { role: me.role } });
      window.location.assign(r.home);
    } catch {
      setResetting(false);
      setResetOpen(false);
    }
  };
  const leave = async () => {
    setLeaving(true);
    await api("/demo/end", { method: "POST" }).catch(() => {});
    navigate("/", { replace: true });
  };

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-h-11 items-center gap-2 rounded-lg px-1.5 hover:bg-locked-soft">
        <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-action text-sm font-semibold text-white">{initials(me.name)}</span>
        <span className="hidden text-left text-sm leading-tight md:block">
          <span className="block font-semibold">{me.name}</span>
          <span className="block text-ink-3">{me.role === "teacher" ? "Teacher" : "Student"}</span>
        </span>
        <ChevronDown className="size-4 text-ink-3" aria-hidden />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-xl">
          <div className="border-b border-line px-4 py-3">
            <p className="font-semibold">{me.name}</p>
            <p className="text-sm text-ink-3">{me.role === "teacher" ? "Teacher" : "Student"}</p>
          </div>
          {me.demo && (
            <button type="button" onClick={() => { setOpen(false); setResetOpen(true); }} className="flex min-h-11 w-full items-center gap-2.5 px-4 text-left hover:bg-canvas">
              <RotateCcw className="size-4 text-ink-3" aria-hidden /> Reset workspace
            </button>
          )}
          <button type="button" onClick={leave} disabled={leaving} className="flex min-h-11 w-full items-center gap-2.5 px-4 text-left hover:bg-canvas">
            <LogOut className="size-4 text-ink-3" aria-hidden /> Sign out
          </button>
        </div>
      )}
      <Dialog open={resetOpen} title="Reset this workspace?" onClose={() => !resetting && setResetOpen(false)}>
        <p className="text-ink-2">You'll get a fresh copy of every course, as a {me.role}. Anything you changed here is cleared.</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setResetOpen(false)} disabled={resetting} data-autofocus>
            Cancel
          </Button>
          <Button icon={RotateCcw} loading={resetting} onClick={startOver}>
            Reset
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function SwitchRole() {
  const me = useMe();
  const [switching, setSwitching] = useState(false);
  if (!me.demo) return null;
  const go = async () => {
    setSwitching(true);
    try {
      const r = await api<{ home: string }>("/demo/switch", { body: {} });
      window.location.assign(r.home); // full reload so every screen re-reads the new role
    } catch {
      setSwitching(false);
    }
  };
  return (
    <Button variant="ghost" icon={ArrowLeftRight} loading={switching} onClick={go} title={`See this workspace as the ${me.role === "teacher" ? "student" : "teacher"}`}>
      <span className="hidden lg:inline">{me.role === "teacher" ? "Student view" : "Teacher view"}</span>
    </Button>
  );
}

// ---------------------------------------------------------------- sidebar
const navItem = ({ isActive }: { isActive: boolean }) =>
  cx("flex min-h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-medium transition-colors", isActive ? "bg-action-soft text-action" : "text-ink-2 hover:bg-locked-soft hover:text-ink");
const railItem = ({ isActive }: { isActive: boolean }) =>
  cx("mx-auto flex size-11 items-center justify-center rounded-lg transition-colors", isActive ? "bg-action-soft text-action" : "text-ink-2 hover:bg-locked-soft hover:text-ink");

const SIDEBAR_KEY = "socratic.sidebar";
const COURSES_OPEN_KEY = "socratic.sidebar.courses";

interface NavCourse {
  id: string;
  code: string;
  sub: string;
  name: string;
  badge: number;
  badgeLabel: string;
}

function useNavCourses(): NavCourse[] | null {
  const me = useMe();
  const s = useContext(ShellContext);
  if (me.role === "student")
    return s.student?.status === "ready"
      ? s.student.data.courses.map((c) => ({ id: c.id, code: c.code, sub: c.code, name: c.name, badge: c.assignments.filter(needsWork).length, badgeLabel: "to do" }))
      : null;
  return s.teacher?.status === "ready"
    ? s.teacher.data.courses.map((c) => ({ id: c.id, code: c.code, sub: c.section ? `${c.code} · ${c.section.replace(/^Section /, "Sec. ")}` : c.code, name: c.name, badge: c.toReview, badgeLabel: "to review" }))
    : null;
}

function CourseIcon({ code, className }: { code: string; className?: string }) {
  const st = courseStyle(code);
  return (
    <span className={cx("flex shrink-0 items-center justify-center rounded-md text-white", className)} style={{ backgroundColor: st.color }}>
      <st.icon className="size-4" aria-hidden />
    </span>
  );
}

/** The full sidebar: Home, My courses (a section that opens to every course), then the student's Calendar and Marks. */
function Sidebar({ onNavigate, onCollapse }: { onNavigate?: () => void; onCollapse?: () => void }) {
  const me = useMe();
  const location = useLocation();
  const base = me.role === "teacher" ? "/teacher" : "/student";
  const courses = useNavCourses();
  const [open, setOpen] = useState(() => readPref(COURSES_OPEN_KEY) !== "closed");
  const inCourse = location.pathname.startsWith(`${base}/courses`);
  const groupLabel = me.role === "teacher" ? "Courses I teach" : "My courses";
  const toDo = courses?.reduce((n, c) => n + c.badge, 0) ?? 0;
  const toggleOpen = () => {
    writePref(COURSES_OPEN_KEY, open ? "closed" : "open");
    setOpen(!open);
  };

  return (
    <nav aria-label="Main" className="flex h-full flex-col">
      {/* The toggle sits in the top-left corner in both states, so folding and unfolding is the same click. */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Collapse the sidebar"
            aria-expanded="true"
            title="Collapse the sidebar (Ctrl+B)"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-ink-3 hover:bg-locked-soft hover:text-ink"
          >
            <PanelLeftClose className="size-5" aria-hidden />
          </button>
        )}
        <Link to={base} onClick={onNavigate} aria-label="Socratic AI home">
          <Logo />
        </Link>
      </div>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        <NavLink to={base} end onClick={onNavigate} className={navItem}>
          <Home className="size-5" aria-hidden /> Home
        </NavLink>

        <button
          type="button"
          onClick={toggleOpen}
          aria-expanded={open}
          aria-controls="sidebar-courses"
          className={cx(
            "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] font-medium transition-colors hover:bg-locked-soft",
            inCourse && !open ? "text-action" : "text-ink-2 hover:text-ink",
          )}
        >
          <BookOpen className="size-5" aria-hidden />
          <span className="flex-1">{groupLabel}</span>
          {!open && toDo > 0 && (
            <span className="rounded-full bg-action-soft px-2 py-0.5 text-xs font-semibold text-action tabular-nums" aria-label={`${toDo} ${me.role === "teacher" ? "to review" : "to do"}`}>
              {toDo}
            </span>
          )}
          <ChevronDown className={cx("size-4 text-ink-3 transition-transform", !open && "-rotate-90")} aria-hidden />
        </button>
        {open && (
          <div id="sidebar-courses" className="space-y-0.5 pb-1 pl-3">
            {!courses && [0, 1, 2, 3].map((i) => <div key={i} className="mx-1 my-1.5 h-9 animate-pulse rounded-lg bg-locked-soft" />)}
            {courses?.length === 0 && <p className="px-3 py-2 text-sm text-ink-3">{me.role === "teacher" ? "No courses yet." : "Join a course with your teacher's code."}</p>}
            {courses?.map((c) => (
              <NavLink
                key={c.id}
                to={`${base}/courses/${c.id}`}
                onClick={onNavigate}
                title={`${c.code} · ${c.name}`}
                className={({ isActive }) => cx("flex min-h-11 items-center gap-3 rounded-lg px-2.5 py-1 transition-colors", isActive ? "bg-locked-soft" : "hover:bg-locked-soft")}
              >
                {({ isActive }) => (
                  <>
                    <CourseIcon code={c.code} className="size-8" />
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className={cx("block truncate text-xs font-semibold", isActive ? "text-ink" : "text-ink-3")}>{c.sub}</span>
                      <span className={cx("block truncate text-sm", isActive ? "font-semibold text-ink" : "text-ink-2")}>{c.name}</span>
                    </span>
                    {c.badge > 0 && (
                      <span className="rounded-full bg-action-soft px-2 py-0.5 text-xs font-semibold text-action tabular-nums" aria-label={`${c.badge} ${c.badgeLabel}`}>
                        {c.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
            {me.role === "student" && (
              <NavLink
                to="/student/courses"
                end
                onClick={onNavigate}
                className={({ isActive }) =>
                  cx("flex min-h-10 items-center gap-3 rounded-lg px-2.5 text-sm font-medium transition-colors", isActive ? "bg-action-soft text-action" : "text-ink-3 hover:bg-locked-soft hover:text-ink")
                }
              >
                <span className="flex size-8 items-center justify-center"><LayoutGrid className="size-4" aria-hidden /></span>
                All courses and joining
              </NavLink>
            )}
          </div>
        )}

        {me.role === "student" && (
          <>
            <NavLink to="/student/calendar" onClick={onNavigate} className={navItem}>
              <CalendarDays className="size-5" aria-hidden /> Calendar
            </NavLink>
            <NavLink to="/student/marks" onClick={onNavigate} className={navItem}>
              <Trophy className="size-5" aria-hidden /> Marks
            </NavLink>
          </>
        )}
      </div>
    </nav>
  );
}

/** The folded sidebar: icons only, with each name on hover, so the page gets the width. */
function SidebarRail({ onExpand }: { onExpand: () => void }) {
  const me = useMe();
  const base = me.role === "teacher" ? "/teacher" : "/student";
  const courses = useNavCourses();
  return (
    <nav aria-label="Main" className="flex h-full flex-col">
      <div className="px-4 pt-4 pb-3">
        <button
          type="button"
          onClick={onExpand}
          aria-label="Expand the sidebar"
          aria-expanded="false"
          title="Expand the sidebar (Ctrl+B)"
          className="flex size-10 items-center justify-center rounded-lg text-ink-3 hover:bg-locked-soft hover:text-ink"
        >
          <PanelLeftOpen className="size-5" aria-hidden />
        </button>
      </div>
      <div className="flex min-h-0 w-full flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-4">
        <NavLink to={base} end className={railItem} aria-label="Home" title="Home">
          <Home className="size-5" aria-hidden />
        </NavLink>
        {me.role === "student" ? (
          <>
            <NavLink to="/student/courses" end className={railItem} aria-label="My courses" title="My courses">
              <BookOpen className="size-5" aria-hidden />
            </NavLink>
            <NavLink to="/student/calendar" className={railItem} aria-label="Calendar" title="Calendar">
              <CalendarDays className="size-5" aria-hidden />
            </NavLink>
            <NavLink to="/student/marks" className={railItem} aria-label="Marks" title="Marks">
              <Trophy className="size-5" aria-hidden />
            </NavLink>
          </>
        ) : null}
        <div className="mx-auto my-2 h-px w-8 bg-line" aria-hidden />
        {courses?.map((c) => (
          <NavLink
            key={c.id}
            to={`${base}/courses/${c.id}`}
            aria-label={`${c.code} · ${c.name}${c.badge ? `, ${c.badge} ${c.badgeLabel}` : ""}`}
            title={`${c.code} · ${c.name}`}
            className={({ isActive }) => cx("relative mx-auto flex size-11 items-center justify-center rounded-lg transition-colors", isActive ? "bg-locked-soft" : "hover:bg-locked-soft")}
          >
            <CourseIcon code={c.code} className="size-8" />
            {c.badge > 0 && <span className="absolute top-1 right-1 size-2.5 rounded-full border-2 border-surface bg-action" aria-hidden />}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button type="button" onClick={toggle} aria-label={label} title={label} className="flex size-11 items-center justify-center rounded-lg text-ink-2 hover:bg-locked-soft hover:text-ink">
      {theme === "dark" ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
    </button>
  );
}

// ---------------------------------------------------------------- the frame
export function Shell() {
  const me = useMe();
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(() => readPref(SIDEBAR_KEY) === "collapsed");
  const student = useApi<StudentHomeData>(me.role === "student" ? "/student/home" : null);
  const teacher = useApi<{ courses: TeacherNavCourse[] }>(me.role === "teacher" ? "/teacher/home" : null);
  const focus = /^\/student\/assignments\//.test(location.pathname);

  useEffect(() => setDrawer(false), [location.pathname]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer]);

  const setSidebar = (c: boolean) => {
    writePref(SIDEBAR_KEY, c ? "collapsed" : "open");
    setCollapsed(c);
  };
  // Ctrl+B (⌘B on a Mac) folds or unfolds the sidebar, except while typing.
  useEffect(() => {
    if (focus) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "b") return;
      const t = e.target as HTMLElement | null;
      if (t && (/input|textarea|select/i.test(t.tagName) || t.isContentEditable)) return;
      e.preventDefault();
      setCollapsed((c) => {
        writePref(SIDEBAR_KEY, c ? "open" : "collapsed");
        return !c;
      });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [focus]);

  const state: ShellState = { student: me.role === "student" ? student : null, teacher: me.role === "teacher" ? teacher : null };

  return (
    <ShellContext.Provider value={state}>
      <div className="min-h-screen lg:flex">
        {!focus && (
          <aside className={cx("sticky top-0 hidden h-screen shrink-0 border-r border-line bg-surface transition-[width] duration-200 lg:block", collapsed ? "w-[72px]" : "w-64")}>
            {collapsed ? <SidebarRail onExpand={() => setSidebar(false)} /> : <Sidebar onCollapse={() => setSidebar(true)} />}
          </aside>
        )}
        {drawer && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <button type="button" className="absolute inset-0 bg-scrim/50" aria-label="Close the menu" onClick={() => setDrawer(false)} />
            <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface shadow-2xl">
              <button type="button" onClick={() => setDrawer(false)} aria-label="Close the menu" className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-lg text-ink-3 hover:bg-locked-soft">
                <X className="size-5" aria-hidden />
              </button>
              <Sidebar onNavigate={() => setDrawer(false)} />
            </div>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
            <div className="flex h-16 items-center gap-2 px-4 sm:px-6">
              <button
                type="button"
                onClick={() => setDrawer(true)}
                aria-label="Open the menu"
                className={cx("flex size-11 items-center justify-center rounded-lg text-ink-2 hover:bg-locked-soft", !focus && "lg:hidden")}
              >
                <Menu className="size-5" aria-hidden />
              </button>
              <Link to={me.role === "teacher" ? "/teacher" : "/student"} className={cx(!focus && !collapsed && "lg:hidden")} aria-label="Socratic AI home">
                <Logo className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline" />
              </Link>
              <div className="flex-1" />
              <SwitchRole />
              <ThemeToggle />
              {me.role === "student" && <NotificationBell notices={student.status === "ready" ? student.data.notifications : []} />}
              <PersonMenu />
            </div>
          </header>
          <Outlet />
        </div>
      </div>
    </ShellContext.Provider>
  );
}

/** The page body inside the shell. `wide` gives work screens (editor + mentor) more room. */
export function Page({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <main className={cx("mx-auto px-4 py-6 sm:px-6 lg:py-8", wide ? "max-w-[96rem]" : "max-w-6xl")}>{children}</main>;
}
