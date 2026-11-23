/**
 * Page-side controller for JavaScript: one fresh worker per run, terminated after RUN_TIMEOUT_MS.
 * Same interface as the Python runner, so screens don't care which language they run.
 */
import type { RunOutcome, RunnerRequest, RunnerResponse, TestOutcome } from "./protocol";
import { RUN_TIMEOUT_MS, runner as pythonRunner } from "./runner";

const TIMEOUT_MESSAGE = "Your code ran for more than 5 seconds, so it was stopped. Check for a loop that never ends.";

function once(req: Extract<RunnerRequest, { id: number }>): Promise<{ msg: RunnerResponse | null; timedOut: boolean }> {
  return new Promise((resolve) => {
    const w = new Worker(new URL("./jsWorker.ts", import.meta.url), { type: "module" });
    const timer = setTimeout(() => {
      w.terminate();
      resolve({ msg: null, timedOut: true });
    }, RUN_TIMEOUT_MS);
    w.onmessage = (e: MessageEvent<RunnerResponse>) => {
      clearTimeout(timer);
      w.terminate();
      resolve({ msg: e.data, timedOut: false });
    };
    w.onerror = (e) => {
      clearTimeout(timer);
      w.terminate();
      e.preventDefault();
      resolve({ msg: { type: "run_result", id: req.id, ok: false, output: "", error: e.message || "SyntaxError", durationMs: 0 }, timedOut: false });
    };
    w.postMessage(req);
  });
}

let nextId = 1;

export const jsRunner = {
  async run(code: string): Promise<RunOutcome> {
    const { msg, timedOut } = await once({ type: "run", id: nextId++, code });
    if (timedOut || !msg) return { ok: false, output: "", error: TIMEOUT_MESSAGE, durationMs: RUN_TIMEOUT_MS, timedOut: true };
    if (msg.type !== "run_result") return { ok: false, output: "", error: "Unexpected runner reply.", durationMs: 0 };
    return { ok: msg.ok, output: msg.output, error: msg.error, durationMs: msg.durationMs };
  },
  async runTests(code: string, calls: string[]): Promise<TestOutcome> {
    const { msg, timedOut } = await once({ type: "tests", id: nextId++, code, calls });
    if (timedOut || !msg) return { ok: false, results: [], error: TIMEOUT_MESSAGE, durationMs: RUN_TIMEOUT_MS, timedOut: true };
    if (msg.type === "test_result") return { ok: msg.ok, results: msg.results, error: msg.error, durationMs: msg.durationMs };
    return { ok: false, results: [], error: msg.type === "run_result" ? msg.error : "Unexpected runner reply.", durationMs: 0 };
  },
};

export interface CodeRunner {
  run(code: string): Promise<RunOutcome>;
  runTests(code: string, calls: string[]): Promise<TestOutcome>;
}

/** The runner for an assignment's language. JavaScript is always ready; Python needs Pyodide loaded. */
export function runnerFor(language: string | null): CodeRunner {
  return language === "javascript" ? jsRunner : pythonRunner;
}
