/**
 * Timed quiz player (FR-13, FR-16). Three screens, one primary action each:
 *   1. Before: what the quiz is, its rules, and exactly what Start does.
 *   2. During: one question, a timer ring, progress, nothing else. Leaving fullscreen shows a warning
 *      and is recorded for the teacher. No going back.
 *   3. After: how many were right and the suggested marks.
 * The clock and marking live on the server; this screen only shows them.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowRight, CheckCircle2, ClipboardX, Clock, Expand, ListChecks, Maximize, Send, ShieldAlert, Timer, XCircle } from "lucide-react";
import { Button, Card, Chip, ErrorState, Spinner, Ur, cx } from "../components/ui";
import { BackToCourse } from "../components/BackToCourse";
import { Appear, Pop } from "../components/Motion";
import { api, ApiError } from "../lib/api";
import { formatDue } from "../lib/format";
import { EventRecorder } from "../workspace/recorder";

interface QuizQuestionView {
  index: number;
  kind: "mcq" | "short";
  prompt: string;
  marks: number;
  options: string[] | null;
}
interface QuizResult {
  correct: number;
  total: number;
  earned: number;
  possible: number;
  grade: number | null;
  questions: { index: number; prompt: string; correct: boolean; answered: boolean; yourAnswer: string | null }[];
}
type QuizView = {
  title: string;
  total: number;
  timeLimitMinutes: number | null;
  fullscreenRequired: boolean;
  marks: number;
} & ({ status: "not_started" } | { status: "in_progress"; secondsLeft: number | null; answered: number; current: QuizQuestionView } | { status: "done"; result: QuizResult; late?: boolean });

export interface QuizAssignment {
  id: string;
  title: string;
  open: boolean;
  dueAt: string | null;
  marks: number;
  course: { id?: string; code: string; name: string };
  instructions: string;
}

/** `code` spans in prompts, nothing else. */
function Prompt({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/g).map((part, i) =>
        part.startsWith("`") ? (
          <code key={i} className="rounded bg-locked-soft px-1.5 py-0.5 font-mono text-[0.92em] text-ink">
            {part.slice(1, -1)}
          </code>
        ) : (
          part
        ),
      )}
    </>
  );
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function QuizTimer({ secondsLeft, total }: { secondsLeft: number; total: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, secondsLeft / total));
  const low = secondsLeft <= 60;
  return (
    <div className="flex items-center gap-3">
      <div className="relative size-12" role="timer" aria-label={`${mmss(secondsLeft)} left`}>
        <svg viewBox="0 0 64 64" className="size-12 -rotate-90" aria-hidden>
          <circle cx="32" cy="32" r={r} fill="none" stroke="var(--color-locked-line)" strokeWidth="6" />
          <circle cx="32" cy="32" r={r} fill="none" stroke={low ? "var(--color-attention)" : "var(--color-action)"} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} className="transition-[stroke-dashoffset] duration-1000 ease-linear" />
        </svg>
        <span className={cx("absolute inset-0 flex items-center justify-center text-[13px] font-bold tabular-nums", low ? "text-attention" : "text-ink")}>{mmss(secondsLeft)}</span>
      </div>
      <span className="hidden text-sm text-ink-3 sm:block">{low ? "Less than a minute left" : "Time left for the whole quiz"}</span>
    </div>
  );
}

function Frame({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  // Inside the platform's frame; the quiz bar stays visible so the timer is always in view.
  return (
    <main className="mx-auto max-w-3xl px-4 pb-8">
      <div className="sticky top-16 z-20 -mx-4 mb-5 flex h-14 items-center justify-between gap-3 border-b border-line bg-canvas/95 px-4 backdrop-blur">
        <span className="truncate text-sm font-semibold text-ink-2">Quiz · {title}</span>
        {right}
      </div>
      {children}
    </main>
  );
}

const canFullscreen = () => typeof document !== "undefined" && Boolean(document.documentElement.requestFullscreen) && document.fullscreenEnabled !== false;

export function QuizPlayer({ assignment, submissionId, nextSeq }: { assignment: QuizAssignment; submissionId: string | null; nextSeq: number }) {
  const [view, setView] = useState<QuizView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [pasteNote, setPasteNote] = useState(false);
  const [leftFullscreen, setLeftFullscreen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const recorder = useRef<EventRecorder | null>(null);
  const deadline = useRef<number | null>(null);
  const answerBox = useRef<HTMLInputElement | null>(null);

  // ------------------------------------------------ load
  const load = () => {
    if (!submissionId) return;
    setError(null);
    api<QuizView>(`/submissions/${submissionId}/quiz`)
      .then(setView)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Couldn't open the quiz."));
  };
  useEffect(load, [submissionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const status = view?.status;
  const questionIndex = view?.status === "in_progress" ? view.current.index : -1;

  // ------------------------------------------------ recorder (focus + fullscreen only) while the quiz runs
  useEffect(() => {
    if (status !== "in_progress" || !submissionId || recorder.current) return;
    recorder.current = new EventRecorder(submissionId, nextSeq, { getDoc: () => "", getOutput: () => null, sendDoc: false });
    return () => {
      recorder.current?.stop();
      recorder.current = null;
    };
  }, [status, submissionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------ the clock (server's secondsLeft, counted down here)
  useEffect(() => {
    if (view?.status !== "in_progress" || view.secondsLeft == null) {
      deadline.current = null;
      setSecondsLeft(null);
      return;
    }
    deadline.current = Date.now() + view.secondsLeft * 1000;
    setSecondsLeft(view.secondsLeft);
  }, [view]);
  useEffect(() => {
    if (status !== "in_progress") return;
    const t = setInterval(() => {
      if (deadline.current == null) return;
      const left = Math.max(0, Math.round((deadline.current - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) {
        clearInterval(t);
        void timeUp();
      }
    }, 500);
    return () => clearInterval(t);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------ fullscreen watch
  useEffect(() => {
    if (status !== "in_progress" || !view?.fullscreenRequired) return;
    const onChange = () => {
      if (!document.fullscreenElement) {
        recorder.current?.recordFullscreenExit();
        setLeftFullscreen(true);
      } else {
        setLeftFullscreen(false);
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [status, view?.fullscreenRequired]);
  useEffect(() => {
    if (status === "done" && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, [status]);

  // A fresh question: clear the answer and focus the box.
  useEffect(() => {
    setChoice(null);
    setText("");
    setPasteNote(false);
    if (questionIndex >= 0) setTimeout(() => answerBox.current?.focus(), 50);
  }, [questionIndex]);

  // ------------------------------------------------ actions
  const enterFullscreen = async () => {
    if (!canFullscreen()) return;
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      /* the browser said no; the quiz still works and leaving the tab is still recorded */
    }
  };

  const start = async () => {
    if (!submissionId) return;
    setBusy(true);
    setError(null);
    if (view?.fullscreenRequired) await enterFullscreen();
    try {
      setView(await api<QuizView>(`/submissions/${submissionId}/quiz/start`, { body: {} }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't start the quiz.");
    } finally {
      setBusy(false);
    }
  };

  const answer = async () => {
    if (!submissionId || view?.status !== "in_progress") return;
    const last = view.current.index === view.total - 1;
    setBusy(true);
    setError(null);
    try {
      if (last) await recorder.current?.recordSubmit(); // the log is complete before the quiz is marked
      const value = view.current.kind === "mcq" ? choice : text.trim() || null;
      setView(await api<QuizView>(`/submissions/${submissionId}/quiz/answer`, { body: { index: view.current.index, value } }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save that answer. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const timeUp = async () => {
    if (!submissionId) return;
    await recorder.current?.recordSubmit();
    // The server finishes the quiz once its clock (plus a short grace) has run out.
    for (let i = 0; i < 6; i++) {
      const v = await api<QuizView>(`/submissions/${submissionId}/quiz`).catch(() => null);
      if (v?.status === "done") {
        setView(v);
        return;
      }
      await new Promise((r) => setTimeout(r, 2500));
    }
    load();
  };

  // ------------------------------------------------ screens
  if (!submissionId) {
    return (
      <Frame title={assignment.title}>
        <Card className="p-6">
          <h1 className="text-2xl font-bold">{assignment.title}</h1>
          <p className="mt-2 text-ink-2">This quiz is closed, so it can't be started any more.</p>
          <BackToCourse course={assignment.course} tab="quizzes" className="mt-5" />
        </Card>
      </Frame>
    );
  }
  if (error && !view) {
    return (
      <Frame title={assignment.title}>
        <ErrorState message={error} onRetry={load} />
      </Frame>
    );
  }
  if (!view) {
    return (
      <Frame title={assignment.title}>
        <Spinner label="Opening the quiz…" />
      </Frame>
    );
  }

  // 1. Before
  if (view.status === "not_started") {
    const fs = view.fullscreenRequired && canFullscreen();
    return (
      <Frame title={view.title}>
        <BackToCourse course={assignment.course} tab="quizzes" />
        <Appear>
          <Card className="p-6 sm:p-8">
            <p className="text-sm font-medium text-ink-3">
              {assignment.course.code} · {assignment.course.name}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-[28px]">{view.title}</h1>
            <p className="mt-3 text-[17px] text-ink-2">{assignment.instructions}</p>
            <ul className="mt-5 flex flex-wrap gap-2" aria-label="Rules for this quiz">
              <li><Chip tone="attention" icon={Clock}>{formatDue(assignment.dueAt, assignment.open)}</Chip></li>
              <li><Chip tone="action" icon={ListChecks}>{view.total} questions</Chip></li>
              {view.timeLimitMinutes && <li><Chip tone="action" icon={Timer}>{view.timeLimitMinutes} minutes in total</Chip></li>}
              <li><Chip tone="locked" icon={ArrowRight}>One at a time, no going back</Chip></li>
              {view.fullscreenRequired && <li><Chip tone="locked" icon={Maximize}>Fullscreen</Chip></li>}
              <li><Chip tone="locked" icon={ClipboardX}>Paste is off</Chip></li>
            </ul>
            <div className="mt-6 rounded-xl border border-line bg-canvas p-4 text-[15px] text-ink-2">
              <p className="font-semibold text-ink">What happens when you press Start</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>The clock starts and keeps running, even if you close the page.</li>
                {fs && <li>The quiz opens fullscreen. Leaving fullscreen or switching tabs is recorded for your teacher.</li>}
                {!fs && <li>Switching tabs or apps is recorded for your teacher.</li>}
                <li>When time runs out, the quiz hands itself in with the answers you've given.</li>
              </ul>
              <p className="mt-2 text-sm text-ink-3">No webcam, no microphone. Your teacher sees your answers and the times you left the quiz.</p>
            </div>
            {error && <p className="mt-4 font-medium text-danger" role="alert">{error}</p>}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button size="lg" icon={fs ? Expand : Timer} loading={busy} onClick={start} disabled={!assignment.open}>
                Start quiz: {view.total} questions{view.timeLimitMinutes ? `, ${view.timeLimitMinutes} min` : ""}
              </Button>
              <Ur>کوئز شروع کریں</Ur>
            </div>
          </Card>
        </Appear>
      </Frame>
    );
  }

  // 3. After
  if (view.status === "done") {
    const r = view.result;
    return (
      <Frame title={view.title}>
        <Appear>
          <Card className="p-6 sm:p-8">
            <p className="flex items-center gap-2 font-semibold text-done">
              <Pop><CheckCircle2 className="size-6" aria-hidden /></Pop>
              {view.late ? "Time ran out, so your quiz was handed in automatically." : "Quiz handed in."}
            </p>
            <h1 className="mt-3 text-[28px] font-bold tracking-tight">
              {r.correct} of {r.total} right
            </h1>
            <p className="mt-1 text-lg text-ink-2">
              Suggested marks: <strong className="text-ink">{r.grade ?? 0} / {view.marks}</strong>. Your teacher confirms the final mark.
            </p>
            <ol className="mt-6 space-y-2" aria-label="Your answers">
              {r.questions.map((q) => (
                <li key={q.index} className={cx("flex items-start gap-3 rounded-xl border p-3", q.correct ? "border-done-line bg-done-soft" : "border-line bg-surface")}>
                  {q.correct ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-done" aria-hidden /> : <XCircle className="mt-0.5 size-5 shrink-0 text-ink-3" aria-hidden />}
                  <div className="min-w-0">
                    <p className="text-[15px] text-ink"><span className="font-semibold">Q{q.index + 1}.</span> <Prompt text={q.prompt} /></p>
                    <p className="mt-0.5 text-sm text-ink-3">
                      {q.correct ? "Right" : q.answered ? "Not right" : "No answer"}
                      {q.yourAnswer != null && <> · you answered <span className="font-medium text-ink-2">{q.yourAnswer}</span></>}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-sm text-ink-3">Correct answers aren't shown yet: classmates may still be taking this quiz.</p>
            <Link to={assignment.course.id ? `/student/courses/${assignment.course.id}/quizzes` : "/student"} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-action px-5 font-semibold text-white hover:bg-action-hover">
              Back to the quizzes <ArrowRight className="size-5" aria-hidden />
            </Link>
          </Card>
        </Appear>
      </Frame>
    );
  }

  // 2. During
  const q = view.current;
  const last = q.index === view.total - 1;
  const empty = q.kind === "mcq" ? choice == null : !text.trim();
  return (
    <Frame title={view.title} right={secondsLeft != null && view.timeLimitMinutes ? <QuizTimer secondsLeft={secondsLeft} total={view.timeLimitMinutes * 60} /> : undefined}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="font-semibold text-ink-2" aria-live="polite">
          Question {q.index + 1} of {view.total}
        </p>
        <ol className="flex gap-1.5" aria-hidden>
          {Array.from({ length: view.total }, (_, i) => (
            <li key={i} className={cx("h-2 w-6 rounded-full sm:w-8", i < q.index ? "bg-done" : i === q.index ? "bg-action" : "bg-locked-line")} />
          ))}
        </ol>
      </div>

      <Appear key={q.index}>
        <Card className="p-6 sm:p-8">
          <h1 className="text-xl font-semibold leading-relaxed text-ink sm:text-[22px]">
            <Prompt text={q.prompt} />
          </h1>

          {q.kind === "mcq" && q.options ? (
            <fieldset className="mt-6">
              <legend className="sr-only">Choose one answer</legend>
              <div className="grid gap-2.5">
                {q.options.map((opt, i) => (
                  <label
                    key={i}
                    className={cx(
                      "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 text-[17px] transition-colors",
                      choice === i ? "border-action bg-action-soft text-ink" : "border-line bg-surface hover:border-line-strong",
                    )}
                  >
                    <input
                      ref={i === 0 ? answerBox : undefined}
                      type="radio"
                      name={`q${q.index}`}
                      className="size-5 accent-[var(--color-action)]"
                      checked={choice === i}
                      onChange={() => setChoice(i)}
                    />
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-line-strong text-sm font-bold text-ink-3" aria-hidden>
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="min-w-0"><Prompt text={opt} /></span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <div className="mt-6">
              <label htmlFor="quiz-answer" className="mb-2 block font-medium text-ink-2">Your answer</label>
              <input
                id="quiz-answer"
                ref={answerBox}
                value={text}
                maxLength={500}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setText(e.target.value)}
                onPaste={(e) => {
                  e.preventDefault();
                  setPasteNote(true);
                  recorder.current?.recordPasteAttempt(e.clipboardData.getData("text").length, "paste");
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setPasteNote(true);
                  recorder.current?.recordPasteAttempt(e.dataTransfer.getData("text").length, "drop");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !busy) void answer();
                }}
                className="min-h-14 w-full rounded-xl border-2 border-line bg-surface px-4 text-[17px] outline-none focus:border-action"
                placeholder="Type a short answer"
              />
              {pasteNote && (
                <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-attention" role="status">
                  <ClipboardX className="size-4" aria-hidden /> Paste is off in this quiz, so type your answer. (Your teacher can see paste attempts.)
                </p>
              )}
            </div>
          )}

          {error && <p className="mt-4 font-medium text-danger" role="alert">{error}</p>}

          <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <p className="text-sm text-ink-3">{last ? "This is the last question." : "You can't come back to this question."}</p>
            <Button size="lg" icon={last ? Send : ArrowRight} loading={busy} onClick={answer} variant={empty ? "secondary" : "primary"}>
              {empty ? (last ? "Hand in without answering" : "Skip this question") : last ? "Hand in quiz" : "Next question"}
            </Button>
          </div>
        </Card>
      </Appear>

      {leftFullscreen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4" role="alertdialog" aria-modal="true" aria-labelledby="fs-title">
          <Pop>
            <div className="max-w-md rounded-2xl bg-surface p-6 shadow-xl">
              <p id="fs-title" className="flex items-center gap-2 text-lg font-bold text-attention">
                <ShieldAlert className="size-6" aria-hidden /> You left fullscreen
              </p>
              <p className="mt-2 text-ink-2">This has been recorded for your teacher. The timer is still running.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {canFullscreen() && (
                  <Button icon={Maximize} onClick={() => void enterFullscreen()}>
                    Back to fullscreen
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setLeftFullscreen(false)}>
                  Continue without fullscreen
                </Button>
              </div>
            </div>
          </Pop>
        </div>
      )}
    </Frame>
  );
}
