/**
 * The teacher's question pool for a timed quiz. Each student gets a draw from this pool, in their
 * own order, with the options shuffled. Answer keys stay on the server.
 */
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { Button, Card, Segmented, cx } from "../components/ui";

export type QuizDraftQuestion =
  | { kind: "mcq"; prompt: string; options: string[]; correct: number }
  | { kind: "short"; prompt: string; accepted: string };

export const blankQuestion = (): QuizDraftQuestion => ({ kind: "mcq", prompt: "", options: ["", "", "", ""], correct: 0 });

export const questionReady = (q: QuizDraftQuestion) =>
  q.prompt.trim().length >= 3 && (q.kind === "mcq" ? q.options.filter((o) => o.trim()).length >= 2 && Boolean(q.options[q.correct]?.trim()) : q.accepted.split(",").some((a) => a.trim()));

/** The payload the API expects (empty options dropped, the correct index kept pointing at the same text). */
export function toPayload(q: QuizDraftQuestion) {
  if (q.kind === "short") return { kind: "short" as const, prompt: q.prompt.trim(), accepted: q.accepted.split(",").map((a) => a.trim()).filter(Boolean) };
  const kept = q.options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o);
  return { kind: "mcq" as const, prompt: q.prompt.trim(), options: kept.map((x) => x.o), correct: Math.max(0, kept.findIndex((x) => x.i === q.correct)) };
}

const field = "min-h-11 w-full rounded-lg border border-line-strong bg-surface px-3 focus:border-action focus:outline-none";

export function QuizEditor({ questions, onChange }: { questions: QuizDraftQuestion[]; onChange: (qs: QuizDraftQuestion[]) => void }) {
  const set = (i: number, q: QuizDraftQuestion) => onChange(questions.map((x, j) => (j === i ? q : x)));
  const ready = questions.filter(questionReady).length;
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Question pool</h2>
          <p className="text-sm text-ink-3">Write more questions than each student answers: everyone gets their own draw, in their own order, with options shuffled.</p>
        </div>
        <span className="text-sm font-medium text-ink-2">{ready} of {questions.length} ready</span>
      </div>
      <ol className="mt-4 space-y-4">
        {questions.map((q, i) => (
          <li key={i} className={cx("rounded-xl border p-4", questionReady(q) ? "border-line" : "border-attention-line")}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">Question {i + 1}</span>
              <div className="flex items-center gap-2">
                <Segmented
                  label={`Question ${i + 1} kind`}
                  value={q.kind}
                  onChange={(k) => set(i, k === "mcq" ? { kind: "mcq", prompt: q.prompt, options: ["", "", "", ""], correct: 0 } : { kind: "short", prompt: q.prompt, accepted: "" })}
                  options={[{ value: "mcq", label: "Multiple choice" }, { value: "short", label: "Short answer" }]}
                />
                <button type="button" onClick={() => onChange(questions.filter((_, j) => j !== i))} disabled={questions.length <= 1} aria-label={`Remove question ${i + 1}`} className="flex size-10 items-center justify-center rounded-lg text-ink-3 hover:bg-danger-soft hover:text-danger disabled:opacity-30">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
            <input aria-label={`Question ${i + 1}`} value={q.prompt} onChange={(e) => set(i, { ...q, prompt: e.target.value })} maxLength={500} placeholder="e.g. A stack follows which order? Use `code` for code." className={field} />
            {q.kind === "mcq" ? (
              <fieldset className="mt-3 grid gap-2 sm:grid-cols-2">
                <legend className="sr-only">Options for question {i + 1}; pick the correct one</legend>
                {q.options.map((o, k) => (
                  <label key={k} className={cx("flex items-center gap-2 rounded-lg border px-2.5", q.correct === k ? "border-done-line bg-done-soft" : "border-line")}>
                    <input type="radio" name={`correct-${i}`} checked={q.correct === k} onChange={() => set(i, { ...q, correct: k })} aria-label={`Option ${String.fromCharCode(65 + k)} is correct`} className="size-4 accent-[var(--color-done)]" />
                    <span className="text-sm font-bold text-ink-3">{String.fromCharCode(65 + k)}</span>
                    <input value={o} onChange={(e) => set(i, { ...q, options: q.options.map((x, j) => (j === k ? e.target.value : x)) })} maxLength={200} placeholder={k < 2 ? "Option" : "Option (optional)"} className="min-h-10 flex-1 bg-transparent focus:outline-none" />
                    {q.correct === k && <CheckCircle2 className="size-4 shrink-0 text-done" aria-label="Correct answer" />}
                  </label>
                ))}
              </fieldset>
            ) : (
              <label className="mt-3 block">
                <span className="mb-1 block text-sm text-ink-2">Accepted answers, separated by commas (case and punctuation don't matter)</span>
                <input value={q.accepted} onChange={(e) => set(i, { ...q, accepted: e.target.value })} maxLength={300} placeholder="e.g. len, len()" className={field} />
              </label>
            )}
          </li>
        ))}
      </ol>
      <Button variant="ghost" icon={Plus} className="mt-3" onClick={() => onChange([...questions, blankQuestion()])} disabled={questions.length >= 50}>
        Add a question
      </Button>
    </Card>
  );
}
