import { describe, expect, it } from "vitest";
import { fallbackQuestion, predictionMatches, questionPrompt, reconcileScore, validInputCall, type VivaScore } from "./viva.js";

const code = "def over_summary(balls):\n    total = 0\n    for r in balls:\n        total += r\n    return (total, 0)\n";

describe("viva helpers", () => {
  it("only accepts a plain call to a function the student defined", () => {
    expect(validInputCall("over_summary([6, 0, 4])", code)).toBe(true);
    expect(validInputCall("print(1)", code)).toBe(false);
    expect(validInputCall("over_summary([1]); import os", code)).toBe(false);
    expect(validInputCall("__import__('os')", code)).toBe(false);
    expect(validInputCall(null, code)).toBe(false);
    expect(validInputCall("f([1])", "f = lambda b: (sum(b), 0)")).toBe(true);
    // JavaScript
    expect(validInputCall("countVowels('chai')", "function countVowels(word) {\n  return 0;\n}")).toBe(true);
    expect(validInputCall("total([1, 2])", "const total = (xs) => xs.reduce((a, b) => a + b, 0);")).toBe(true);
    expect(validInputCall("alert(1)", "function countVowels(word) { return 0; }")).toBe(false);
  });

  it("matches predictions loosely on spacing and quotes, strictly on values", () => {
    expect(predictionMatches("It returns (10, 1)", "(10, 1)")).toBe(true);
    expect(predictionMatches("(10,1) hoga", "(10, 1)")).toBe(true);
    expect(predictionMatches("(10, 2)", "(10, 1)")).toBe(false);
    expect(predictionMatches("", "(0, 0)")).toBe(false);
  });

  it("falls back to a question about a real line of the student's code", () => {
    expect(fallbackQuestion("explain_line", code).prompt).toContain("`total += r`");
    expect(fallbackQuestion("modify", code).prompt).toMatch(/change your code/);
  });

  it("keeps the overall score traceable to the answers", () => {
    const score = (goal: number, logic: number, out: number, mod: number, per: number[]): VivaScore => ({
      rubric: { goal, logic, output_prediction: out, modification: mod },
      per_question: per.map((p) => ({ score: p, feedback: "" })),
      teacher_summary: "",
      revise_next: "",
    });
    const q = (answer: string, match?: boolean) => ({
      kind: "explain_line" as const, prompt: "?", input_call: null, seconds_allowed: 90, asked_at: "", answer,
      ...(match === undefined ? {} : { auto_check: { call: "f()", actual: "1", predicted_match: match } }),
    });
    // The copier case: answers scored 0, 0, 7 but the model's rubric said 60.
    const copier = reconcileScore(score(20, 10, 15, 15, [0, 0, 7]), [q(""), q("(0, 1)", false), q("add a counter")]);
    expect(copier.understanding).toBe(Math.round((7 / 3) * 10 + 15));
    const r = copier.score.rubric;
    expect(r.goal + r.logic + r.output_prediction + r.modification).toBe(copier.understanding);
    // An honest student the model under-scored is lifted to within the same gap.
    const honest = reconcileScore(score(10, 10, 10, 10, [9, 10, 9]), [q("a"), q("1", true), q("b")]);
    expect(honest.understanding).toBe(Math.round((28 / 3) * 10 - 15));
    // Ground truth beats the model for that question too.
    const wrong = reconcileScore(score(20, 20, 20, 20, [9, 9, 9]), [q("a"), q("2", false), q("b")]);
    expect(wrong.score.per_question[1]!.score).toBe(3);
    // A consistent score is left alone.
    expect(reconcileScore(score(23, 22, 25, 20, [9, 10, 9]), [q("a"), q("1", true), q("b")]).understanding).toBe(90);
  });
});

describe("viva questions don't re-ask what the student already said (T08)", () => {
  const base = { title: "Cricket Over Tracker", instructions: "An empty over has scored nothing yet.", code, testsSummary: "5/5", previous: [], sandboxId: "s", kind: "predict_output" as const };

  it("passes the student's chat with Ustaad to the question writer", () => {
    const p = questionPrompt({ ...base, discussed: ["Empty list gives (0, 0)."] });
    expect(p).toContain("<chat_with_ustaad>");
    expect(p).toContain("Empty list gives (0, 0).");
  });

  it("tells the writer not to reuse a case the brief or chat already mentions", () => {
    expect(questionPrompt(base)).toMatch(/Never use an input or case that the brief or the student's chat with Ustaad already mentions/);
  });

  it("leaves the chat block out when there was no chat", () => {
    expect(questionPrompt(base)).not.toContain("<chat_with_ustaad>");
  });
});
