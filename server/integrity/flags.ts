/**
 * Rule-based integrity flags (FR-23). Evidence for the teacher, never a verdict: each flag is a plain
 * sentence plus the seq range it came from, so "Show me" can jump to that moment in the replay.
 * Pure function over the event log (unit-tested). No AI, no text detection.
 */
import type { ProcessEvent } from "../../shared/events.js";

export type FlagRule = "large_insertion" | "typing_faster_than_baseline" | "focus_loss_then_burst" | "correct_without_runs" | "perfect_tests_low_viva";

export interface Flag {
  rule: FlagRule;
  severity: "low" | "medium" | "high";
  message: string;
  evidence: { from_seq: number; to_seq: number; t: number; [k: string]: unknown };
}

export const THRESHOLDS = {
  largeInsertionChars: 40,        // one instant insertion this big can't be typed
  fastCps: 7,                      // characters per second that count as "fast" for a burst
  fastFactor: 2.5,                 // ... and this many times the student's own median pace
  fastMinChars: 120,               // ... over at least this many characters
  defaultBaselineCps: 3,           // a typical student's coding pace, used when we have none of their own
  focusAwayMs: 60_000,             // leaving the tab for at least a minute ...
  burstWindowMs: 60_000,           // ... then within a minute of returning ...
  burstChars: 100,                 // ... typing at least this much
  lowViva: 50,
} as const;

const clock = (t: number) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Karachi", hour: "numeric", minute: "2-digit" }).format(t);

const duration = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ""}`;
};

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export interface FlagInput {
  events: ProcessEvent[];
  testsPassed: number | null;
  testsTotal: number | null;
  vivaScore: number | null;
  /** The student's median pace from their OTHER submissions. Never measured from this one: if the
   *  whole answer was retyped, its own pace would look normal. */
  baselineCps?: number | null;
}

export function computeFlags({ events, testsPassed, testsTotal, vivaScore, baselineCps }: FlagInput): Flag[] {
  const ev = [...events].sort((a, b) => a.seq - b.seq);
  const flags: Flag[] = [];

  // 1. Large instant insertion: a single change inserting a big block at once.
  for (const e of ev) {
    if (e.type !== "keys") continue;
    const big = e.payload.changes.reduce((m, c) => Math.max(m, c.insert.length), 0);
    if (big >= THRESHOLDS.largeInsertionChars) {
      const lines = e.payload.changes.find((c) => c.insert.length === big)!.insert.split("\n").length;
      flags.push({
        rule: "large_insertion",
        severity: "high",
        message: `${big} characters (${lines} line${lines === 1 ? "" : "s"}) appeared in a single instant at ${clock(e.t)}, which can't be typed by hand.`,
        evidence: { from_seq: e.seq, to_seq: e.seq, t: e.t, chars: big },
      });
      break; // one is enough evidence; the replay shows the rest
    }
  }

  // 2. Typing much faster than this student's own pace.
  const keys = ev.filter((e): e is Extract<ProcessEvent, { type: "keys" }> => e.type === "keys");
  const speeds: { e: (typeof keys)[number]; cps: number }[] = [];
  for (let i = 1; i < keys.length; i++) {
    const dt = Math.max(500, keys[i]!.t - keys[i - 1]!.t);
    speeds.push({ e: keys[i]!, cps: keys[i]!.payload.chars / (dt / 1000) });
  }
  const ownBaseline = baselineCps != null && baselineCps > 0;
  const baseline = ownBaseline ? Math.max(1, baselineCps) : THRESHOLDS.defaultBaselineCps;
  let run: typeof speeds = [];
  const fastRuns: (typeof speeds)[] = [];
  for (const s of speeds) {
    if (s.cps >= THRESHOLDS.fastCps && s.cps >= baseline * THRESHOLDS.fastFactor) run.push(s);
    else {
      if (run.length) fastRuns.push(run);
      run = [];
    }
  }
  if (run.length) fastRuns.push(run);
  const worst = fastRuns
    .map((r) => ({ r, chars: r.reduce((n, s) => n + s.e.payload.chars, 0) }))
    .filter((x) => x.chars >= THRESHOLDS.fastMinChars)
    .sort((a, b) => b.chars - a.chars)[0];
  if (worst) {
    const cps = worst.r.reduce((n, s) => n + s.cps, 0) / worst.r.length;
    flags.push({
      rule: "typing_faster_than_baseline",
      severity: "medium",
      message: `Typed ${worst.chars} characters at about ${cps.toFixed(0)} characters per second around ${clock(worst.r[0]!.e.t)}, roughly ${(cps / baseline).toFixed(0)}× ${ownBaseline ? "this student's usual pace" : "a typical student's pace"}.`,
      evidence: { from_seq: worst.r[0]!.e.seq, to_seq: worst.r.at(-1)!.e.seq, t: worst.r[0]!.e.t, cps: Math.round(cps), baseline_cps: Math.round(baseline * 10) / 10 },
    });
  }

  // 3. Long focus loss, then a burst of typing soon after returning.
  for (const e of ev) {
    if (e.type !== "focus_back" || e.payload.awayMs < THRESHOLDS.focusAwayMs) continue;
    const after = keys.filter((k) => k.t > e.t && k.t <= e.t + THRESHOLDS.burstWindowMs);
    const chars = after.reduce((n, k) => n + k.payload.chars, 0);
    if (chars >= THRESHOLDS.burstChars) {
      flags.push({
        rule: "focus_loss_then_burst",
        severity: "medium",
        message: `Left the page for ${duration(e.payload.awayMs)}, then typed ${chars} characters within a minute of coming back (at ${clock(e.t)}).`,
        evidence: { from_seq: e.seq, to_seq: after.at(-1)!.seq, t: e.t, away_ms: e.payload.awayMs, chars },
      });
      break;
    }
  }

  const allPassed = testsTotal != null && testsTotal > 0 && testsPassed === testsTotal;
  const submit = ev.find((e) => e.type === "submit");
  const last = submit ?? ev.at(-1);

  // 4. Correct submission with no runs at all.
  if (allPassed && !ev.some((e) => e.type === "run") && last) {
    flags.push({
      rule: "correct_without_runs",
      severity: "medium",
      message: "All hidden tests passed, but the code was never run before it was submitted.",
      evidence: { from_seq: ev[0]?.seq ?? last.seq, to_seq: last.seq, t: last.t },
    });
  }

  // 5. Perfect tests, weak viva.
  if (allPassed && vivaScore != null && vivaScore < THRESHOLDS.lowViva && last) {
    flags.push({
      rule: "perfect_tests_low_viva",
      severity: "high",
      message: `All hidden tests passed, but the viva score was ${vivaScore}/100: the student couldn't explain their own code.`,
      evidence: { from_seq: last.seq, to_seq: last.seq, t: last.t, viva_score: vivaScore },
    });
  }

  return flags;
}
