import { describe, expect, it } from "vitest";
import { computeFlags } from "./flags.js";
import { markTests, suggestedGrade, type HiddenTest } from "./grading.js";
import type { ProcessEvent } from "../../shared/events.js";

const T0 = 1_795_400_000_000;
let seq = 0;
const keys = (t: number, text: string): ProcessEvent => ({ seq: ++seq, t, type: "keys", payload: { changes: [...text].map((ch, i) => ({ from: i, to: i, insert: ch })), chars: text.length } });
const blob = (t: number, text: string): ProcessEvent => ({ seq: ++seq, t, type: "keys", payload: { changes: [{ from: 0, to: 0, insert: text }], chars: text.length } });
const run = (t: number, ok = true): ProcessEvent => ({ seq: ++seq, t, type: "run", payload: { ok, durationMs: 5, docLength: 100 } });
const away = (t: number, ms: number): ProcessEvent[] => [
  { seq: ++seq, t, type: "focus_lost", payload: {} },
  { seq: ++seq, t: t + ms, type: "focus_back", payload: { awayMs: ms } },
];
const submit = (t: number): ProcessEvent => ({ seq: ++seq, t, type: "submit", payload: { docLength: 100 } });

describe("flags", () => {
  it("raises nothing for an honest, messy session", () => {
    seq = 0;
    const events: ProcessEvent[] = [];
    let t = T0;
    for (let i = 0; i < 30; i++) events.push(keys((t += 6000), "abcdefghij".slice(0, 6 + (i % 4)))); // ~1.3 cps
    events.push(run((t += 2000), false), run((t += 30000), true));
    for (let i = 0; i < 10; i++) events.push(keys((t += 5000), "fixit"));
    events.push(run((t += 3000)), submit((t += 5000)));
    expect(computeFlags({ events, testsPassed: 5, testsTotal: 5, vivaScore: 85 })).toEqual([]);
  });

  it("flags a retyped answer: long absence, fast steady burst, no runs, weak viva", () => {
    seq = 0;
    let t = T0;
    const events: ProcessEvent[] = [keys((t += 4000), "def ")];
    events.push(...away((t += 2000), 180_000));
    t += 180_000;
    for (let i = 0; i < 12; i++) events.push(keys((t += 1500), "x".repeat(16))); // ~10.7 cps for 192 chars
    events.push(submit((t += 3000)));
    const rules = computeFlags({ events, testsPassed: 5, testsTotal: 5, vivaScore: 20 }).map((f) => f.rule);
    expect(rules).toEqual(expect.arrayContaining(["focus_loss_then_burst", "typing_faster_than_baseline", "correct_without_runs", "perfect_tests_low_viva"]));
  });

  it("flags a block that appeared in one instant, with a readable sentence and the seq to jump to", () => {
    seq = 0;
    const events = [keys(T0, "d"), blob(T0 + 2000, "def over_summary(balls):\n    return (sum(balls), 0)\n"), run(T0 + 5000)];
    const [flag] = computeFlags({ events, testsPassed: 2, testsTotal: 5, vivaScore: 70 });
    expect(flag?.rule).toBe("large_insertion");
    expect(flag?.message).toMatch(/characters \(3 lines\) appeared in a single instant/);
    expect(flag?.evidence.from_seq).toBe(2);
  });
});

const tests: HiddenTest[] = [
  { name: "Example", call: "f([1, 4])", expected: { "4": "(5, 1)", "6": "(5, 0)" } },
  { name: "Empty", call: "f([])", expected: "(0, 0)" },
  { name: "Crash", call: "f(None)", expected: "(0, 0)" },
];

describe("grading", () => {
  it("flags leaving a timed quiz, and never raises code flags on a perfect quiz", () => {
    const fsExit = (t: number): ProcessEvent => ({ seq: ++seq, t, type: "fullscreen_exit", payload: {} });
    const clean = [submit(T0 + 1000)];
    expect(computeFlags({ events: clean, testsPassed: 5, testsTotal: 5, vivaScore: null, quiz: true })).toEqual([]);
    const events = [fsExit(T0 + 60_000), ...away(T0 + 61_000, 25_000), fsExit(T0 + 200_000), submit(T0 + 300_000)];
    const [f, ...rest] = computeFlags({ events, testsPassed: 5, testsTotal: 5, vivaScore: null, quiz: true });
    expect(rest).toEqual([]);
    expect(f!.rule).toBe("left_quiz_screen");
    expect(f!.severity).toBe("high"); // 3 exits
    expect(f!.message).toMatch(/left fullscreen 2 times and switched away from the tab once, 25 s away/);
    expect(f!.evidence.from_seq).toBe(events[0]!.seq);
  });

  it("marks against the student's own variant", () => {
    const results = [
      { call: "f([1, 4])", ok: true, repr: "(5, 0)" },
      { call: "f([])", ok: true, repr: "(0,  0)" },
      { call: "f(None)", ok: false, error: "TypeError" },
    ];
    expect(markTests(tests, results, "6").map((m) => m.passed)).toEqual([true, true, false]);
    expect(markTests(tests, results, "4").map((m) => m.passed)).toEqual([false, true, false]);
  });

  it("treats tests the browser never ran as failed", () => {
    expect(markTests(tests, [], "4").every((m) => !m.passed && m.actual === "Not run")).toBe(true);
  });

  it("weights tests and viva as the teacher set", () => {
    expect(suggestedGrade({ marks: 10, testsPassed: 5, testsTotal: 5, vivaScore: 20, vivaWeight: 50 })).toBe(6);
    expect(suggestedGrade({ marks: 10, testsPassed: 4, testsTotal: 5, vivaScore: 90, vivaWeight: 50 })).toBe(8.5);
    expect(suggestedGrade({ marks: 10, testsPassed: null, testsTotal: null, vivaScore: 70, vivaWeight: 50 })).toBe(7);
    expect(suggestedGrade({ marks: 20, testsPassed: 3, testsTotal: 4, vivaScore: null, vivaWeight: 50 })).toBe(15);
  });
});
