/**
 * The integrity report, read like a story: what happened (timeline + replay), what stands out
 * (flags as plain sentences, each with "Show me"), what the viva showed, and the teacher's decision.
 * Add ?compare=<id> to see two submissions side by side.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ArrowLeft, Bot, CheckCircle2, CircleHelp, Flag, MessageSquare, ThumbsUp, Timer, XCircle } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Button, Card, Chip, ErrorState, Skeleton, cx } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { useApi } from "../lib/useApi";
import { fmtOffset, Replay, type ReplayEvent } from "../teacher/Replay";

interface ReportData {
  submission: { id: string; status: string; code: string; startedAt: string; submittedAt: string | null; testsPassed: number | null; testsTotal: number | null; vivaScore: number | null; suggestedGrade: number | null; finalGrade: number | null; decision: "looks_fine" | "talk_to_student" | null; comment: string | null };
  student: { id: string; name: string; initials: string };
  assignment: { id: string; title: string; marks: number; starterCode: string; courseCode: string; vivaWeight: number; variant: string | null };
  events: ReplayEvent[];
  flags: { id: string; rule: string; severity: "low" | "medium" | "high"; message: string; fromSeq: number; toSeq: number; status: "open" | "dismissed" | "followed_up" }[];
  viva: { status: string; score: number | null; summary: string | null; questions: { kind: string; prompt: string; answer: string; secondsAllowed: number; secondsTaken: number | null; late: boolean; awayMs: number; check: { call: string; actual: string; predicted_match: boolean | null } | null; score: number | null; feedback: string | null }[] } | null;
  messages: { role: "student" | "ustaad"; text: string; hint: string | null }[];
  tests: { name: string; call: string; expected: string | null; actual: string | null; passed: boolean | null }[];
}

const KIND_LABEL: Record<string, string> = { explain_line: "Explain a line", predict_output: "Predict the output", modify: "Describe a change" };

function Code({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/g).map((p, i) =>
        p.startsWith("`") && p.endsWith("`") && p.length > 2 ? (
          <code key={i} className="rounded bg-locked-soft px-1 py-0.5 font-mono text-[0.9em]">
            {p.slice(1, -1)}
          </code>
        ) : (
          p
        ),
      )}
    </>
  );
}

function facts(d: ReportData) {
  const ev = d.events;
  const start = ev[0]?.t ?? 0;
  const end = (ev.find((e) => e.type === "submit") ?? ev.at(-1))?.t ?? start;
  const away = ev.filter((e) => e.type === "focus_back").reduce((n, e) => n + Number((e.payload as { awayMs?: number }).awayMs ?? 0), 0);
  return {
    time: end - start,
    runs: ev.filter((e) => e.type === "run").length,
    errors: ev.filter((e) => e.type === "run" && !(e.payload as { ok?: boolean }).ok).length,
    pastes: ev.filter((e) => e.type === "paste_attempt").length,
    away,
    hints: d.messages.filter((m) => m.role === "student").length,
  };
}

function ReportColumn({ id, compact }: { id: string; compact?: boolean }) {
  const data = useApi<ReportData>(`/teacher/submissions/${id}`);
  const [jump, setJump] = useState<{ seq: number; nonce: number } | null>(null);
  const [deciding, setDeciding] = useState<string | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decided, setDecided] = useState<ReportData["submission"]["decision"]>(null);

  // Depend on primitive values only: `data` is a new object on every render, and resetting from it
  // would wipe the teacher's just-saved decision off the screen.
  const flagSeqs = data.status === "ready" ? data.data.flags.map((f) => f.fromSeq).join(",") : "";
  const highlight = useMemo(() => new Set(flagSeqs ? flagSeqs.split(",").map(Number) : []), [flagSeqs]);
  const serverDecision = data.status === "ready" ? data.data.submission.decision : null;
  useEffect(() => setDecided(serverDecision), [serverDecision]);

  if (data.status === "loading") return <Skeleton className="h-[640px]" />;
  if (data.status === "error") return <ErrorState message={data.message} onRetry={data.reload} />;
  const d = data.data;
  const f = facts(d);
  const grade = d.submission.finalGrade ?? d.submission.suggestedGrade;

  const decide = async (decision: "looks_fine" | "talk_to_student") => {
    setDeciding(decision);
    setDecisionError(null);
    try {
      await api(`/teacher/submissions/${d.submission.id}/decision`, { body: { decision } });
      setDecided(decision);
    } catch (err) {
      setDecisionError(err instanceof ApiError ? err.message : "Couldn't save the decision.");
    } finally {
      setDeciding(null);
    }
  };

  return (
    <div className="min-w-0 space-y-5">
      {/* Who, and the headline numbers */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span aria-hidden className="flex size-11 items-center justify-center rounded-full bg-action-soft font-semibold text-action">{d.student.initials}</span>
            <div>
              <h2 className="text-xl font-bold">{d.student.name}</h2>
              <p className="text-sm text-ink-3">
                {d.submission.submittedAt ? `Submitted ${formatDateTime(d.submission.submittedAt)}` : "Not submitted yet"}
                {d.assignment.variant && ` · Version: ${d.assignment.variant}+`}
              </p>
            </div>
          </div>
          {d.flags.some((x) => x.status === "open") ? (
            <Chip tone="attention" icon={Flag}>{d.flags.filter((x) => x.status === "open").length} to look at</Chip>
          ) : (
            <Chip tone="done">No open flags</Chip>
          )}
        </div>
        <dl className={cx("mt-4 grid gap-3 text-center", compact ? "grid-cols-3" : "grid-cols-3 sm:grid-cols-6")}>
          {[
            ["Hidden tests", d.submission.testsTotal ? `${d.submission.testsPassed}/${d.submission.testsTotal}` : "–", d.submission.testsTotal != null && d.submission.testsPassed === d.submission.testsTotal],
            ["Viva", d.submission.vivaScore != null ? `${d.submission.vivaScore}/100` : "–", d.submission.vivaScore != null && d.submission.vivaScore >= 50],
            ["Suggested mark", grade != null ? `${grade}/${d.assignment.marks}` : "–", null],
            ["Time spent", fmtOffset(f.time), null],
            ["Runs (errors)", `${f.runs} (${f.errors})`, null],
            ["Time away", f.away ? fmtOffset(f.away) : "None", null],
          ].map(([label, value, good]) => (
            <div key={String(label)} className="rounded-lg bg-canvas px-2 py-2.5">
              <dt className="text-xs text-ink-3">{label}</dt>
              <dd className={cx("text-lg font-bold tabular-nums", good === true && "text-done", good === false && "text-attention")}>{value}</dd>
            </div>
          ))}
        </dl>
        {/* Decision: the teacher decides, always */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <span className="mr-1 text-sm font-medium text-ink-2">Your decision:</span>
          <Button variant={decided === "looks_fine" ? "primary" : "secondary"} icon={ThumbsUp} loading={deciding === "looks_fine"} onClick={() => decide("looks_fine")}>
            Looks fine
          </Button>
          <Button variant={decided === "talk_to_student" ? "primary" : "secondary"} icon={MessageSquare} loading={deciding === "talk_to_student"} onClick={() => decide("talk_to_student")}>
            Talk to student
          </Button>
          {decided && (
            <span className="text-sm text-done" role="status">
              <CheckCircle2 className="mr-1 inline size-4" aria-hidden />
              Saved{decided === "talk_to_student" ? ": flags marked as followed up" : ""}
            </span>
          )}
          {decisionError && <span role="alert" className="text-sm text-danger">{decisionError}</span>}
        </div>
      </Card>

      {/* What stands out */}
      <Card className="p-5">
        <h3 className="font-semibold">What to look at</h3>
        {d.flags.length === 0 ? (
          <p className="mt-2 flex items-center gap-2 text-ink-2"><CheckCircle2 className="size-5 text-done" aria-hidden /> Nothing unusual in how this work was made.</p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {d.flags.map((x) => (
              <li key={x.id} className={cx("flex flex-wrap items-start justify-between gap-2 rounded-lg border px-3.5 py-3", x.status === "open" ? "border-attention-line bg-attention-soft" : "border-line bg-canvas")}>
                <p className="flex flex-1 gap-2">
                  <Flag className={cx("mt-1 size-4 shrink-0", x.status === "open" ? "text-attention" : "text-ink-3")} aria-hidden />
                  <span>
                    {x.message}
                    {x.status !== "open" && <span className="ml-1 text-sm text-ink-3">({x.status === "dismissed" ? "you marked it fine" : "followed up"})</span>}
                  </span>
                </p>
                <button onClick={() => setJump({ seq: x.fromSeq, nonce: Date.now() })} className="min-h-9 rounded-md px-2 text-sm font-semibold text-action hover:underline">
                  Show me
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-ink-3">Flags come from simple rules about how the work was made. They are evidence, never proof: you decide.</p>
      </Card>

      {/* How it was made */}
      <Card className="p-5">
        <h3 className="mb-3 font-semibold">How the work was made</h3>
        <Replay starterCode={d.assignment.starterCode} events={d.events} jumpToSeq={jump} highlightSeqs={highlight} compact={compact} />
        <p className="mt-2 text-xs text-ink-3">
          {f.pastes ? `${f.pastes} blocked paste attempt${f.pastes === 1 ? "" : "s"} · ` : ""}
          {f.hints} message{f.hints === 1 ? "" : "s"} to Ustaad · Times are measured from the start of the session.
        </p>
      </Card>

      {/* The viva */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Viva on their own code</h3>
          {d.viva?.score != null && <Chip tone={d.viva.score >= 50 ? "done" : "attention"} icon={Timer}>{d.viva.score}/100</Chip>}
        </div>
        {d.viva?.summary && (
          <p className="mt-3 flex gap-2 rounded-lg bg-canvas px-3.5 py-3 text-[15px]">
            <Bot className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
            <span>
              <span className="font-medium">AI summary (check it against the answers): </span>
              {d.viva.summary}
            </span>
          </p>
        )}
        {!d.viva ? (
          <p className="mt-2 text-ink-3">No viva yet.</p>
        ) : (
          <ol className="mt-3 space-y-4">
            {d.viva.questions.map((q, i) => (
              <li key={i} className="border-l-2 border-line pl-3.5">
                <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">
                  Q{i + 1} · {KIND_LABEL[q.kind] ?? q.kind}
                  {q.secondsTaken != null && ` · answered in ${q.secondsTaken} s of ${q.secondsAllowed}`}
                  {q.late && " · after the time limit"}
                  {q.awayMs > 0 && ` · left the page for ${fmtOffset(q.awayMs)}`}
                </p>
                <p className="mt-0.5 font-medium"><Code text={q.prompt} /></p>
                <p className="mt-1 text-ink-2">{q.answer ? `“${q.answer}”` : <em className="text-ink-3">No answer</em>}</p>
                {q.check && (
                  <p className={cx("mt-1 flex items-center gap-1.5 text-sm", q.check.predicted_match ? "text-done" : "text-danger")}>
                    {q.check.predicted_match ? <CheckCircle2 className="size-4" aria-hidden /> : <XCircle className="size-4" aria-hidden />}
                    Running their own code on <code className="font-mono">{q.check.call}</code> gives <code className="font-mono">{q.check.actual}</code>:{" "}
                    {q.check.predicted_match ? "their prediction matched" : "their prediction didn't match"}
                  </p>
                )}
                {q.score != null && <p className="mt-1 text-sm text-ink-3">{q.score}/10 · {q.feedback}</p>}
              </li>
            ))}
          </ol>
        )}
      </Card>

      {!compact && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="font-semibold">Hidden tests</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {d.tests.map((t) => (
                <li key={t.name} className="flex items-start gap-2">
                  {t.passed ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-done" aria-label="Passed" /> : t.passed === false ? <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-label="Failed" /> : <CircleHelp className="mt-0.5 size-4 shrink-0 text-ink-3" aria-label="Not run" />}
                  <span>
                    <span className="font-medium">{t.name}</span> <code className="font-mono text-ink-3">{t.call}</code>
                    <span className="block text-ink-3">expected <code className="font-mono">{t.expected}</code>{t.actual != null && <> · got <code className="font-mono">{t.actual}</code></>}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <h3 className="font-semibold">Conversation with Ustaad</h3>
            {d.messages.length === 0 ? (
              <p className="mt-2 text-ink-3">The student didn't ask Ustaad for help.</p>
            ) : (
              <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto text-sm">
                {d.messages.map((m, i) => (
                  <li key={i}>
                    <span className="font-semibold">{m.role === "student" ? d.student.name.split(" ")[0] : "Ustaad"}:</span> {m.text}
                    {m.hint && <span className="block text-ink-3">Hint: {m.hint}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

export function Report() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const compare = params.get("compare");
  const back = useApi<ReportData>(`/teacher/submissions/${id}`);

  useEffect(() => {
    document.title = `${compare ? "Compare submissions" : "Integrity report"} · Socratic AI`;
  }, [compare]);

  const assignmentId = back.status === "ready" ? back.data.assignment.id : null;
  return (
    <AppShell>
      <Link to={assignmentId ? `/teacher/assignments/${assignmentId}` : "/teacher"} className="mb-4 inline-flex items-center gap-1.5 font-medium text-action hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> {back.status === "ready" ? `${back.data.assignment.title}: all submissions` : "Back"}
      </Link>
      <h1 className="mb-5 text-2xl font-bold tracking-tight">{compare ? "Side by side" : "Integrity report"}</h1>
      {compare ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <ReportColumn id={id} compact />
          <ReportColumn id={compare} compact />
        </div>
      ) : (
        <ReportColumn id={id} />
      )}
    </AppShell>
  );
}
