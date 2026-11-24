/**
 * Timed quizzes (FR-13): one question at a time, a per-student draw from the question pool, shuffled
 * question and option order, marked on the server. Answer keys never reach the browser.
 * Pure functions here so they can be unit-tested; the API lives in server/routes/quiz.ts.
 */

export type QuizKind = "mcq" | "short";

/** One question in the teacher's pool (server side, including its answer key). */
export interface QuizQuestionRow {
  id: string;
  position: number;
  kind: QuizKind;
  prompt_md: string;
  options: string[] | null;
  answer_key: { correct: number } | { accepted: string[] };
  marks: number;
}

/** The student's quiz, stored as JSON in submissions.content. */
export interface QuizState {
  v: 1;
  order: string[];                           // question ids drawn for this student, in their order
  optionOrder: Record<string, number[]>;     // per mcq: display position → original option index
  answers: Record<string, { value: number | string | null; atMs: number }>; // atMs = ms since startedAt (server clock)
  startedAt: string;                         // server time
  current: number;                           // index into order
  finishedAt: string | null;
}

/** A small deterministic PRNG (mulberry32) so a student's draw can be re-derived from a seed. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A 32-bit seed from a string (e.g. the submission id). */
export function seedFrom(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function shuffled<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Draws `draw` questions from the pool (all when draw is missing or too big) and shuffles everything. */
export function newQuizState(pool: Pick<QuizQuestionRow, "id" | "kind" | "options">[], draw: number | null | undefined, seed: number, startedAt: string): QuizState {
  const rand = prng(seed);
  const n = draw && draw > 0 ? Math.min(draw, pool.length) : pool.length;
  const order = shuffled(pool, rand).slice(0, n);
  const optionOrder: Record<string, number[]> = {};
  for (const q of order) {
    if (q.kind === "mcq" && q.options) optionOrder[q.id] = shuffled(q.options.map((_, i) => i), rand);
  }
  return { v: 1, order: order.map((q) => q.id), optionOrder, answers: {}, startedAt, current: 0, finishedAt: null };
}

/** Case, spacing, punctuation and quotes don't matter for short answers; the words do. */
export function normaliseShort(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/["'`“”‘’]/g, "")
    .replace(/[.,;:!?()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isCorrect(q: Pick<QuizQuestionRow, "kind" | "answer_key">, value: number | string | null | undefined): boolean {
  if (value == null || value === "") return false;
  if (q.kind === "mcq") return "correct" in q.answer_key && typeof value === "number" && value === q.answer_key.correct;
  if (!("accepted" in q.answer_key) || typeof value !== "string") return false;
  const v = normaliseShort(value);
  return q.answer_key.accepted.some((a) => normaliseShort(a) === v);
}

export interface QuizMark {
  perQuestion: { id: string; correct: boolean; answered: boolean; marks: number; earned: number }[];
  correct: number;
  total: number;
  earned: number;
  possible: number;
}

export function markQuiz(state: QuizState, questions: Pick<QuizQuestionRow, "id" | "kind" | "answer_key" | "marks">[]): QuizMark {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const perQuestion = state.order.map((id) => {
    const q = byId.get(id);
    const value = state.answers[id]?.value;
    const correct = q ? isCorrect(q, value) : false;
    const marks = q?.marks ?? 0;
    return { id, correct, answered: value != null && value !== "", marks, earned: correct ? marks : 0 };
  });
  return {
    perQuestion,
    correct: perQuestion.filter((p) => p.correct).length,
    total: perQuestion.length,
    earned: perQuestion.reduce((n, p) => n + p.earned, 0),
    possible: perQuestion.reduce((n, p) => n + p.marks, 0),
  };
}

/** Seconds left on the quiz clock (server time). A short grace covers network delay on the last answer. */
export const QUIZ_GRACE_SECONDS = 10;
export function quizSecondsLeft(state: QuizState, limitMinutes: number | null, now = Date.now()): number | null {
  if (!limitMinutes) return null;
  return Math.max(0, Math.round((Date.parse(state.startedAt) + limitMinutes * 60_000 - now) / 1000));
}
export function quizTimeUp(state: QuizState, limitMinutes: number | null, now = Date.now()): boolean {
  if (!limitMinutes) return false;
  return now > Date.parse(state.startedAt) + limitMinutes * 60_000 + QUIZ_GRACE_SECONDS * 1000;
}

export function parseQuizState(content: string): QuizState | null {
  try {
    const s = JSON.parse(content) as QuizState;
    return s && s.v === 1 && Array.isArray(s.order) ? s : null;
  } catch {
    return null;
  }
}
