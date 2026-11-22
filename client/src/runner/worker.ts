/// <reference lib="webworker" />
/**
 * Python runner (Pyodide) inside a Web Worker, so student code never blocks the page.
 * The main thread enforces the time limit by terminating this worker.
 * Each run gets a fresh namespace, so variables from an earlier run never leak into the next.
 */
import type { RunnerRequest, RunnerResponse } from "./protocol";

declare const self: DedicatedWorkerGlobalScope;

export const PYODIDE_VERSION = "314.0.8";
const INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

interface PyProxy {
  destroy(): void;
}
interface Pyodide {
  runPythonAsync(code: string, opts?: { globals?: PyProxy }): Promise<unknown>;
  runPython(code: string, opts?: { globals?: PyProxy }): unknown;
  globals: { get(name: string): (...args: unknown[]) => PyProxy };
  setStdout(opts: { batched: (s: string) => void }): void;
  setStderr(opts: { batched: (s: string) => void }): void;
  setStdin(opts: { stdin: () => string }): void;
}

let pyodide: Promise<Pyodide> | null = null;

function load(): Promise<Pyodide> {
  pyodide ??= (async () => {
    const mod = (await import(/* @vite-ignore */ `${INDEX_URL}pyodide.mjs`)) as { loadPyodide: (o: { indexURL: string }) => Promise<Pyodide> };
    const py = await mod.loadPyodide({ indexURL: INDEX_URL });
    py.setStdin({
      stdin: () => {
        throw new Error("input() isn't available here. Put the values in your code instead, for example: runs = [4, 0, 6]");
      },
    });
    return py;
  })();
  return pyodide;
}

/** Keeps only the student's part of a Python traceback (drops Pyodide's internal frames). */
export function cleanError(message: string): string {
  const lines = message.split("\n");
  const start = lines.findIndex((l) => l.includes('File "<exec>"'));
  const kept = start >= 0 ? ["Traceback (most recent call last):", ...lines.slice(start)] : lines;
  return kept
    .join("\n")
    .replace(/File "<exec>"/g, "Your code")
    .trim();
}

const post = (msg: RunnerResponse) => self.postMessage(msg);

self.onmessage = async (e: MessageEvent<RunnerRequest>) => {
  const msg = e.data;
  if (msg.type === "init") {
    try {
      await load();
      post({ type: "ready" });
    } catch (err) {
      post({ type: "init_error", message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  const py = await load();
  const out: string[] = [];
  py.setStdout({ batched: (s) => out.push(s) });
  py.setStderr({ batched: (s) => out.push(s) });
  const ns = py.globals.get("dict")();
  const started = performance.now();
  try {
    await py.runPythonAsync(msg.code, { globals: ns });
    if (msg.type === "run") {
      post({ type: "run_result", id: msg.id, ok: true, output: out.join("\n"), durationMs: Math.round(performance.now() - started) });
      return;
    }
    // Hidden tests: evaluate each call against the student's code and return repr() only.
    // Expected values never reach the browser; the server compares.
    const results = msg.calls.map((call) => {
      try {
        return { call, ok: true, repr: String(py.runPython(`repr(${call})`, { globals: ns })) };
      } catch (err) {
        return { call, ok: false, error: cleanError(err instanceof Error ? err.message : String(err)).split("\n").at(-1) ?? "Error" };
      }
    });
    post({ type: "test_result", id: msg.id, ok: true, results, durationMs: Math.round(performance.now() - started) });
  } catch (err) {
    const error = cleanError(err instanceof Error ? err.message : String(err));
    if (msg.type === "run") post({ type: "run_result", id: msg.id, ok: false, output: out.join("\n"), error, durationMs: Math.round(performance.now() - started) });
    else post({ type: "test_result", id: msg.id, ok: false, error, results: [], durationMs: Math.round(performance.now() - started) });
  } finally {
    ns.destroy();
  }
};
