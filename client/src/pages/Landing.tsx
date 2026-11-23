import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowRight, Check, ClipboardX, EyeOff, Flag, GraduationCap, Presentation, ShieldCheck } from "lucide-react";
import { api, ApiError, prewarmApi } from "../lib/api";
import { preloadRunnerWhenIdle } from "../runner/runner";
import { Logo } from "../components/Logo";
import { Ur, cx } from "../components/ui";

interface StartResponse {
  home: string;
}

/* ------------------------------------------------------------------ the three-step illustration
 * Small, faithful mock-ups of the real screens (decorative: the captions carry the meaning). */

function EditorSketch() {
  return (
    <div aria-hidden className="rounded-lg border border-line bg-surface p-3 font-mono text-[12.5px] leading-6 shadow-sm">
      <div className="mb-2 flex items-center justify-between text-[11px] font-sans">
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
          <text x="20" y="24.5" textAnchor="middle" className="rotate-90 fill-ink text-[11px] font-bold" transform="rotate(90 20 20)">62</text>
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
  { title: "Ustaad asks about their own work", body: "A short timed viva, with questions generated from each student's own code. Paste is off.", visual: <VivaSketch /> },
  { title: "Teachers see process and understanding", body: "A replay of how the work was made, flags in plain words, and a viva score. The teacher decides.", visual: <ReportSketch /> },
];

export function Landing() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [starting, setStarting] = useState<"teacher" | "student" | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      setError(err instanceof ApiError ? err.message : "Couldn't start the demo. Please try again.");
      setStarting(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(ellipse_at_top,_var(--color-action-soft),_transparent_60%)]">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <a href="https://github.com/basit025/socratic-ai" className="text-sm font-medium text-ink-3 hover:text-ink">
          Source code
        </a>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16">
        {params.get("ended") && (
          <p role="status" className="mx-auto mb-6 max-w-2xl rounded-lg border border-attention-line bg-attention-soft px-4 py-3 text-center text-attention">
            Your demo session ended. Start a new one below: it takes about a second.
          </p>
        )}

        <section className="mx-auto max-w-3xl pt-6 text-center sm:pt-10">
          <p className="text-sm font-semibold tracking-wide text-action uppercase">Strong fundamentals in the age of AI</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-balance sm:text-[52px] sm:leading-[1.1]">Marks for what students understand, not what AI wrote.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-2 text-pretty">
            Socratic AI is a learning platform where students do their work in one workspace and the AI mentor Ustaad runs a short viva on each student's own work.
          </p>
        </section>

        <section aria-label="Try the demo" className="mx-auto mt-9 grid max-w-3xl gap-4 sm:grid-cols-2">
          {(
            [
              { role: "teacher", icon: Presentation, label: "Try as teacher", ur: "بطور استاد آزمائیں", hint: "See a class, set an assignment, read integrity reports" },
              { role: "student", icon: GraduationCap, label: "Try as student", ur: "بطور طالب علم آزمائیں", hint: "Do a coding lab, then face Ustaad's viva" },
            ] as const
          ).map((b) => (
            <button
              key={b.role}
              onClick={() => start(b.role)}
              disabled={starting !== null}
              aria-busy={starting === b.role || undefined}
              className={cx(
                "group flex min-h-28 items-center gap-4 rounded-2xl px-5 py-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-wait",
                b.role === "teacher" ? "bg-action text-white hover:bg-action-hover" : "border-2 border-action bg-surface text-action hover:bg-action-soft",
              )}
            >
              <b.icon className="size-9 shrink-0" aria-hidden />
              <span className="flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2 text-lg font-bold">
                  {starting === b.role ? "Setting up your private demo…" : b.label}
                  {starting !== b.role && <Ur>{b.ur}</Ur>}
                </span>
                <span className={cx("block text-sm", b.role === "teacher" ? "text-white/85" : "text-ink-2")}>{b.hint}</span>
              </span>
              <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden />
            </button>
          ))}
        </section>
        <p className="mt-3 text-center text-sm text-ink-3">Opens your own private copy of a demo institution in about a second. No sign-up.</p>
        <p className="mt-1 text-center text-sm text-ink-3">
          Using Socratic AI with a real class?{" "}
          <a href="/signin" className="font-semibold text-action hover:underline">Sign in or create an account</a>
        </p>
        {error && (
          <p role="alert" className="mx-auto mt-4 max-w-xl rounded-lg border border-danger-line bg-danger-soft px-4 py-3 text-center text-danger">
            {error}
          </p>
        )}

        <section aria-label="How it works" className="mx-auto mt-16 max-w-5xl">
          <h2 className="text-center text-sm font-semibold tracking-wide text-ink-3 uppercase">How it works</h2>
          <ol className="mt-6 grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex flex-col rounded-2xl border border-line bg-surface/80 p-5 shadow-sm backdrop-blur">
                <div className="mb-4">{s.visual}</div>
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-full bg-action text-sm font-bold text-white">{i + 1}</span>
                  <h3 className="text-lg font-semibold">{s.title}</h3>
                </div>
                <p className="mt-2 text-ink-2">{s.body}</p>
              </li>
            ))}
          </ol>
          <ul className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-x-6 gap-y-2 text-[15px] font-medium text-ink-2">
            <li className="flex items-center gap-1.5"><ShieldCheck className="size-4 text-done" aria-hidden /> No AI detector</li>
            <li className="flex items-center gap-1.5"><ShieldCheck className="size-4 text-done" aria-hidden /> No webcam</li>
            <li className="flex items-center gap-1.5"><Check className="size-4 text-done" aria-hidden /> Flags are evidence, never verdicts</li>
            <li className="flex items-center gap-1.5"><Check className="size-4 text-done" aria-hidden /> The teacher makes every decision</li>
          </ul>
        </section>
      </main>

      <footer className="border-t border-line py-6 text-center text-sm text-ink-3">
        Built for the Capital Youth Expo 2026 Hackathon, Track 1: Education. The demo institution, people and work are fictional.
      </footer>
    </div>
  );
}
