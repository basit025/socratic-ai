/**
 * The viva: hidden tests first (run here, marked on the server), then one question at a time with a
 * timer ring, progress dots and a big answer box: nothing else on screen. Ends with a clear result.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useParams } from "react-router";
import { ArrowRight, CheckCircle2, ClipboardX, Loader2, Lightbulb, Timer, XCircle } from "lucide-react";
import { Button, Card, Chip, ErrorState, FullPageLoading, cx } from "../components/ui";
import { BackToCourse } from "../components/BackToCourse";
import { Appear } from "../components/Motion";
import { api, ApiError } from "../lib/api";
import { runner, useRunnerStatus } from "../runner/runner";
import { runnerFor } from "../runner/jsRunner";

interface Current {
  index: number;
  kind: string;
  prompt: string;
  secondsAllowed: number;
  secondsLeft: number;
  needsGroundTruth: boolean;
  call: string | null;
}

interface VivaState {
  submissionId: string;
  title: string;
  status: "not_started" | "in_progress" | "completed";
  total: number;
  secondsPerQ: number;
  vivaWeight: number;
  marks: number;
  testsPending: boolean;
  testCalls: string[];
  code: string;
  language: string | null;
  tests: { passed: number; total: number; results: { name: string; passed: boolean }[] } | null;
  current?: Current;
  result?: { vivaScore: number | null; grade: number | null; confirmedByTeacher?: boolean; teacherComment?: string | null; reviseNext: string | null; questions: { prompt: string; answer: string; score: number | null; feedback: string | null; late: boolean }[] };
}

/** Renders `code` spans inside a sentence. */
function InlineCode({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/g).map((p, i) =>
        p.startsWith("`") && p.endsWith("`") && p.length > 2 ? (
          <code key={i} className="rounded bg-locked-soft px-1.5 py-0.5 font-mono text-[0.88em]">
            {p.slice(1, -1)}
          </code>
        ) : (
          p
        ),
      )}
    </>
  );
}

function TimerRing({ secondsLeft, total }: { secondsLeft: number; total: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, secondsLeft / total));
  const low = secondsLeft <= 15;
  return (
    <div className="relative size-16" role="timer" aria-label={`${secondsLeft} seconds left`}>
      <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--color-locked-line)" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={low ? "var(--color-attention)" : "var(--color-action)"} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} className="transition-[stroke-dashoffset] duration-1000 ease-linear" />
      </svg>
      <span className={cx("absolute inset-0 flex items-center justify-center text-lg font-bold tabular-nums", low ? "text-attention" : "text-ink")}>{secondsLeft}</span>
    </div>
  );
}

function VivaFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-8">
      <div className="sticky top-16 z-20 -mx-4 mb-5 flex h-14 items-center border-b border-line bg-canvas/95 px-4 backdrop-blur">
        <span className="truncate text-sm font-semibold text-ink-2">Viva · {title}</span>
      </div>
      {children}
    </main>
  );
}

export function Viva() {
  const { id = "" } = useParams();
  const [state, setState] = useState<VivaState | null>(null);
  const [course, setCourse] = useState<{ id: string; code: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"loading" | "tests" | "ready" | "asking" | "thinking">("loading");
  const [answer, setAnswer] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [pasteNote, setPasteNote] = useState(false);
  const awayMs = useRef(0);
  const awaySince = useRef<number | null>(null);
  const submitting = useRef(false);
  const runnerStatus = useRunnerStatus();
  const [switching, setSwitching] = useState(false);

  const seeTeacherView = async () => {
    if (!state) return;
    setSwitching(true);
    try {
      await api("/demo/switch", { body: {} });
      window.location.assign(`/teacher/submissions/${state.submissionId}`);
    } catch {
      setSwitching(false);
    }
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      const ws = await api<{ submission: { id: string } | null; assignment: { course: { id: string; code: string; name: string } } }>(`/student/assignments/${id}`);
      setCourse(ws.assignment.course);
      if (!ws.submission) throw new ApiError(404, "Open the assignment first.");
      let v = await api<VivaState>(`/submissions/${ws.submission.id}/viva`);
      if (v.testsPending) {
        setState(v);
        setPhase("tests");
        if (v.language !== "javascript") await runner.preload();
        const out = await runnerFor(v.language).runTests(v.code, v.testCalls);
        const results = v.testCalls.map((call) => out.results.find((r) => r.call === call) ?? { call, ok: false, error: out.error ?? "Didn't run" });
        await api(`/submissions/${v.submissionId}/tests`, { body: { results } });
        v = await api<VivaState>(`/submissions/${ws.submission.id}/viva`);
      }
      setState(v);
      if (v.status === "in_progress" && v.current) {
        setSecondsLeft(v.current.secondsLeft);
        setPhase("asking");
      } else setPhase("ready");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load the viva.");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    document.title = `Viva${state ? ` · ${state.title}` : ""} · Socratic AI`;
  }, [state]);

  // Leaving the page during a question is measured and sent with the answer.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") awaySince.current = Date.now();
      else if (awaySince.current != null) {
        awayMs.current += Date.now() - awaySince.current;
        awaySince.current = null;
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const sendAnswer = useCallback(
    async (text: string) => {
      if (!state?.current || submitting.current) return;
      submitting.current = true;
      setPhase("thinking");
      const q = state.current;
      try {
        let groundTruth: unknown;
        if (q.needsGroundTruth && q.call) {
          // Run the student's own submitted code on the question's input, AFTER they've answered.
          const out = await runnerFor(state.language).runTests(state.code, [q.call]);
          groundTruth = out.results[0] ?? { call: q.call, ok: false, error: out.error ?? "Didn't run" };
        }
        const r = await api<{ current?: Current; done?: boolean }>(`/submissions/${state.submissionId}/viva/answer`, { body: { index: q.index, answer: text, awayMs: awayMs.current, groundTruth } });
        awayMs.current = 0;
        setAnswer("");
        if (r.current) {
          setState({ ...state, status: "in_progress", current: r.current });
          setSecondsLeft(r.current.secondsLeft);
          setPhase("asking");
        } else {
          await load();
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't send your answer. Check your connection.");
        setPhase("asking");
      } finally {
        submitting.current = false;
      }
    },
    [state, load],
  );

  // Countdown; at zero the current text is submitted automatically.
  useEffect(() => {
    if (phase !== "asking") return;
    if (secondsLeft <= 0) {
      void sendAnswer(answer);
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, secondsLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    if (!state) return;
    setPhase("thinking");
    try {
      const r = await api<{ current: Current }>(`/submissions/${state.submissionId}/viva/start`, { body: {} });
      awayMs.current = 0;
      setState({ ...state, status: "in_progress", current: r.current });
      setSecondsLeft(r.current.secondsLeft);
      setPhase("asking");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start the viva.");
      setPhase("ready");
    }
  };

  if (error && !state) return <VivaFrame title="Viva"><ErrorState message={error} onRetry={load} /></VivaFrame>;
  if (!state || phase === "loading") return <FullPageLoading label="Opening your viva…" />;

  // ------------------------------------------------ running the hidden tests
  if (phase === "tests")
    return (
      <VivaFrame title={state.title}>
        <Card className="flex flex-col items-center p-10 text-center">
          <Loader2 className="size-8 animate-spin text-action" aria-hidden />
          <p className="mt-4 text-lg font-semibold">Checking your code against the hidden tests…</p>
          <p className="mt-1 text-ink-3">{runnerStatus === "ready" ? "This takes a second." : "Preparing the code runner first."}</p>
        </Card>
      </VivaFrame>
    );

  // ------------------------------------------------ results (closure)
  if (state.status === "completed") {
    const r = state.result;
    return (
      <VivaFrame title={state.title}>
        <Card className="border-done-line bg-done-soft p-6 text-center">
          <CheckCircle2 className="mx-auto size-10 text-done" aria-hidden />
          <h1 className="mt-2 text-2xl font-bold">Submitted. Well done for finishing your viva.</h1>
          <p className="mt-1 text-ink-2">Your teacher will review your work and the viva, and confirm your marks.</p>
        </Card>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Card className="p-4 text-center">
            <p className="text-sm text-ink-3">Viva score</p>
            <p className="text-2xl font-bold">{r?.vivaScore != null ? `${r.vivaScore}/100` : "Teacher will mark"}</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-sm text-ink-3">Hidden tests</p>
            <p className="text-2xl font-bold">{state.tests ? `${state.tests.passed}/${state.tests.total} passed` : "Not run"}</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-sm text-ink-3">{r?.confirmedByTeacher ? "Mark from your teacher" : "Suggested mark"}</p>
            <p className="text-2xl font-bold">{r?.grade != null ? `${r.grade}/${state.marks}` : "Pending"}</p>
          </Card>
        </div>
        {r?.teacherComment && (
          <Card className="mt-5 border-action-line bg-action-soft p-4">
            <p className="text-sm font-semibold text-action">From your teacher</p>
            <p className="mt-1">{r.teacherComment}</p>
          </Card>
        )}
        {r?.reviseNext && (
          <Card className="mt-5 flex gap-3 p-4">
            <Lightbulb className="mt-0.5 size-5 shrink-0 text-attention" aria-hidden />
            <p>
              <strong>What to revise next:</strong> {r.reviseNext}
            </p>
          </Card>
        )}
        {r && r.questions.length > 0 && (
          <Card className="mt-5">
            <h2 className="border-b border-line px-5 py-3 font-semibold">Your viva</h2>
            <ol className="divide-y divide-line">
              {r.questions.map((q, i) => (
                <li key={i} className="px-5 py-4">
                  <p className="font-medium">
                    {i + 1}. <InlineCode text={q.prompt} />
                  </p>
                  <p className="mt-1 text-ink-2">
                    <span className="text-ink-3">Your answer: </span>
                    {q.answer || <em>No answer in time</em>}
                  </p>
                  {q.feedback && <p className="mt-1 text-sm text-ink-3">{q.feedback}</p>}
                </li>
              ))}
            </ol>
          </Card>
        )}
        {state.tests && (
          <Card className="mt-5 p-5">
            <h2 className="font-semibold">Hidden tests</h2>
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {state.tests.results.map((t) => (
                <li key={t.name} className="flex items-center gap-2 text-sm">
                  {t.passed ? <CheckCircle2 className="size-4 text-done" aria-label="Passed" /> : <XCircle className="size-4 text-danger" aria-label="Failed" />}
                  {t.name}
                </li>
              ))}
            </ul>
          </Card>
        )}
        <Card className="mt-6 flex flex-wrap items-center justify-between gap-3 border-action-line bg-action-soft p-5">
          <p className="max-w-md">
            <span className="block font-semibold">Trying the demo? See what your teacher sees.</span>
            <span className="text-sm text-ink-2">Your own work, as an integrity report: the replay of how you wrote it, any flags, and this viva.</span>
          </p>
          <Button icon={ArrowRight} onClick={seeTeacherView} loading={switching}>
            See what your teacher sees
          </Button>
        </Card>
        <BackToCourse course={course} tab="assignments" className="mt-4" />
      </VivaFrame>
    );
  }

  // ------------------------------------------------ before the first question
  if (state.status === "not_started" || !state.current) {
    return (
      <VivaFrame title={state.title}>
        <Card className="p-6 sm:p-8">
          <p className="text-sm font-semibold text-action">Your work is submitted. Last step: the viva.</p>
          <h1 className="mt-1 text-2xl font-bold">Ustaad will ask you about your own code</h1>
          {state.tests && (
            <p className="mt-3">
              <Chip tone={state.tests.passed === state.tests.total ? "done" : "attention"}>
                Hidden tests: {state.tests.passed}/{state.tests.total} passed
              </Chip>
            </p>
          )}
          <ul className="mt-5 space-y-2.5 text-[15px] text-ink-2">
            <li className="flex gap-2.5"><Timer className="mt-0.5 size-5 shrink-0 text-action" aria-hidden /> {state.total} questions, one at a time, {state.secondsPerQ} seconds each. When time runs out, what you've typed is sent.</li>
            <li className="flex gap-2.5"><ClipboardX className="mt-0.5 size-5 shrink-0 text-action" aria-hidden /> Paste is off. Answer in your own words, in English or Roman Urdu: spelling and grammar don't matter.</li>
            <li className="flex gap-2.5"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-action" aria-hidden /> The viva is {state.vivaWeight}% of your marks. It can't be paused once it starts.</li>
          </ul>
          {error && <p role="alert" className="mt-4 text-danger">{error}</p>}
          <Button size="lg" className="mt-6" loading={phase === "thinking"} onClick={start}>
            Start viva: {state.total} questions, about {Math.ceil((state.total * state.secondsPerQ) / 60)} min
          </Button>
          {phase === "thinking" && (
            <p role="status" className="mt-3 text-sm text-ink-3">
              Ustaad is writing your first question from your own code. This takes about 10 seconds; your timer starts when the question appears.
            </p>
          )}
        </Card>
      </VivaFrame>
    );
  }

  // ------------------------------------------------ a question
  const q = state.current;
  const last = q.index + 1 >= state.total;
  return (
    <VivaFrame title={state.title}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2" aria-label={`Question ${q.index + 1} of ${state.total}`}>
          {Array.from({ length: state.total }, (_, i) => (
            <span key={i} className={cx("h-2.5 w-8 rounded-full", i < q.index ? "bg-done" : i === q.index ? "bg-action" : "bg-locked-line")} />
          ))}
          <span className="ml-2 text-sm font-medium text-ink-3">
            Question {q.index + 1} of {state.total}
          </span>
        </div>
        <TimerRing secondsLeft={secondsLeft} total={q.secondsAllowed} />
      </div>

      <Appear key={q.index}>
        <h1 className="mt-6 text-2xl leading-snug font-semibold text-balance">
          <InlineCode text={q.prompt} />
        </h1>
      </Appear>

      <label htmlFor="viva-answer" className="sr-only">
        Your answer
      </label>
      <textarea
        id="viva-answer"
        autoFocus
        value={answer}
        disabled={phase === "thinking"}
        onChange={(e) => setAnswer(e.target.value)}
        onPaste={(e) => {
          e.preventDefault();
          setPasteNote(true);
        }}
        onDrop={(e) => e.preventDefault()}
        rows={6}
        maxLength={2000}
        placeholder="Type your answer in your own words…"
        className="mt-6 w-full rounded-xl border border-line-strong bg-surface p-4 text-lg focus:border-action focus:outline-none"
      />
      {pasteNote && (
        <p role="alert" className="mt-2 text-sm text-attention">
          Paste is off during the viva. Type your answer.
        </p>
      )}
      {error && <p role="alert" className="mt-2 text-danger">{error}</p>}
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-ink-3">{phase === "thinking" ? "Ustaad is reading your answer…" : "Short answers are fine. Explain the idea."}</p>
        <Button size="lg" loading={phase === "thinking"} onClick={() => void sendAnswer(answer)}>
          {last ? "Finish viva" : "Next question"}
        </Button>
      </div>
    </VivaFrame>
  );
}
