/**
 * The student workspace. Max three regions: the journey (top), the work (task, editor, output),
 * and Ustaad (side). One primary action at a time, labelled with what it will do.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, ClipboardX, Copy, Loader2, Lock, MessageCircleQuestion, Play, Send, Shuffle, Timer } from "lucide-react";
import { Dialog } from "../components/Dialog";
import { AppShell } from "../components/AppShell";
import { BackToCourse } from "../components/BackToCourse";
import { Button, Card, Chip, ErrorState, Skeleton, cx } from "../components/ui";
import { Appear } from "../components/Motion";
import { api, ApiError } from "../lib/api";
import { formatDateTime, formatDue } from "../lib/format";
import { useMe } from "../lib/session";
import { useApi, type Loadable } from "../lib/useApi";
import { runner, useRunnerStatus } from "../runner/runner";
import { runnerFor } from "../runner/jsRunner";
import { CodeEditor, type CodeEditorHandle } from "../workspace/CodeEditor";
import { JourneyStepper, type JourneyStep } from "../workspace/JourneyStepper";
import { EventRecorder, type SaveState } from "../workspace/recorder";
import { UstaadPanel, type ChatMessage } from "../workspace/UstaadPanel";
import { ResizableSplit } from "../components/ResizableSplit";
import { WrittenEditor } from "../workspace/WrittenEditor";
import { isOwnCode, journeyStates } from "../workspace/journey";
import { NO_CHECKS, loadChecks, mergeChecks, missingCheck, missingHint, saveChecks, type ExplainChecks } from "../workspace/explainChecks";
import { QuizPlayer } from "./Quiz";
import { Markdown } from "../components/Markdown";
import type { Change } from "../../../shared/events";

interface WorkspaceData {
  assignment: {
    id: string;
    title: string;
    type: string;
    language: string | null;
    starterCode: string;
    instructions: string;
    marks: number;
    open: boolean;
    dueAt: string | null;
    course: { id: string; code: string; name: string };
    rules: { pasteBlocked: boolean; workflow: "run_first" | "explain_first"; vivaQuestions: number; vivaSecondsPerQ: number; vivaWeight: number; variantsOn: boolean } | null;
  };
  submission: {
    id: string;
    status: "in_progress" | "submitted" | "viva_in_progress" | "graded";
    content: string;
    lastOutput: string | null;
    nextSeq: number;
    hasRun: boolean;
    submittedAt: string | null;
  } | null;
  messages: { role: "student" | "ustaad"; text: string; hint: string | null }[];
}

interface RunView {
  ok: boolean;
  output: string;
  error?: string;
  durationMs: number;
  timedOut?: boolean;
}

function Brief({ text }: { text: string }) {
  return <Markdown text={text} className="text-[16px]" />;
}

const IDLE: SaveState = { kind: "idle" };
const getIdle = () => IDLE; // must return the same object every time (useSyncExternalStore)

function useSaveState(rec: EventRecorder | null): SaveState {
  const noop = useCallback(() => () => {}, []);
  return useSyncExternalStore(rec ? rec.subscribe : noop, rec ? rec.getState : getIdle);
}

function SavedIndicator({ state }: { state: SaveState }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  if (state.kind === "saving") return <span className="text-sm text-ink-3">Saving…</span>;
  if (state.kind === "error") return <span className="text-sm text-attention" title={state.message}>Not saved yet, retrying</span>;
  if (state.kind === "saved") {
    const s = Math.max(0, Math.round((Date.now() - state.at) / 1000));
    return <span className="text-sm text-ink-3">Saved {s < 5 ? "just now" : s < 60 ? `${s} s ago` : `${Math.round(s / 60)} min ago`}</span>;
  }
  return <span className="text-sm text-ink-3">Autosaves every 10 s</span>;
}

/** Opens an assignment: timed quizzes get the quiz player, everything else the workspace. */
export function Workspace() {
  const { id = "" } = useParams();
  const data = useApi<WorkspaceData>(`/student/assignments/${id}`);
  if (data.status === "ready" && data.data.assignment.type === "quiz") {
    const { assignment: a, submission: s } = data.data;
    return <QuizPlayer assignment={a} submissionId={s?.id ?? null} nextSeq={s?.nextSeq ?? 1} />;
  }
  return <CodeWorkspace data={data} />;
}

function CodeWorkspace({ data }: { data: Loadable<WorkspaceData> & { reload: () => void } }) {
  const me = useMe();
  const pythonStatus = useRunnerStatus();

  const [doc, setDoc] = useState("");
  const [lastRun, setLastRun] = useState<RunView | null>(null);
  const [running, setRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [ranOwnCode, setRanOwnCode] = useState(false); // a run of code that differs from the starter (the Run step)
  const [startedWriting, setStartedWriting] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [runUnlocked, setRunUnlocked] = useState(false);
  const [checks, setChecks] = useState<ExplainChecks>(NO_CHECKS);
  const [notice, setNotice] = useState<string | null>(null);
  const [recorder, setRecorder] = useState<EventRecorder | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const navigate = useNavigate();

  const editor = useRef<CodeEditorHandle | null>(null);
  const chatInput = useRef<HTMLTextAreaElement | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const docRef = useRef("");
  const outputRef = useRef<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveState = useSaveState(recorder);
  // Is the journey card on screen? When it isn't, the slim next-step bar shows instead.
  const journeyRef = useRef<HTMLDivElement | null>(null);
  const [journeyVisible, setJourneyVisible] = useState(true);
  useEffect(() => {
    const el = journeyRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setJourneyVisible(Boolean(e?.isIntersecting)), { rootMargin: "-64px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [data.status]); // the card mounts once the assignment has loaded

  const a = data.status === "ready" ? data.data.assignment : null;
  const sub = data.status === "ready" ? data.data.submission : null;
  const editable = Boolean(a?.open && sub?.status === "in_progress");
  const workflow = a?.rules?.workflow ?? "run_first";
  const pasteBlocked = a?.rules?.pasteBlocked ?? false;
  // JavaScript runs in a fresh worker each time (always ready); Python needs Pyodide loaded.
  const runnerStatus = a?.language === "javascript" ? "ready" : pythonStatus;

  // Initialise local state once the data arrives.
  useEffect(() => {
    if (data.status !== "ready") return;
    const d = data.data;
    document.title = `${d.assignment.title} · Socratic AI`;
    const initial = d.submission?.content ?? d.assignment.starterCode;
    setDoc(initial);
    docRef.current = initial;
    outputRef.current = d.submission?.lastOutput ?? null;
    setHasRun(Boolean(d.submission?.hasRun));
    setRanOwnCode(Boolean(d.submission?.hasRun) && isOwnCode(initial, d.assignment.starterCode));
    setStartedWriting(Boolean(d.submission && (d.submission.hasRun || initial !== d.assignment.starterCode)));
    setMessages(d.messages.map((m) => ({ role: m.role, text: m.text, hint: m.hint })));
    setRunUnlocked(d.assignment.rules?.workflow !== "explain_first" || Boolean(d.submission?.hasRun));
    if (d.submission) setChecks(loadChecks(d.submission.id));
    if (d.submission?.lastOutput) setLastRun({ ok: true, output: d.submission.lastOutput, durationMs: 0 });
  }, [data.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // One recorder per editable submission.
  useEffect(() => {
    if (!sub || !editable) return;
    const rec = new EventRecorder(sub.id, sub.nextSeq, { getDoc: () => docRef.current, getOutput: () => outputRef.current });
    setRecorder(rec);
    return () => {
      void rec.flush();
      rec.stop();
    };
  }, [sub?.id, editable]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (a && a.language === "python") void runner.preload().catch(() => {});
  }, [a?.language]); // eslint-disable-line react-hooks/exhaustive-deps

  const showNotice = (text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 6000);
  };

  const onBlocked = (source: "paste" | "drop", length: number) => {
    recorder?.recordPasteAttempt(length, source);
    showNotice(
      source === "paste"
        ? "Paste is off for this assignment. Type your answer: Ustaad and your teacher want to see how you build it."
        : "Dropping text in is off for this assignment. Type your answer instead.",
    );
  };

  const onChange = (next: string, changes: Change[]) => {
    docRef.current = next;
    setDoc(next);
    setStartedWriting(true);
    recorder?.recordChanges(changes);
  };

  const run = async () => {
    if (!editable || running) return;
    if (!runUnlocked) {
      showNotice("Explain your plan to Ustaad first. Running unlocks once your plan makes sense.");
      chatInput.current?.focus();
      return;
    }
    setRunning(true);
    const started = performance.now();
    const r = await runnerFor(a?.language ?? "python").run(docRef.current);
    const view: RunView = { ok: r.ok, output: r.output, error: r.error, durationMs: r.durationMs, timedOut: r.timedOut };
    outputRef.current = [r.output, r.error].filter(Boolean).join("\n");
    setLastRun(view);
    setHasRun(true);
    setStartedWriting(true); // running the code means they've engaged with the task (Understand)
    if (a && isOwnCode(docRef.current, a.starterCode)) setRanOwnCode(true);
    setRunning(false);
    recorder?.recordRun(r.ok, r.durationMs || performance.now() - started, r.error);
  };

  const send = async (text: string) => {
    if (!sub || sending) return;
    setChatError(null);
    setMessages((m) => [...m, { role: "student", text }]);
    setSending(true);
    try {
      const r = await api<{ reply: { text: string; hint: string | null; allowExecution: boolean; checks?: Partial<ExplainChecks> } }>(`/submissions/${sub.id}/ustaad`, {
        body: { message: text, code: docRef.current, output: outputRef.current, hasRun },
      });
      setMessages((m) => [...m, { role: "ustaad", text: r.reply.text, hint: r.reply.hint }]);
      if (r.reply.allowExecution) setRunUnlocked(true);
      setChecks((prev) => {
        const next = mergeChecks(prev, r.reply.checks);
        saveChecks(sub.id, next);
        return next;
      });
    } catch (err) {
      setChatError(err instanceof ApiError ? err.message : "Couldn't reach Ustaad. Try again.");
    } finally {
      setSending(false);
    }
  };

  const submitWork = async () => {
    if (!sub || !a) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await recorder?.recordSubmit(); // last snapshot + submit marker, while edits are still accepted
      await api(`/submissions/${sub.id}/submit`, { body: { doc: docRef.current } });
      navigate(`/student/assignments/${a.id}/viva`);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Couldn't submit. Check your connection and try again.");
      setSubmitting(false);
    }
  };

  // ------------------------------------------------ the journey
  const isWritten = a?.type === "written";
  const kind = isWritten ? "written" : "code";
  const talked = messages.some((m) => m.role === "student");
  const missing = missingCheck(checks, kind, workflow);
  // Explain is done only when Ustaad's checks say so (T02), never after any one message.
  const explained = talked && missing === null && (isWritten || workflow === "explain_first" || ranOwnCode);
  const submitLock = explained ? undefined : "Ustaad must check your explanation first";
  const written = startedWriting && a != null && doc.trim() !== a.starterCode.trim();
  const steps: JourneyStep[] = useMemo(() => {
    const raw = isWritten
      ? [
          { key: "understand", label: "Understand", done: startedWriting },
          { key: "write", label: "Write", done: written },
          { key: "explain", label: "Explain", done: explained },
          { key: "submit", label: "Submit + viva", done: sub?.status !== "in_progress" && sub != null, lockedHint: submitLock },
        ]
      : workflow === "explain_first"
        ? [
            { key: "understand", label: "Understand", done: startedWriting },
            { key: "write", label: "Write", done: written },
            { key: "explain", label: "Explain", done: explained },
            { key: "run", label: "Run", done: ranOwnCode, lockedHint: runUnlocked ? undefined : "Explain your plan first" },
            { key: "submit", label: "Submit + viva", done: sub?.status !== "in_progress" && sub != null, lockedHint: submitLock },
          ]
        : [
            { key: "understand", label: "Understand", done: startedWriting },
            { key: "write", label: "Write", done: written },
            { key: "run", label: "Run", done: ranOwnCode },
            { key: "explain", label: "Explain", done: explained, lockedHint: ranOwnCode ? undefined : "Run your code first" },
            { key: "submit", label: "Submit + viva", done: sub?.status !== "in_progress" && sub != null, lockedHint: submitLock },
          ];
    // Steps finish in order: never a done step after an open one.
    return journeyStates(raw);
  }, [isWritten, workflow, startedWriting, written, explained, ranOwnCode, runUnlocked, sub, submitLock]);
  const current = steps.find((s) => s.state === "current")?.key ?? "submit";
  const currentStep = steps.find((s) => s.state === "current") ?? null;
  const stepNo = currentStep ? steps.indexOf(currentStep) + 1 : steps.length;

  const vivaLine = a?.rules
    ? `Ustaad will ask ${a.rules.vivaQuestions} questions about your own ${isWritten ? "answer" : "code"}, ${a.rules.vivaSecondsPerQ} seconds each. Paste is off. The viva is ${a.rules.vivaWeight}% of your marks.`
    : "";

  const nextStep: { text: string; button?: { label: string; icon: typeof Play; onClick: () => void; disabled?: boolean } } = !editable
    ? { text: "" }
    : isWritten && current !== "submit"
      ? current === "understand"
        ? { text: "Read the task, then start writing your answer in your own words.", button: { label: "Start writing", icon: Play, onClick: () => { setStartedWriting(true); textRef.current?.focus(); } } }
        : current === "write"
          ? { text: "Write your answer. When your main point is down, talk it through with Ustaad.", button: { label: "Talk it through with Ustaad", icon: MessageCircleQuestion, onClick: () => chatInput.current?.focus() } }
          : { text: talked && missing ? `Ustaad still needs one thing before you can submit. ${missingHint(missing, kind)}` : "Tell Ustaad your main point and why you believe it, in plain words.", button: { label: "Explain to Ustaad", icon: MessageCircleQuestion, onClick: () => chatInput.current?.focus() } }
    : current === "understand"
      ? { text: "Read the task, then start writing your own code.", button: { label: "Start writing", icon: Play, onClick: () => { setStartedWriting(true); editor.current?.focus(); } } }
      : current === "write"
        ? workflow === "explain_first"
          ? { text: "Write your first attempt, then explain your plan to Ustaad.", button: { label: "Explain my plan to Ustaad", icon: MessageCircleQuestion, onClick: () => chatInput.current?.focus() } }
          : { text: "Write your solution, then run it to see what it really does.", button: { label: running ? "Running…" : "Run my code", icon: Play, onClick: run, disabled: runnerStatus !== "ready" || running } }
        : current === "run"
          ? { text: "Run your code and look closely at the output.", button: { label: running ? "Running…" : "Run my code", icon: Play, onClick: run, disabled: runnerStatus !== "ready" || running || !runUnlocked } }
          : current === "explain"
            ? workflow === "explain_first"
              ? { text: talked && missing ? `Ustaad still needs one thing. ${missingHint(missing, kind)}` : "Tell Ustaad what your code should do and how, in plain words. Running unlocks when your plan is clear.", button: { label: "Explain my plan to Ustaad", icon: MessageCircleQuestion, onClick: () => chatInput.current?.focus() } }
              : { text: talked && missing ? `Ustaad still needs one thing before you can submit. ${missingHint(missing, kind)}` : "Tell Ustaad, in your own words, why your code gives that output.", button: { label: "Explain to Ustaad", icon: MessageCircleQuestion, onClick: () => chatInput.current?.focus() } }
            : { text: `Ready to hand in? ${vivaLine}`, button: { label: "Submit (you can't edit after this)", icon: Send, onClick: () => setConfirmOpen(true) } };

  const starters = isWritten
    ? ["Here's my main point: …", "How should I start my answer?", "Ask me a question to check my argument holds up."]
    : workflow === "explain_first"
      ? ["Here's my plan before I run anything: …", "Which part of the task should I think about first?", "Ask me a question to check my plan is ready."]
      : ["My code gave an error. Help me read it.", "Which part of the task should I start with?", "I ran my code. Ask me a question to check I understand it."];

  // ------------------------------------------------ render
  return (
    <AppShell wide>
      <BackToCourse course={data.status === "ready" ? data.data.assignment.course : null} />

      {data.status === "loading" && (
        <div className="space-y-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-12" />
          <Skeleton className="h-[420px]" />
        </div>
      )}
      {data.status === "error" && <ErrorState message={data.message} onRetry={data.reload} />}

      {a && (
        <>
          <div className="mb-5">
            <p className="text-sm font-medium text-ink-3">
              {a.course.code} · {a.course.name}
            </p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{a.title}</h1>
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Rules for this assignment">
              <li>
                <Chip tone={a.open ? "attention" : "locked"} icon={CalendarClock}>
                  {formatDue(a.dueAt, a.open)}
                </Chip>
              </li>
              <li>
                <Chip tone="locked" icon={null}>{a.marks} marks</Chip>
              </li>
              {a.rules?.pasteBlocked && (
                <li>
                  <Chip tone="locked" icon={ClipboardX}>Paste is off</Chip>
                </li>
              )}
              {a.rules && a.rules.vivaQuestions > 0 && (
                <li>
                  <Chip tone="action" icon={Timer}>
                    Viva: {a.rules.vivaQuestions} questions · {a.rules.vivaSecondsPerQ} s each
                  </Chip>
                </li>
              )}
              {a.rules?.variantsOn && (
                <li>
                  <Chip tone="locked" icon={Shuffle}>Your own version of the question</Chip>
                </li>
              )}
            </ul>
            <p className="mt-2 text-sm text-ink-3">
              Your teacher can see how this work was made: edits, runs and time away from the page. Only your teacher sees it. No webcam, no microphone.
            </p>
          </div>

          {sub && sub.status === "viva_in_progress" && (
            <Card className="mb-5 flex flex-wrap items-center justify-between gap-3 border-attention-line bg-attention-soft p-4">
              <p className="font-medium text-ink">Your work is submitted, but your viva isn't finished yet.</p>
              <Link to={`/student/assignments/${a.id}/viva`} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-action px-4 font-semibold text-white hover:bg-action-hover">
                Continue your viva <ArrowRight className="size-5" aria-hidden />
              </Link>
            </Card>
          )}
          {sub && (sub.status === "submitted" || sub.status === "graded") && (
            <Card className="mb-5 flex flex-wrap items-center justify-between gap-3 border-done-line bg-done-soft p-4">
              <p className="flex items-center gap-2 font-medium text-done">
                <CheckCircle2 className="size-5" aria-hidden />
                Submitted{sub.submittedAt ? ` on ${formatDateTime(sub.submittedAt)}` : ""}. Your work can't be changed now.
              </p>
              <Link to={`/student/assignments/${a.id}/viva`} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-done-line bg-surface px-4 font-semibold text-done hover:bg-done-soft">
                See your results <ArrowRight className="size-5" aria-hidden />
              </Link>
            </Card>
          )}
          {!a.open && !sub && (
            <Card className="mb-5 flex items-center gap-3 p-4">
              <Lock className="size-5 text-locked" aria-hidden />
              <p className="text-ink-2">This assignment is closed. You can read the task, but it can't be started any more.</p>
            </Card>
          )}

          {editable && (
            <div ref={journeyRef}>
              <Card className="mb-5 p-4 sm:p-5">
                <JourneyStepper steps={steps} />
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                  <p className="max-w-2xl text-[15px] text-ink-2">{nextStep.text}</p>
                  {nextStep.button && (
                    <Button icon={nextStep.button.icon} onClick={nextStep.button.onClick} disabled={nextStep.button.disabled}>
                      {nextStep.button.label}
                    </Button>
                  )}
                </div>
              </Card>
            </div>
          )}
          {/* Once the journey card scrolls away, a slim bar keeps the step and the next action in view
              without covering the editor (T07, revised). */}
          {editable && !journeyVisible && currentStep && (
            <div role="region" aria-label="Next step" className="fixed inset-x-0 top-16 z-20 border-b border-line bg-surface/95 shadow-sm backdrop-blur">
              <div className="mx-auto flex h-12 max-w-7xl items-center gap-3 px-4 sm:px-6">
                <span className="shrink-0 rounded-full bg-action-soft px-2.5 py-0.5 text-[13px] font-semibold text-action">
                  Step {stepNo} of {steps.length}: {currentStep.label}
                </span>
                <p className="min-w-0 flex-1 truncate text-sm text-ink-2" title={nextStep.text}>{nextStep.text}</p>
                {nextStep.button && (
                  <button
                    type="button"
                    onClick={nextStep.button.onClick}
                    disabled={nextStep.button.disabled}
                    className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-action px-3 text-sm font-semibold text-white hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <nextStep.button.icon className="size-4" aria-hidden />
                    {nextStep.button.label}
                  </button>
                )}
              </div>
            </div>
          )}

          <ResizableSplit
            storageKey="socratic.ustaad.width"
            label="Ustaad panel"
            main={
              <>
                <Card className="p-5">
                  <h2 className="mb-2 flex items-center justify-between gap-2 font-semibold">
                    Your task
                    {pasteBlocked && (
                      <span className="flex items-center gap-1 text-xs font-normal text-ink-3">
                        <Copy className="size-3.5" aria-hidden /> Copying the task is off
                      </span>
                    )}
                  </h2>
                  <div
                    className={cx("text-[15px] leading-relaxed text-ink-2", pasteBlocked && "select-none")}
                    onCopy={(e) => pasteBlocked && e.preventDefault()}
                    onCut={(e) => pasteBlocked && e.preventDefault()}
                    onContextMenu={(e) => pasteBlocked && e.preventDefault()}
                  >
                    <Brief text={a.instructions} />
                  </div>
                </Card>

                {(sub || !a.open) && isWritten && (
                  <Card className="overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
                      <span className="text-sm font-semibold">Your answer</span>
                      {editable && <SavedIndicator state={saveState} />}
                    </div>
                    <div className="relative">
                      {data.status === "ready" && (
                        <WrittenEditor
                          initial={sub?.content ?? a.starterCode}
                          readOnly={!editable}
                          pasteBlocked={pasteBlocked}
                          onChange={onChange}
                          onBlocked={onBlocked}
                          focusRef={(el) => (textRef.current = el)}
                          label={`Your answer for ${a.title}`}
                        />
                      )}
                      {notice && (
                        <div role="alert" className="absolute inset-x-3 top-3 z-10 flex items-start gap-2 rounded-lg border border-attention-line bg-attention-soft px-3 py-2.5 text-sm text-ink shadow-sm">
                          <ClipboardX className="mt-0.5 size-4 shrink-0 text-attention" aria-hidden />
                          {notice}
                        </div>
                      )}
                    </div>
                  </Card>
                )}
                {(sub || !a.open) && !isWritten && (
                  <Card className="overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
                      <span className="font-mono text-sm font-medium">{a.language === "javascript" ? "solution.js" : "solution.py"}</span>
                      <div className="flex items-center gap-3">
                        {editable && <SavedIndicator state={saveState} />}
                        {editable && (
                          <Button variant="secondary" icon={running ? Loader2 : Play} onClick={run} disabled={runnerStatus !== "ready" || running} title="Run my code (Ctrl+Enter)">
                            {runnerStatus === "ready" ? (running ? "Running…" : "Run my code") : runnerStatus === "error" ? "Runner unavailable" : "Preparing the code runner…"}
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="relative">
                      {data.status === "ready" && (
                        <CodeEditor
                          initialDoc={sub?.content ?? a.starterCode}
                          language={a.language}
                          pasteBlocked={pasteBlocked}
                          readOnly={!editable}
                          onChange={onChange}
                          onBlocked={onBlocked}
                          onRunShortcut={() => void run()}
                          handleRef={(h) => (editor.current = h)}
                          label={`Code editor for ${a.title}`}
                        />
                      )}
                      {notice && (
                        <div role="alert" className="absolute inset-x-3 top-3 z-10 flex items-start gap-2 rounded-lg border border-attention-line bg-attention-soft px-3 py-2.5 text-sm text-ink shadow-sm">
                          <ClipboardX className="mt-0.5 size-4 shrink-0 text-attention" aria-hidden />
                          {notice}
                        </div>
                      )}
                    </div>
                    <div className="border-t border-line bg-canvas">
                      <div className="flex items-center justify-between px-4 py-2 text-sm">
                        <span className="font-semibold text-ink-2">Output</span>
                        {lastRun &&
                          (lastRun.ok ? (
                            <span className="flex items-center gap-1.5 font-medium text-done">
                              <CheckCircle2 className="size-4" aria-hidden /> Ran without errors{lastRun.durationMs ? ` · ${lastRun.durationMs} ms` : ""}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 font-medium text-danger">
                              <AlertTriangle className="size-4" aria-hidden /> {lastRun.timedOut ? "Stopped after 5 seconds" : "Your code has an error"}
                            </span>
                          ))}
                      </div>
                      <Appear key={lastRun ? `${lastRun.output}|${lastRun.error}|${lastRun.durationMs}` : "empty"}>
                      <pre
                        aria-live="polite"
                        className={cx("max-h-56 min-h-24 overflow-auto px-4 pb-4 font-mono text-sm whitespace-pre-wrap", lastRun && !lastRun.ok ? "text-danger" : "text-ink")}
                      >
                        {lastRun
                          ? [lastRun.output, lastRun.error].filter(Boolean).join("\n") || "(Your program ran but printed nothing. Add print(...) to see results.)"
                          : runnerStatus === "ready"
                            ? 'Click "Run my code" to see what your program prints.'
                            : "Preparing the code runner… this happens once and takes a few seconds."}
                      </pre>
                      </Appear>
                    </div>
                  </Card>
                )}
              </>
            }
            side={
              sub ? (
                <div className="lg:sticky lg:top-32">
                  <UstaadPanel
                    workNoun={isWritten ? "answer" : "code"}
                    studentName={me.name.split(" ")[0] ?? me.name}
                    messages={messages}
                    sending={sending}
                    error={chatError}
                    disabled={!editable}
                    disabledReason="This assignment is submitted, so the hint chat is closed. Your teacher can still read it."
                    pasteBlocked={pasteBlocked}
                    starters={starters}
                    onSend={send}
                    onBlockedPaste={() => showNotice("Paste is off here too. Explain in your own words: that's what Ustaad checks.")}
                    inputRef={(el) => (chatInput.current = el)}
                  />
                </div>
              ) : null
            }
          />
        </>
      )}
      <Dialog open={confirmOpen} title="Submit and start your viva?" onClose={() => !submitting && setConfirmOpen(false)}>
        <ul className="space-y-2 text-[15px] text-ink-2">
          <li className="flex gap-2"><Lock className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden /> Your {isWritten ? "answer" : "code"} is locked: you can't edit it after this.</li>
          {!isWritten && <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden /> It's checked against the hidden tests straight away.</li>}
          <li className="flex gap-2"><Timer className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden /> {vivaLine} It can't be paused.</li>
        </ul>
        {submitError && <p role="alert" className="mt-3 text-danger">{submitError}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={submitting} data-autofocus>
            Keep working
          </Button>
          <Button icon={Send} loading={submitting} onClick={submitWork}>
            Submit and start the viva
          </Button>
        </div>
      </Dialog>
    </AppShell>
  );
}
