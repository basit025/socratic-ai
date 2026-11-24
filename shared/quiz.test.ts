import { describe, expect, it } from "vitest";
import { isCorrect, markQuiz, newQuizState, normaliseShort, parseQuizState, quizSecondsLeft, quizTimeUp, seedFrom } from "./quiz.js";

const pool = [
  { id: "a", kind: "mcq" as const, options: ["1", "2", "3", "4"], answer_key: { correct: 2 }, marks: 1 },
  { id: "b", kind: "short" as const, options: null, answer_key: { accepted: ["len", "len()"] }, marks: 2 },
  { id: "c", kind: "mcq" as const, options: ["yes", "no"], answer_key: { correct: 0 }, marks: 1 },
  { id: "d", kind: "short" as const, options: null, answer_key: { accepted: ["IndentationError"] }, marks: 1 },
  { id: "e", kind: "mcq" as const, options: ["x", "y", "z"], answer_key: { correct: 1 }, marks: 1 },
];

describe("quizzes", () => {
  it("draws a per-student subset in a per-student order, the same every time for the same seed", () => {
    const s1 = newQuizState(pool, 3, seedFrom("student-1"), "2026-11-24T10:00:00Z");
    const again = newQuizState(pool, 3, seedFrom("student-1"), "2026-11-24T10:00:00Z");
    expect(s1.order).toHaveLength(3);
    expect(new Set(s1.order).size).toBe(3);
    expect(again.order).toEqual(s1.order);
    expect(again.optionOrder).toEqual(s1.optionOrder);
    // Different students usually get different papers.
    const papers = new Set(Array.from({ length: 20 }, (_, i) => newQuizState(pool, 3, seedFrom(`s${i}`), "x").order.join()));
    expect(papers.size).toBeGreaterThan(5);
    // Option order is a permutation of the original options.
    for (const [id, perm] of Object.entries(s1.optionOrder)) expect([...perm].sort()).toEqual(pool.find((q) => q.id === id)!.options!.map((_, i) => i));
  });

  it("marks short answers forgivingly on form, strictly on content", () => {
    expect(normaliseShort("  'Len()'. ")).toBe("len");
    expect(isCorrect(pool[1]!, "LEN")).toBe(true);
    expect(isCorrect(pool[1]!, "len()")).toBe(true);
    expect(isCorrect(pool[1]!, "length")).toBe(false);
    expect(isCorrect(pool[3]!, "indentationerror")).toBe(true);
    expect(isCorrect(pool[0]!, 2)).toBe(true);
    expect(isCorrect(pool[0]!, 1)).toBe(false);
    expect(isCorrect(pool[0]!, null)).toBe(false);
  });

  it("adds up marks for the drawn questions only", () => {
    const s = newQuizState(pool, null, 1, "2026-11-24T10:00:00Z");
    s.answers = { a: { value: 2, atMs: 1 }, b: { value: "length", atMs: 2 }, c: { value: 0, atMs: 3 } };
    const m = markQuiz(s, pool);
    expect(m.total).toBe(5);
    expect(m.correct).toBe(2);
    expect(m.earned).toBe(2);
    expect(m.possible).toBe(6);
    expect(m.perQuestion.find((p) => p.id === "d")!.answered).toBe(false);
  });

  it("keeps time on the server clock, with a short grace", () => {
    const s = newQuizState(pool, 2, 1, "2026-11-24T10:00:00Z");
    const t0 = Date.parse(s.startedAt);
    expect(quizSecondsLeft(s, 5, t0 + 60_000)).toBe(240);
    expect(quizTimeUp(s, 5, t0 + 5 * 60_000 + 5_000)).toBe(false);
    expect(quizTimeUp(s, 5, t0 + 5 * 60_000 + 11_000)).toBe(true);
    expect(quizSecondsLeft(s, null)).toBeNull();
    expect(parseQuizState(JSON.stringify(s))).toEqual(s);
    expect(parseQuizState("print('hi')")).toBeNull();
  });
});
