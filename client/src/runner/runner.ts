/**
 * Page-side controller for the Python worker.
 * - preload() starts downloading Pyodide in the background (call it early, e.g. on the landing page).
 * - run()/runTests() time out after RUN_TIMEOUT_MS: the worker is terminated and a fresh one starts,
 *   so an infinite loop can never freeze the page.
 */
import { useSyncExternalStore } from "react";
import type { RunOutcome, RunnerRequest, RunnerResponse, TestOutcome } from "./protocol";

export const RUN_TIMEOUT_MS = 5_000;
export type RunnerStatus = "idle" | "loading" | "ready" | "error";

const TIMEOUT_MESSAGE =
  "Your code ran for more than 5 seconds, so it was stopped. Check for a loop that never ends (for example, a while loop whose condition never becomes false).";

type Pending = { resolve: (r: RunnerResponse) => void };

class PythonRunner {
  private worker: Worker | null = null;
  private status: RunnerStatus = "idle";
  private listeners = new Set<() => void>();
  private pending = new Map<number, Pending>();
  private ready: Promise<void> | null = null;
  private nextId = 1;
  lastError = "";

  getStatus = () => this.status;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private setStatus(s: RunnerStatus) {
    this.status = s;
    this.listeners.forEach((fn) => fn());
  }

  /** Starts the worker and downloads Pyodide if that hasn't happened yet. Safe to call many times. */
  preload(): Promise<void> {
    if (this.ready) return this.ready;
    this.setStatus("loading");
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    this.worker = worker;
    this.ready = new Promise<void>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<RunnerResponse>) => {
        const msg = e.data;
        if (msg.type === "ready") {
          this.setStatus("ready");
          resolve();
        } else if (msg.type === "init_error") {
          this.lastError = msg.message;
          this.setStatus("error");
          this.ready = null;
          reject(new Error(msg.message));
        } else {
          this.pending.get(msg.id)?.resolve(msg);
          this.pending.delete(msg.id);
        }
      };
      worker.onerror = () => {
        this.lastError = "The code runner couldn't start.";
        this.setStatus("error");
        this.ready = null;
        reject(new Error(this.lastError));
      };
    });
    worker.postMessage({ type: "init" } satisfies RunnerRequest);
    return this.ready;
  }

  /** Kills a stuck worker and starts a fresh one in the background. */
  private restart() {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    this.pending.forEach((p, id) => p.resolve({ type: "run_result", id, ok: false, output: "", error: TIMEOUT_MESSAGE, durationMs: RUN_TIMEOUT_MS }));
    this.pending.clear();
    void this.preload().catch(() => {});
  }

  private async send(req: Extract<RunnerRequest, { id: number }>): Promise<{ msg: RunnerResponse; timedOut: boolean }> {
    await this.preload();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(req.id);
        this.restart();
        resolve({ msg: { type: "run_result", id: req.id, ok: false, output: "", error: TIMEOUT_MESSAGE, durationMs: RUN_TIMEOUT_MS }, timedOut: true });
      }, RUN_TIMEOUT_MS);
      this.pending.set(req.id, {
        resolve: (msg) => {
          clearTimeout(timer);
          resolve({ msg, timedOut: false });
        },
      });
      this.worker!.postMessage(req);
    });
  }

  async run(code: string): Promise<RunOutcome> {
    const { msg, timedOut } = await this.send({ type: "run", id: this.nextId++, code });
    if (msg.type !== "run_result") return { ok: false, output: "", error: "Unexpected runner reply.", durationMs: 0 };
    return { ok: msg.ok, output: msg.output, error: msg.error, durationMs: msg.durationMs, timedOut };
  }

  async runTests(code: string, calls: string[]): Promise<TestOutcome> {
    const { msg, timedOut } = await this.send({ type: "tests", id: this.nextId++, code, calls });
    if (msg.type === "test_result") return { ok: msg.ok, results: msg.results, error: msg.error, durationMs: msg.durationMs };
    return { ok: false, results: [], error: msg.type === "run_result" ? msg.error : "Unexpected runner reply.", durationMs: RUN_TIMEOUT_MS, timedOut };
  }
}

export const runner = new PythonRunner();

/** Starts the Pyodide download once the browser is idle, without competing with the first paint. */
export function preloadRunnerWhenIdle(): void {
  const start = () => void runner.preload().catch(() => {});
  if ("requestIdleCallback" in window) window.requestIdleCallback(start, { timeout: 4000 });
  else setTimeout(start, 1500);
}

export function useRunnerStatus(): RunnerStatus {
  return useSyncExternalStore(runner.subscribe, runner.getStatus, runner.getStatus);
}
