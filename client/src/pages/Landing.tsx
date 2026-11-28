/**
 * The public site: what Socratic AI is, who it's for, and two ways in (an instant private demo, or a pilot
 * request for a real class). Screens shown are real screenshots of the platform with the demo data.
 * No invented numbers, quotes or client logos anywhere on this page.
 */
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  ArrowRight, BookOpen, Building2, Check, CheckCircle2, ClipboardX, Code2, EyeOff, Flag, GraduationCap, ListChecks, Loader2,
  Megaphone, Menu, MessageCircleQuestion, Mic, PenLine, Presentation, ShieldCheck, Smartphone, Sparkles, Table2, X,
} from "lucide-react";
import { api, ApiError, prewarmApi } from "../lib/api";
import { preloadRunnerWhenIdle } from "../runner/runner";
import { Logo } from "../components/Logo";
import { cx } from "../components/ui";

interface StartResponse {
  home: string;
}

/* ------------------------------------------------------------------ small building blocks */

function BrowserFrame({ src, alt, className, eager }: { src: string; alt: string; className?: string; eager?: boolean }) {
  return (
    <figure className={cx("overflow-hidden rounded-xl border border-line bg-surface shadow-[0_24px_60px_-20px_rgba(15,23,42,0.35)]", className)}>
      <div className="flex items-center gap-1.5 border-b border-line bg-canvas px-3 py-2" aria-hidden>
        <span className="size-2.5 rounded-full bg-[#f87171]" />
        <span className="size-2.5 rounded-full bg-[#fbbf24]" />
        <span className="size-2.5 rounded-full bg-[#34d399]" />
        <span className="ml-3 hidden flex-1 truncate rounded-md bg-surface px-2 py-0.5 text-[11px] text-ink-3 sm:block">socratic-ai-pk.vercel.app</span>
      </div>
      <img src={src} alt={alt} width={1440} height={900} loading={eager ? "eager" : "lazy"} decoding="async" {...(eager ? { fetchPriority: "high" as const } : {})} className="block h-auto w-full" />
    </figure>
  );
}

function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("text-sm font-semibold tracking-wide text-action uppercase", className)}>{children}</p>;
}

function SectionHead({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {body && <p className="mt-4 text-lg text-ink-2 text-pretty">{body}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ the three-step illustration
 * Small, faithful mock-ups of the real screens (decorative: the captions carry the meaning). */

function EditorSketch() {
  return (
    <div aria-hidden className="rounded-lg border border-line bg-surface p-3 font-mono text-[12.5px] leading-6 shadow-sm [font-variant-ligatures:none]">
      <div className="mb-2 flex items-center justify-between font-sans text-[11px]">
        <span className="font-semibold text-ink-2">solution.py</span>
        <span className="flex items-center gap-1 rounded-full bg-locked-soft px-2 py-0.5 text-locked"><ClipboardX className="size-3" /> Paste is off</span>
      </div>
      <div><span className="text-[#7c3aed]">for</span> runs <span className="text-[#7c3aed]">in</span> balls:</div>
      <div className="pl-4">total += runs</div>
      <div className="pl-4">
        <span className="text-[#7c3aed]">if</span> runs &gt;= 4<span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-action" />
      </div>
      <div className="mt-2 flex gap-1.5 font-sans text-[11px]">
        <span className="rounded bg-danger-soft px-1.5 py-0.5 text-danger">Run: error</span>
        <span className="rounded bg-done-soft px-1.5 py-0.5 text-done">Run: ✓ (14, 2)</span>
      </div>
    </div>
  );
}

function VivaSketch() {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <div aria-hidden className="rounded-lg border border-line bg-surface p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <span className="h-1.5 w-5 rounded-full bg-done" />
          <span className="h-1.5 w-5 rounded-full bg-action" />
          <span className="h-1.5 w-5 rounded-full bg-locked-line" />
        </div>
        <svg viewBox="0 0 40 40" className="size-10 -rotate-90">
          <circle cx="20" cy="20" r={r} fill="none" stroke="var(--color-locked-line)" strokeWidth="4" />
          <circle cx="20" cy="20" r={r} fill="none" stroke="var(--color-action)" strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * 0.32} />
          <text x="20" y="24.5" textAnchor="middle" className="fill-ink text-[11px] font-bold" transform="rotate(90 20 20)">62</text>
        </svg>
      </div>
      <p className="mt-1.5 text-[13px] leading-snug font-semibold text-ink">
        What would your code return for <code className="rounded bg-locked-soft px-1 font-mono text-[12px]">over_summary([])</code>?
      </p>
      <div className="mt-2 h-8 rounded-md border border-line-strong px-2 py-1.5 text-[12px] text-ink-3">(0, 0), because the loop never runs…</div>
    </div>
  );
}

function ReportSketch() {
  return (
    <div aria-hidden className="space-y-2 rounded-lg border border-line bg-surface p-3 shadow-sm">
      {[
        { name: "Ayesha", viva: 83, good: true },
        { name: "Bilal", viva: 20, good: false },
      ].map((s) => (
        <div key={s.name}>
          <div className="mb-1 flex items-center justify-between text-[12px]">
            <span className="font-semibold text-ink-2">{s.name}</span>
            <span className={cx("rounded-full px-2 py-0.5 font-semibold", s.good ? "bg-done-soft text-done" : "bg-attention-soft text-attention")}>Viva {s.viva}</span>
          </div>
          <div className="relative h-5">
            <div className="absolute inset-x-0 top-2 h-1.5 rounded-full bg-locked-soft" />
            {s.good ? (
              <>
                <span className="absolute top-1 left-[18%] size-3.5 rounded-full border-2 border-surface bg-danger" />
                <span className="absolute top-1 left-[40%] size-3.5 rounded-full border-2 border-surface bg-danger" />
                <span className="absolute top-1 left-[63%] size-3.5 rounded-full border-2 border-surface bg-done" />
                <span className="absolute top-1 left-[92%] size-3.5 rounded-full border-2 border-surface bg-ink" />
              </>
            ) : (
              <>
                <span className="absolute top-0.5 left-[8%] flex h-4 w-[38%] items-center justify-center rounded bg-locked/25"><EyeOff className="size-3 text-ink-2" /></span>
                <span className="absolute top-1 left-[52%] size-3.5 rounded-full border-2 border-surface bg-attention" />
                <span className="absolute top-1 left-[92%] size-3.5 rounded-full border-2 border-surface bg-ink" />
              </>
            )}
          </div>
        </div>
      ))}
      <p className="flex items-center gap-1.5 rounded-md bg-attention-soft px-2 py-1 text-[11.5px] text-ink">
        <Flag className="size-3 shrink-0 text-attention" /> Left the page for 3 min, then typed 220 characters in a minute.
      </p>
    </div>
  );
}

const STEPS = [
  { title: "Students do the work here", body: "Code runs in the browser. Every edit, run and error is recorded, so the teacher can see how the answer grew.", visual: <EditorSketch /> },
  { title: "Ustaad asks about their own work", body: "A short timed viva, with questions generated from each student's own code or answer. Paste is off.", visual: <VivaSketch /> },
  { title: "Teachers see process and understanding", body: "A replay of how the work was made, flags in plain words, and a viva score. The teacher decides.", visual: <ReportSketch /> },
];

/* ------------------------------------------------------------------ content */

const NAV = [
  { href: "#product", label: "Product" },
  { href: "#ustaad", label: "Ustaad AI" },
  { href: "#how", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

const OLD_WAY = ["WhatsApp groups", "Emailed PDFs", "Google Forms quizzes", "Excel mark sheets", "Copy-paste checkers"];

const FEATURES = [
  { icon: Presentation, title: "Lectures as slides", body: "Each week's material as slides and notes, with the work set for it." },
  { icon: Code2, title: "Coding labs", body: "Python, JavaScript and HTML run in the browser. Nothing to install." },
  { icon: PenLine, title: "Written answers", body: "Short answers and essays typed in the platform, with paste off and a live word count." },
  { icon: ListChecks, title: "Timed quizzes", body: "One question at a time, a different paper for every student." },
  { icon: MessageCircleQuestion, title: "Ustaad, the AI tutor", body: "Explains lectures, gives hints in labs, never writes the answer." },
  { icon: Mic, title: "Viva on every submission", body: "Short questions about the student's own work, scored for the teacher." },
  { icon: Table2, title: "Marks and gradebook", body: "Suggested marks, the teacher confirms, CSV export for records." },
  { icon: Megaphone, title: "Announcements and to-dos", body: "News and deadlines from every course on one home page." },
];

const TOUR = {
  students: {
    label: "For students",
    icon: GraduationCap,
    title: "Know what's due, and actually understand it",
    points: [
      "One home page: every deadline by date, and news from every course.",
      "Each course in its own space: lectures, assignments, quizzes and marks.",
      "Ustaad explains any slide in English or Roman Urdu, and makes practice questions.",
      "Marks come with the teacher's comment, so students know what to fix.",
    ],
    shot: { src: "/screens/course-assignments.webp", alt: "A course page for Programming Fundamentals: assignments grouped into to do, handed in and closed" },
  },
  teachers: {
    label: "For teachers",
    icon: Presentation,
    title: "Set work in minutes, and trust the marks",
    points: [
      "Create a lab, written task or quiz with rules: paste off, viva length, a different version for each student.",
      "Hidden tests and the viva suggest a mark. You confirm it with one click.",
      "See how each answer was made: a replay, plain-language flags and the viva transcript.",
      "Post announcements; export the gradebook as CSV.",
    ],
    shot: { src: "/screens/teacher-report.webp", alt: "A teacher's report on one submission: tests, viva score, flags in plain words and a timeline" },
  },
  institutions: {
    label: "For institutions",
    icon: Building2,
    title: "Fundamentals you can stand behind",
    points: [
      "Graduates who can explain their own work, in an age when AI can write it.",
      "Fair by design: no webcam, no AI-text detector, no automatic penalties.",
      "Works on a phone over 4G and on lab computers. Nothing to install.",
      "Records of how work was made, ready for an academic integrity committee.",
    ],
    shot: { src: "/screens/teacher-submissions.webp", alt: "A teacher's list of submissions for one assignment, with viva scores and flags" },
  },
} as const;
type TourKey = keyof typeof TOUR;

const USTAAD = [
  { icon: BookOpen, title: "Tutor on every lecture", body: "Explain this slide, give a real-life example, summarise the week. It knows the course material." },
  { icon: Sparkles, title: "Practice questions", body: "\"Quiz me\" makes fresh questions from the lecture, with explanations. Never marked." },
  { icon: MessageCircleQuestion, title: "Hints, not answers", body: "Inside a lab it asks the next good question. It never writes the student's code." },
  { icon: Mic, title: "Viva on their own work", body: "After submitting, a short timed viva about the student's own code or answer." },
];

const PLANS = [
  {
    name: "Pilot",
    price: "Free",
    per: "for one semester",
    body: "Try it with real classes before deciding anything.",
    points: ["Up to 3 courses", "Every feature, including Ustaad and the viva", "We help set up your first course", "A short training session for your teachers"],
    cta: "Book a pilot",
    featured: true,
  },
  {
    name: "Department",
    price: "Per student",
    per: "per semester",
    body: "For a department that runs its courses on Socratic AI.",
    points: ["Unlimited courses and teachers", "All labs, quizzes, vivas and the AI tutor", "Gradebook exports for your records", "Priority support"],
    cta: "Talk to us",
  },
  {
    name: "Institution",
    price: "Custom",
    per: "for the whole campus",
    body: "For universities and colleges rolling out across departments.",
    points: ["Every department on one platform", "Onboarding for each department", "A named contact for your team", "Connection to your LMS (on our roadmap)"],
    cta: "Talk to us",
  },
];

const FAQ = [
  { q: "Does Socratic AI detect AI-written work?", a: "No, on purpose. AI-text detectors are unreliable and punish honest students. Instead, the platform records how the work was made and Ustaad asks the student about it in a short viva. Understanding is what earns the marks." },
  { q: "Will Ustaad just give students the answers?", a: "No. In graded work Ustaad gives hints and asks questions; it never writes the student's code or answer. On lectures it explains concepts freely, because that's studying, not marking. During a timed quiz it's switched off." },
  { q: "Is there a webcam or microphone?", a: "No. Nothing watches the student. The teacher sees the work itself: edits, runs, time away from the page and the viva answers." },
  { q: "Does it work on phones?", a: "Yes. Students can read lectures, take quizzes, write answers and chat with Ustaad on a phone. Coding labs work best on a laptop or lab computer, with nothing to install." },
  { q: "Who decides the final mark?", a: "Always the teacher. The platform suggests a mark from hidden tests and the viva, and flags things worth a look in plain words. Flags are evidence, never verdicts." },
  { q: "What does it cost?", a: "A pilot is free for one semester. After that, pricing is per student per semester, set with each department. Tell us about your institution and we'll send a quote." },
  { q: "Can we try it right now?", a: "Yes. \"Try as student\" or \"Try as teacher\" opens the platform in a couple of seconds, with courses, lectures, labs, quizzes and marks already set up." },
];

const ROLES = [
  { value: "teacher", label: "Teacher" },
  { value: "head_of_department", label: "Head of department" },
  { value: "administrator", label: "Administrator" },
  { value: "student", label: "Student" },
  { value: "other", label: "Other" },
];
const SIZES = [
  { value: "", label: "Not sure yet" },
  { value: "under_100", label: "Under 100 students" },
  { value: "100_500", label: "100 to 500 students" },
  { value: "500_2000", label: "500 to 2,000 students" },
  { value: "over_2000", label: "Over 2,000 students" },
];

/* ------------------------------------------------------------------ the pilot form */

function PilotForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const val = (k: string) => String(f.get(k) ?? "").trim();
    setState("sending");
    setError(null);
    try {
      await api("/pilot-requests", {
        body: {
          name: val("name"),
          email: val("email"),
          phone: val("phone") || undefined,
          institution: val("institution"),
          role: val("role"),
          students: val("students") || null,
          message: val("message") || undefined,
          website: val("website") || undefined,
        },
      });
      setState("sent");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send your request. Please try again.");
      setState("idle");
    }
  };

  if (state === "sent") {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-done-line bg-surface p-8 text-center shadow-sm" role="status">
        <CheckCircle2 className="size-12 text-done" aria-hidden />
        <h3 className="mt-3 text-xl font-bold">Thank you. We'll be in touch.</h3>
        <p className="mt-2 max-w-sm text-ink-2">We'll email you within two working days to plan your pilot. Meanwhile, try the platform as a teacher or a student.</p>
      </div>
    );
  }

  const input = "mt-1 block min-h-11 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-[15px] focus:border-action focus:outline-none";
  return (
    <form onSubmit={submit} className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8" noValidate={false}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-ink-2">
          Your name
          <input name="name" required minLength={2} maxLength={120} autoComplete="name" className={input} />
        </label>
        <label className="block text-sm font-medium text-ink-2">
          Work email
          <input name="email" type="email" required maxLength={200} autoComplete="email" className={input} />
        </label>
        <label className="block text-sm font-medium text-ink-2 sm:col-span-2">
          Institution
          <input name="institution" required minLength={2} maxLength={200} autoComplete="organization" placeholder="University, college or department" className={input} />
        </label>
        <label className="block text-sm font-medium text-ink-2">
          Your role
          <select name="role" required defaultValue="teacher" className={input}>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-ink-2">
          Size
          <select name="students" defaultValue="" className={input}>
            {SIZES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-ink-2 sm:col-span-2">
          Phone or WhatsApp <span className="font-normal text-ink-3">(optional)</span>
          <input name="phone" type="tel" maxLength={40} autoComplete="tel" className={input} />
        </label>
        <label className="block text-sm font-medium text-ink-2 sm:col-span-2">
          Which courses would you like to try? <span className="font-normal text-ink-3">(optional)</span>
          <textarea name="message" rows={3} maxLength={2000} className={cx(input, "resize-y")} placeholder="e.g. Programming Fundamentals and Data Structures, about 120 students" />
        </label>
        {/* Honeypot for bots; hidden from people and screen readers. */}
        <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] size-px opacity-0" />
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      <button type="submit" disabled={state === "sending"} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-action px-5 text-base font-semibold text-white shadow-sm hover:bg-action-hover disabled:opacity-70">
        {state === "sending" ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
        {state === "sending" ? "Sending…" : "Request a free pilot"}
        {state !== "sending" && <ArrowRight className="size-5" aria-hidden />}
      </button>
      <p className="mt-3 text-center text-xs text-ink-3">We only use these details to contact you about a pilot.</p>
    </form>
  );
}

/* ------------------------------------------------------------------ the page */

export function Landing() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [starting, setStarting] = useState<"teacher" | "student" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tour, setTour] = useState<TourKey>("students");
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    document.title = "Socratic AI: Strong Fundamentals in the Age of AI";
    prewarmApi(); // the serverless API is awake before the first click
    preloadRunnerWhenIdle(); // Python starts downloading quietly in the background
  }, []);

  const start = async (role: "teacher" | "student") => {
    setStarting(role);
    setError(null);
    try {
      const r = await api<StartResponse>("/demo/start", { body: { role } });
      navigate(r.home);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't open Socratic AI. Please try again.");
      setStarting(null);
    }
  };

  const DemoButtons = ({ center }: { center?: boolean }) => (
    <div className={cx("flex flex-col gap-3 sm:flex-row", center && "sm:justify-center")}>
      {(
        [
          { role: "student", icon: GraduationCap, label: "Try as student" },
          { role: "teacher", icon: Presentation, label: "Try as teacher" },
        ] as const
      ).map((b) => (
        <button
          key={b.role}
          type="button"
          onClick={() => start(b.role)}
          disabled={starting !== null}
          aria-busy={starting === b.role || undefined}
          className={cx(
            "group inline-flex min-h-13 items-center justify-center gap-2.5 rounded-xl px-6 py-3 text-base font-semibold whitespace-nowrap shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-wait",
            b.role === "student" ? "bg-action text-white hover:bg-action-hover" : "border-2 border-action bg-surface text-action hover:bg-action-soft",
          )}
        >
          {starting === b.role ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <b.icon className="size-5" aria-hidden />}
          {starting === b.role ? "Opening…" : b.label}
          {starting !== b.role && <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />}
        </button>
      ))}
    </div>
  );

  const t = TOUR[tour];

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {/* ---------------- navigation */}
      <header className="sticky top-0 z-40 border-b border-line/70 bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <a href="/" aria-label="Socratic AI home"><Logo /></a>
          <nav aria-label="Site" className="hidden flex-1 lg:block">
            <ul className="flex items-center gap-1">
              {NAV.map((n) => (
                <li key={n.href}><a href={n.href} className="rounded-lg px-3 py-2 text-[15px] font-medium text-ink-2 hover:bg-canvas hover:text-ink">{n.label}</a></li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <a href="/signin" className="hidden min-h-10 items-center rounded-lg px-3 text-[15px] font-semibold text-ink-2 hover:text-ink sm:inline-flex">Sign in</a>
            <a href="#pilot" className="inline-flex min-h-10 items-center rounded-lg bg-ink px-4 text-[15px] font-semibold text-white hover:bg-ink-2">Book a pilot</a>
            <button type="button" onClick={() => setMenu(!menu)} className="flex size-10 items-center justify-center rounded-lg hover:bg-canvas lg:hidden" aria-label={menu ? "Close menu" : "Open menu"} aria-expanded={menu}>
              {menu ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            </button>
          </div>
        </div>
        {menu && (
          <nav aria-label="Site" className="border-t border-line bg-surface px-4 py-2 lg:hidden">
            <ul>
              {[...NAV, { href: "/signin", label: "Sign in" }].map((n) => (
                <li key={n.href}><a href={n.href} onClick={() => setMenu(false)} className="flex min-h-11 items-center text-[15px] font-medium text-ink-2">{n.label}</a></li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      <main>
        {/* ---------------- hero */}
        <section className="relative overflow-hidden border-b border-line bg-surface">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pt-12 pb-16 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:pt-20 lg:pb-24">
            <div>
              {params.get("ended") && (
                <p role="status" className="mb-6 rounded-lg border border-attention-line bg-attention-soft px-4 py-3 text-attention">
                  Your session ended. Open a new one below.
                </p>
              )}
              <p className="text-[15px] font-semibold text-action">Strong fundamentals in the age of AI</p>
              <h1 className="mt-4 text-4xl leading-[1.08] font-bold tracking-tight text-balance sm:text-5xl xl:text-6xl">
                Everything a course needs, in one place.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-ink-2 text-pretty sm:text-xl">
                Lectures, coding labs, assignments, quizzes and marks for Pakistani universities and colleges, with <strong className="text-ink">Ustaad</strong>, an AI tutor that helps students learn and makes sure every mark reflects real understanding.
              </p>
              <div className="mt-8"><DemoButtons /></div>
              {error && <p role="alert" className="mt-4 max-w-xl rounded-lg border border-danger-line bg-danger-soft px-4 py-3 text-danger">{error}</p>}
            </div>
            <div className="relative">
              <BrowserFrame src="/screens/student-home.webp" alt="Socratic AI student home: to-dos by date, notifications from every course, and every course one click away in the sidebar" eager />
            </div>
          </div>
        </section>

        {/* ---------------- the problem */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 py-10 sm:px-6 lg:flex-row lg:justify-between">
            <p className="max-w-sm text-center text-lg font-semibold text-balance lg:text-left">One platform instead of the five tools every course juggles today.</p>
            <ul className="flex flex-wrap justify-center gap-2">
              {OLD_WAY.map((x) => (
                <li key={x} className="rounded-full border border-line bg-canvas px-3.5 py-1.5 text-sm font-medium text-ink-3 line-through decoration-danger/70 decoration-2">{x}</li>
              ))}
              <li className="flex items-center gap-1.5 rounded-full bg-action px-3.5 py-1.5 text-sm font-semibold text-white"><ArrowRight className="size-4" aria-hidden /> Socratic AI</li>
            </ul>
          </div>
        </section>

        {/* ---------------- product tour */}
        <section id="product" className="scroll-mt-20 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionHead eyebrow="The platform" title="Built for the way Pakistani classrooms really work" body="Students see what's due and get help when they're stuck. Teachers set work in minutes and see who really understood." />
            <div role="tablist" aria-label="Who it's for" className="mx-auto mt-10 flex w-fit flex-wrap justify-center gap-1 rounded-xl border border-line bg-surface p-1">
              {(Object.keys(TOUR) as TourKey[]).map((k) => {
                const T = TOUR[k];
                return (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={tour === k}
                    aria-controls="tour-panel"
                    onClick={() => setTour(k)}
                    className={cx("inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-[15px] font-semibold transition-colors", tour === k ? "bg-action text-white shadow-sm" : "text-ink-2 hover:bg-canvas")}
                  >
                    <T.icon className="size-4" aria-hidden /> {T.label}
                  </button>
                );
              })}
            </div>
            <div id="tour-panel" role="tabpanel" className="mt-10 grid items-center gap-10 lg:grid-cols-[1fr_1.4fr]">
              <div>
                <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.title}</h3>
                <ul className="mt-6 space-y-4">
                  {t.points.map((p) => (
                    <li key={p} className="flex gap-3 text-[17px] text-ink-2">
                      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-done-soft text-done"><Check className="size-4" aria-hidden /></span>
                      {p}
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => start(tour === "students" ? "student" : "teacher")} disabled={starting !== null} className="mt-8 inline-flex min-h-11 items-center gap-2 font-semibold text-action hover:underline">
                  {tour === "students" ? "See the student side" : "See the teacher side"} <ArrowRight className="size-4" aria-hidden />
                </button>
              </div>
              <BrowserFrame key={t.shot.src} src={t.shot.src} alt={t.shot.alt} />
            </div>

            <div className="mt-24 border-t border-line pt-12">
              <h3 className="text-xl font-bold tracking-tight">Everything a semester needs</h3>
              <ul className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
                {FEATURES.map((f) => (
                  <li key={f.title}>
                    <p className="flex items-center gap-2 font-semibold"><f.icon className="size-5 text-ink-3" aria-hidden /> {f.title}</p>
                    <p className="mt-1.5 text-[15px] text-ink-2">{f.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ---------------- Ustaad */}
        <section id="ustaad" className="scroll-mt-16 bg-[#0b1530] py-20 text-white sm:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <Eyebrow className="!text-[#93c5fd]">Meet Ustaad</Eyebrow>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-balance sm:text-4xl">An AI tutor that teaches, not one that does the homework.</h2>
              <p className="mt-4 text-lg text-white/75">Ustaad ("teacher" in Urdu) helps students wherever they study, in the language they think in. In graded work it asks questions instead of giving answers, and afterwards it checks that the student really understood.</p>
              <ul className="mt-8 grid gap-5 sm:grid-cols-2">
                {USTAAD.map((u) => (
                  <li key={u.title} className="border-l-2 border-white/15 pl-4">
                    <span className="block font-semibold">{u.title}</span>
                    <span className="mt-1 block text-[15px] text-white/70">{u.body}</span>
                  </li>
                ))}
              </ul>
            </div>
            <BrowserFrame src="/screens/lecture-ustaad.webp" alt="A lecture on Functions with the Study with Ustaad chat beside the slides, answering with a real-life example" className="border-white/10" />
          </div>
        </section>

        {/* ---------------- how marks stay meaningful */}
        <section id="how" className="scroll-mt-20 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionHead eyebrow="How it works" title="Marks that mean the student really understood" body="AI can write an assignment in seconds. So Socratic AI looks at how the work was made, and asks the student about it." />
            <ol className="mt-12 grid gap-5 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-sm">
                  <div className="mb-5">{s.visual}</div>
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-full bg-action text-sm font-bold text-white">{i + 1}</span>
                    <h3 className="text-lg font-semibold">{s.title}</h3>
                  </div>
                  <p className="mt-2 text-ink-2">{s.body}</p>
                </li>
              ))}
            </ol>
            <ul className="mx-auto mt-10 flex max-w-4xl flex-wrap justify-center gap-x-8 gap-y-3 text-[15px] font-medium text-ink-2">
              <li className="flex items-center gap-1.5"><ShieldCheck className="size-5 text-done" aria-hidden /> No AI-text detector</li>
              <li className="flex items-center gap-1.5"><ShieldCheck className="size-5 text-done" aria-hidden /> No webcam or microphone</li>
              <li className="flex items-center gap-1.5"><Flag className="size-5 text-attention" aria-hidden /> Flags are evidence, never verdicts</li>
              <li className="flex items-center gap-1.5"><Smartphone className="size-5 text-action" aria-hidden /> Works over mobile data</li>
            </ul>
          </div>
        </section>

        {/* ---------------- pricing */}
        <section id="pricing" className="scroll-mt-16 border-t border-line bg-surface py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionHead eyebrow="Pricing" title="Start with a free pilot" body="Try Socratic AI with real classes for a semester. Decide after you've seen it work." />
            <ul className="mt-12 grid gap-6 lg:grid-cols-3">
              {PLANS.map((p) => (
                <li key={p.name} className={cx("relative flex flex-col rounded-2xl border p-6 sm:p-8", p.featured ? "border-action bg-surface shadow-[0_20px_50px_-20px_rgba(29,78,216,0.45)] ring-1 ring-action" : "border-line bg-canvas")}>
                  {p.featured && <span className="absolute -top-3 left-6 rounded-full bg-action px-3 py-1 text-xs font-semibold text-white">Start here</span>}
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                  <p className="mt-3 flex items-baseline gap-2"><span className="text-3xl font-bold tracking-tight">{p.price}</span><span className="text-ink-3">{p.per}</span></p>
                  <p className="mt-2 text-ink-2">{p.body}</p>
                  <ul className="mt-6 flex-1 space-y-3">
                    {p.points.map((x) => (
                      <li key={x} className="flex gap-2.5 text-[15px] text-ink-2"><Check className="mt-0.5 size-4 shrink-0 text-done" aria-hidden /> {x}</li>
                    ))}
                  </ul>
                  <a href="#pilot" className={cx("mt-8 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 font-semibold", p.featured ? "bg-action text-white hover:bg-action-hover" : "border border-line-strong bg-surface hover:border-action hover:text-action")}>
                    {p.cta} <ArrowRight className="size-4" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------------- FAQ */}
        <section id="faq" className="scroll-mt-16 py-20 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <SectionHead eyebrow="Questions" title="What teachers and heads of department ask us" />
            <div className="mt-10 divide-y divide-line rounded-2xl border border-line bg-surface">
              {FAQ.map((f) => (
                <details key={f.q} className="group px-5 py-1 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[17px] font-semibold">
                    {f.q}
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-canvas text-ink-3 transition-transform group-open:rotate-45" aria-hidden>+</span>
                  </summary>
                  <p className="pb-5 text-ink-2">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- pilot request */}
        <section id="pilot" className="scroll-mt-16 border-t border-line bg-canvas py-20 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2">
            <div>
              <Eyebrow>Bring it to your class</Eyebrow>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl">Run a free pilot next semester</h2>
              <p className="mt-4 text-lg text-ink-2">Tell us about your institution. We'll set up your first courses with you and train your teachers.</p>
              <ol className="mt-8 space-y-5">
                {[
                  { t: "We talk", b: "A short call to understand your courses and students." },
                  { t: "We set up together", b: "Your courses, lecture material and first assignments, ready before the semester starts." },
                  { t: "Your classes use it", b: "Teachers and students use Socratic AI for real work, and you see the difference in the marks." },
                ].map((s, i) => (
                  <li key={s.t} className="flex gap-4">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-action font-bold text-white">{i + 1}</span>
                    <span>
                      <span className="block font-semibold">{s.t}</span>
                      <span className="block text-ink-2">{s.b}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <div className="mt-10 rounded-2xl border border-line bg-surface p-5">
                <p className="font-semibold">Want to look around first?</p>
                <p className="mt-1 text-[15px] text-ink-2">See the student and teacher sides, with courses, lectures, labs, quizzes and marks already set up.</p>
                <div className="mt-4"><DemoButtons /></div>
              </div>
            </div>
            <PilotForm />
          </div>
        </section>
      </main>

      {/* ---------------- footer */}
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-3 max-w-sm text-[15px] text-ink-2">Strong fundamentals in the age of AI. One organized learning platform for students and teachers in Pakistan.</p>
          </div>
          <div>
            <p className="font-semibold">Product</p>
            <ul className="mt-3 space-y-2 text-[15px] text-ink-2">
              {NAV.map((n) => <li key={n.href}><a href={n.href} className="hover:text-action">{n.label}</a></li>)}
            </ul>
          </div>
          <div>
            <p className="font-semibold">Get started</p>
            <ul className="mt-3 space-y-2 text-[15px] text-ink-2">
              <li><a href="#pilot" className="hover:text-action">Book a free pilot</a></li>
              <li><a href="/signin" className="hover:text-action">Sign in or create an account</a></li>
              <li><a href="https://github.com/basit025/socratic-ai" className="hover:text-action">Source code</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-line">
          <p className="mx-auto max-w-7xl px-4 py-5 text-sm text-ink-3 sm:px-6">
            © 2026 Socratic AI. Made in Pakistan.
          </p>
        </div>
      </footer>
    </div>
  );
}
