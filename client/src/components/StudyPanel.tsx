/**
 * Study with Ustaad, outside graded work:
 * - StudyChat: ask about the course or the lecture (and the slide on screen). Kept per lecture in this browser.
 * - PracticeQuiz: practice questions made from a lecture, with instant feedback. Never marked.
 */
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { CheckCircle2, GraduationCap, Loader2, RotateCcw, Send, Sparkles, Trash2, XCircle } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { Markdown } from "./Markdown";
import { Appear } from "./Motion";
import { Button, Card, cx } from "./ui";

interface Msg {
  role: "student" | "ustaad";
  text: string;
}

const store = {
  get(k: string): Msg[] {
    try {
      const v = JSON.parse(localStorage.getItem(k) ?? "[]") as unknown;
      return Array.isArray(v) ? (v as Msg[]).slice(-30) : [];
    } catch {
      return [];
    }
  },
  set(k: string, v: Msg[]) {
    try {
      localStorage.setItem(k, JSON.stringify(v.slice(-30)));
    } catch {
      /* private mode: the chat just isn't remembered */
    }
  },
};

export function UstaadAvatar({ className }: { className?: string }) {
  return (
    <span className={cx("flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-action to-violet-600 text-white", className ?? "size-8")} aria-hidden>
      <GraduationCap className="size-[55%]" />
    </span>
  );
}

export function StudyChat({
  courseId, courseCode, week, lectureTitle, getSlide, className,
}: {
  courseId: string;
  courseCode: string;
  week?: number | null;
  lectureTitle?: string;
  /** The slide on screen right now, if any. */
  getSlide?: () => { heading: string; body: string } | null;
  className?: string;
}) {
  const key = `socratic.study.${courseId}.${week ?? "course"}`;
  const [msgs, setMsgs] = useState<Msg[]>(() => store.get(key));
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMsgs(store.get(key));
    setFollowUps([]);
    setError(null);
  }, [key]);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length, sending]);

  const starters =
    week != null
      ? ["Explain this slide in simple words", "Give me a real-life example", "Summarise this lecture in 5 points", "Mujhe yeh concept Urdu mein samjhao"]
      : [`What will I learn in ${courseCode}?`, "Which topics should I revise first?", "Explain the hardest idea so far, simply"];

  const send = async (raw: string) => {
    const t = raw.trim();
    if (!t || sending) return;
    const next = [...msgs, { role: "student" as const, text: t }];
    setMsgs(next);
    setText("");
    setFollowUps([]);
    setSending(true);
    setError(null);
    try {
      const r = await api<{ reply: { text: string; followUps: string[] } }>(`/courses/${courseId}/tutor`, {
        body: { message: t, week: week ?? null, slide: getSlide?.() ?? null, history: msgs.slice(-6) },
      });
      const done = [...next, { role: "ustaad" as const, text: r.reply.text }];
      setMsgs(done);
      store.set(key, done);
      setFollowUps(r.reply.followUps);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach Ustaad. Try again.");
      setMsgs(msgs);
      setText(t);
    } finally {
      setSending(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(text);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(text);
    }
  };
  const clear = () => {
    setMsgs([]);
    setFollowUps([]);
    store.set(key, []);
  };

  return (
    <section aria-label="Study with Ustaad" className={cx("flex flex-col overflow-hidden rounded-xl border border-line bg-surface", className)}>
      <header className="flex items-center gap-3 border-b border-line bg-gradient-to-r from-action-soft to-transparent px-4 py-3">
        <UstaadAvatar />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-tight">Study with Ustaad</h3>
          <p className="truncate text-xs text-ink-3">{lectureTitle ? `Ask anything about “${lectureTitle}”` : `Your AI tutor for ${courseCode}`}</p>
        </div>
        {msgs.length > 0 && (
          <button type="button" onClick={clear} className="flex size-9 items-center justify-center rounded-lg text-ink-3 hover:bg-canvas hover:text-ink" aria-label="Clear this chat" title="Clear this chat">
            <Trash2 className="size-4" aria-hidden />
          </button>
        )}
      </header>

      <div ref={list} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {msgs.length === 0 && (
          <div className="space-y-3">
            <p className="text-[15px] text-ink-2">
              Assalam-o-Alaikum! Stuck on something in {week != null ? "this lecture" : courseCode}? Ask me in English or Roman Urdu. I explain ideas;
              for graded work I give hints, not answers.
            </p>
            <div className="flex flex-wrap gap-2">
              {starters.map((s) => (
                <button key={s} type="button" onClick={() => void send(s)} className="rounded-full border border-line bg-surface px-3 py-1.5 text-left text-sm text-ink-2 hover:border-action hover:bg-action-soft hover:text-action">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) =>
          m.role === "student" ? (
            <Appear key={i} className="ml-auto max-w-[88%]">
              <div className="rounded-2xl rounded-br-md bg-action px-3.5 py-2 text-[15px] whitespace-pre-wrap text-white">{m.text}</div>
            </Appear>
          ) : (
            <Appear key={i} className="flex max-w-[96%] gap-2">
              <UstaadAvatar className="mt-0.5 size-6" />
              <div className="min-w-0 rounded-2xl rounded-tl-md border border-line bg-canvas px-3.5 py-2.5 text-[15px]">
                <Markdown text={m.text} />
              </div>
            </Appear>
          ),
        )}
        {sending && (
          <p className="flex items-center gap-2 text-sm text-ink-3" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Ustaad is thinking…
          </p>
        )}
        {error && <p role="alert" className="rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        {!sending && followUps.length > 0 && (
          <div className="flex flex-wrap gap-2 pl-8">
            {followUps.map((f) => (
              <button key={f} type="button" onClick={() => void send(f)} className="rounded-full border border-line bg-surface px-3 py-1 text-left text-sm text-ink-2 hover:border-action hover:text-action">
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-line p-3">
        <label className="sr-only" htmlFor={`study-${key}`}>Question for Ustaad</label>
        <textarea
          id={`study-${key}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          rows={1}
          maxLength={1500}
          placeholder="Ask Ustaad a question…"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-[15px] focus:border-action focus:outline-none"
        />
        <Button type="submit" icon={Send} disabled={!text.trim() || sending} aria-label="Ask Ustaad" />
      </form>
    </section>
  );
}

// ---------------------------------------------------------------- practice
interface PQ {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

export function PracticeQuiz({ courseId, week, lectureTitle }: { courseId: string; week: number; lectureTitle: string }) {
  const [qs, setQs] = useState<PQ[] | null>(null);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seen = useRef<string[]>([]);

  useEffect(() => {
    setQs(null);
    setPicked({});
    setError(null);
    seen.current = [];
  }, [courseId, week]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api<{ questions: PQ[] }>(`/courses/${courseId}/practice`, { body: { week, count: 5, avoid: seen.current } });
      seen.current = [...seen.current, ...r.questions.map((q) => q.question)].slice(-30);
      setQs(r.questions);
      setPicked({});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't make practice questions. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const answered = qs ? Object.keys(picked).length : 0;
  const right = qs ? qs.filter((q, i) => picked[i] === q.answer).length : 0;

  return (
    <Card className="mt-6 overflow-hidden" as="section">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <span className="flex size-10 items-center justify-center rounded-xl bg-attention-soft text-attention" aria-hidden>
          <Sparkles className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">Check yourself</h3>
          <p className="text-sm text-ink-3">5 practice questions on “{lectureTitle}”, made by Ustaad. Not marked: your teacher doesn't see them.</p>
        </div>
        {qs && (
          <Button variant="secondary" icon={loading ? Loader2 : RotateCcw} onClick={() => void load()} disabled={loading}>
            New questions
          </Button>
        )}
      </div>

      {!qs && (
        <div className="px-5 py-5">
          <Button icon={loading ? Loader2 : Sparkles} onClick={() => void load()} disabled={loading}>
            {loading ? "Ustaad is writing your questions…" : "Quiz me on this lecture"}
          </Button>
          {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
        </div>
      )}

      {qs && (
        <>
          <ol className="divide-y divide-line">
            {qs.map((q, i) => {
              const p = picked[i];
              const done = p != null;
              return (
                <li key={q.question} className="px-5 py-4">
                  <div className="flex gap-2 font-medium">
                    <span className="text-ink-3 tabular-nums">{i + 1}.</span>
                    <Markdown text={q.question} className="min-w-0 flex-1" />
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2" role="group" aria-label={`Question ${i + 1} options`}>
                    {q.options.map((o, j) => {
                      const isRight = j === q.answer;
                      const isPicked = p === j;
                      return (
                        <button
                          key={j}
                          type="button"
                          disabled={done}
                          onClick={() => setPicked({ ...picked, [i]: j })}
                          className={cx(
                            "flex min-h-11 items-start gap-2 rounded-lg border px-3 py-2 text-left text-[15px] transition-colors",
                            !done && "border-line hover:border-action hover:bg-action-soft",
                            done && isRight && "border-done-line bg-done-soft text-ink",
                            done && isPicked && !isRight && "border-danger-line bg-danger-soft text-ink",
                            done && !isRight && !isPicked && "border-line text-ink-3",
                          )}
                        >
                          <span className="mt-0.5 w-5 shrink-0 font-semibold text-ink-3">{String.fromCharCode(65 + j)}</span>
                          <span className="flex-1">{o}</span>
                          {done && isRight && <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-done" aria-label="Correct answer" />}
                          {done && isPicked && !isRight && <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-label="Your answer" />}
                        </button>
                      );
                    })}
                  </div>
                  {done && (
                    <Appear>
                      <p className={cx("mt-2 text-sm", p === q.answer ? "text-done" : "text-ink-2")}>
                        <strong>{p === q.answer ? "Correct. " : `Not quite: the answer is ${String.fromCharCode(65 + q.answer)}. `}</strong>
                        {q.explanation}
                      </p>
                    </Appear>
                  )}
                </li>
              );
            })}
          </ol>
          <div className="flex flex-wrap items-center gap-3 border-t border-line bg-canvas px-5 py-3" aria-live="polite">
            <p className="flex-1 text-sm text-ink-2">
              {answered < qs.length ? `${answered} of ${qs.length} answered` : <><strong className="text-ink">{right} of {qs.length} right.</strong> {right === qs.length ? "Shabash! You've got this lecture." : "Ask Ustaad about the ones you missed."}</>}
            </p>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          </div>
        </>
      )}
    </Card>
  );
}
