import { describe, expect, it } from "vitest";
import { isOwnCode, journeyStates, type RawStep } from "./journey";

const steps = (done: boolean[]): RawStep[] =>
  ["understand", "write", "run", "explain", "submit"].map((key, i) => ({ key, label: key, done: done[i]!, ...(key === "submit" ? { lockedHint: "Ustaad must check your explanation first" } : {}) }));

describe("the journey stepper runs in order", () => {
  it("never shows a done step after a step that isn't done", () => {
    // Run pressed before writing anything: run is "done" in isolation, but Understand and Write are not.
    const s = journeyStates(steps([false, false, true, false, false]));
    expect(s.map((x) => x.state)).toEqual(["current", "upcoming", "upcoming", "upcoming", "locked"]);
  });

  it("marks steps done from the start until the first open one", () => {
    const s = journeyStates(steps([true, true, true, false, false]));
    expect(s.map((x) => x.state)).toEqual(["done", "done", "done", "current", "locked"]);
  });

  it("keeps the locked reason for steps after the current one", () => {
    const s = journeyStates(steps([true, false, false, false, false]));
    expect(s[4]).toEqual({ key: "submit", label: "submit", state: "locked", hint: "Ustaad must check your explanation first" });
  });

  it("everything done", () => {
    expect(journeyStates(steps([true, true, true, true, true])).every((x) => x.state === "done")).toBe(true);
  });
});

describe("a run of the untouched starter code isn't the student's Run", () => {
  it("compares with the starter code, ignoring surrounding whitespace", () => {
    expect(isOwnCode("def f():\n    pass\n", "def f():\n    pass")).toBe(false);
    expect(isOwnCode("def f():\n    return 1", "def f():\n    pass")).toBe(true);
  });
});
