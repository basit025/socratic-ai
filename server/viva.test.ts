import { describe, expect, it } from "vitest";
import { fallbackQuestion, predictionMatches, validInputCall } from "./viva.js";

const code = "def over_summary(balls):\n    total = 0\n    for r in balls:\n        total += r\n    return (total, 0)\n";

describe("viva helpers", () => {
  it("only accepts a plain call to a function the student defined", () => {
    expect(validInputCall("over_summary([6, 0, 4])", code)).toBe(true);
    expect(validInputCall("print(1)", code)).toBe(false);
    expect(validInputCall("over_summary([1]); import os", code)).toBe(false);
    expect(validInputCall("__import__('os')", code)).toBe(false);
    expect(validInputCall(null, code)).toBe(false);
    expect(validInputCall("f([1])", "f = lambda b: (sum(b), 0)")).toBe(true);
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
});
