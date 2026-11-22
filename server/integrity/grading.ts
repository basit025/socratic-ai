/**
 * Hidden-test marking and the suggested grade. Pure functions (unit-tested).
 * Expected values live only on the server; the browser sends back what the student's code returned.
 */

export interface HiddenTest {
  name: string;
  call: string;
  expected: string | Record<string, string>; // repr(), or per variant option
}

export interface BrowserTestResult {
  call: string;
  ok: boolean;
  repr?: string;
  error?: string;
}

export interface MarkedTest {
  name: string;
  passed: boolean;
  actual: string;          // what the student's code returned (their own output, not secret)
}

export function expectedFor(test: HiddenTest, variantOption: string | null): string | null {
  if (typeof test.expected === "string") return test.expected;
  if (variantOption != null && test.expected[variantOption] != null) return test.expected[variantOption]!;
  const first = Object.values(test.expected)[0];
  return first ?? null;
}

const normalise = (s: string) => s.trim().replace(/\s+/g, " ");

/** Marks each hidden test. A missing or failed browser result counts as not passed. */
export function markTests(tests: HiddenTest[], results: BrowserTestResult[], variantOption: string | null): MarkedTest[] {
  const byCall = new Map(results.map((r) => [r.call, r]));
  return tests.map((t) => {
    const r = byCall.get(t.call);
    const expected = expectedFor(t, variantOption);
    const actual = r ? (r.ok ? (r.repr ?? "") : `Error: ${r.error ?? "unknown"}`) : "Not run";
    return { name: t.name, passed: Boolean(r?.ok && expected != null && normalise(r.repr ?? "") === normalise(expected)), actual: actual.slice(0, 300) };
  });
}

/**
 * Suggested grade = marks × (tests share × (100 − viva weight) + viva score × viva weight) / 100.
 * No tests → the viva carries everything; no viva → the tests carry everything.
 */
export function suggestedGrade(opts: { marks: number; testsPassed: number | null; testsTotal: number | null; vivaScore: number | null; vivaWeight: number }): number {
  const { marks, testsPassed, testsTotal, vivaScore } = opts;
  const hasTests = testsTotal != null && testsTotal > 0;
  const hasViva = vivaScore != null && opts.vivaWeight > 0;
  const testShare = hasTests ? (testsPassed ?? 0) / testsTotal! : 0;
  let pct: number;
  if (hasTests && hasViva) pct = testShare * (100 - opts.vivaWeight) + (vivaScore / 100) * opts.vivaWeight;
  else if (hasTests) pct = testShare * 100;
  else if (hasViva) pct = vivaScore;
  else pct = 0;
  return Math.round((marks * pct) / 100 * 10) / 10;
}
