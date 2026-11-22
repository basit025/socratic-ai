import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowRight, ClipboardCheck, Code2, GraduationCap, MessageCircleQuestion, Presentation } from "lucide-react";
import { api, ApiError, prewarmApi } from "../lib/api";
import { preloadRunnerWhenIdle } from "../runner/runner";
import { Logo } from "../components/Logo";
import { cx } from "../components/ui";

const STEPS = [
  {
    icon: Code2,
    title: "Students do the work here",
    body: "Code runs right in the browser. The platform records how the answer grew: every edit, run and error.",
  },
  {
    icon: MessageCircleQuestion,
    title: "Ustaad asks about their own work",
    body: "A short, timed viva with questions generated from each student's own code. Paste is off.",
  },
  {
    icon: ClipboardCheck,
    title: "Teachers see the process and the understanding",
    body: "A replay of how the work was made, plain-language flags and a viva score. The teacher decides.",
  },
];

interface StartResponse {
  home: string;
}

export function Landing() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [starting, setStarting] = useState<"teacher" | "student" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Socratic AI: Strong Fundamentals in the Age of AI";
    prewarmApi();               // the serverless API is awake before the first click
    preloadRunnerWhenIdle();    // Python starts downloading quietly in the background
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
    <div className="flex min-h-screen flex-col">
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

        <section className="mx-auto max-w-3xl pt-6 text-center sm:pt-12">
          <p className="text-sm font-semibold tracking-wide text-action uppercase">Strong fundamentals in the age of AI</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Marks for what students understand, not what AI wrote.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-2 text-pretty">
            Socratic AI is a learning platform where students do their work in one workspace and the AI mentor Ustaad runs a short viva on
            each student's own work.
          </p>
        </section>

        <section aria-label="Try the demo" className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
          {(
            [
              { role: "teacher", icon: Presentation, label: "Try as teacher", hint: "See a class, set an assignment, read integrity reports" },
              { role: "student", icon: GraduationCap, label: "Try as student", hint: "Do a coding lab, then face Ustaad's viva" },
            ] as const
          ).map((b) => (
            <button
              key={b.role}
              onClick={() => start(b.role)}
              disabled={starting !== null}
              aria-busy={starting === b.role || undefined}
              className={cx(
                "group flex min-h-24 items-center gap-4 rounded-xl px-5 py-4 text-left transition-colors disabled:cursor-wait",
                b.role === "teacher" ? "bg-action text-white hover:bg-action-hover" : "border-2 border-action bg-surface text-action hover:bg-action-soft",
              )}
            >
              <b.icon className="size-9 shrink-0" aria-hidden />
              <span className="flex-1">
                <span className="block text-lg font-bold">{starting === b.role ? "Setting up your private demo…" : b.label}</span>
                <span className={cx("block text-sm", b.role === "teacher" ? "text-white/85" : "text-ink-2")}>{b.hint}</span>
              </span>
              <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </button>
          ))}
        </section>
        <p className="mt-3 text-center text-sm text-ink-3">Opens your own private copy of a demo institution in about a second. No sign-up.</p>
        {error && (
          <p role="alert" className="mx-auto mt-4 max-w-xl rounded-lg border border-danger-line bg-danger-soft px-4 py-3 text-center text-danger">
            {error}
          </p>
        )}

        <section aria-label="How it works" className="mx-auto mt-16 max-w-5xl">
          <h2 className="text-center text-sm font-semibold tracking-wide text-ink-3 uppercase">How it works</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative rounded-xl border border-line bg-surface p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-action-soft text-action">
                    <s.icon className="size-5" aria-hidden />
                  </span>
                  <span className="text-sm font-semibold text-ink-3">Step {i + 1}</span>
                </div>
                <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                <p className="mt-1 text-ink-2">{s.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-center font-medium text-ink-2">
            No AI detector. No webcam. Flags are evidence, never verdicts: the teacher makes every decision.
          </p>
        </section>
      </main>

      <footer className="border-t border-line py-6 text-center text-sm text-ink-3">
        Built for the Capital Youth Expo 2026 Hackathon, Track 1: Education. The demo institution, people and work are fictional.
      </footer>
    </div>
  );
}
