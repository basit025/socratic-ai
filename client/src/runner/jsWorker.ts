/// <reference lib="webworker" />
/**
 * Runs a student's JavaScript in a dedicated worker (no DOM, no page access). A fresh worker is
 * created for every run, so runs are isolated and a stuck run is simply terminated.
 */
import type { RunnerRequest, RunnerResponse } from "./protocol";
import { repr } from "../../../shared/repr";

declare const self: DedicatedWorkerGlobalScope;

function cleanError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

const post = (m: RunnerResponse) => self.postMessage(m);

self.onmessage = (e: MessageEvent<RunnerRequest>) => {
  const msg = e.data;
  if (msg.type === "init") {
    post({ type: "ready" });
    return;
  }
  const out: string[] = [];
  const log = (...args: unknown[]) => out.push(args.map((a) => (typeof a === "string" ? a : repr(a))).join(" "));
  const fakeConsole = { log, info: log, warn: log, error: log };
  const started = performance.now();
  try {
    if (msg.type === "run") {
      new Function("console", `"use strict";\n${msg.code}`)(fakeConsole);
      post({ type: "run_result", id: msg.id, ok: true, output: out.join("\n"), durationMs: Math.round(performance.now() - started) });
      return;
    }
    // Tests: the calls run in the same scope as the student's code, each guarded separately.
    const guarded = msg.calls.map((c) => `(() => { try { return { ok: true, v: (${c}) }; } catch (e) { return { ok: false, e: (e && e.name ? e.name + ": " + e.message : String(e)) }; } })()`);
    const values = new Function("console", `"use strict";\n${msg.code}\nreturn [${guarded.join(",\n")}];`)(fakeConsole) as { ok: boolean; v?: unknown; e?: string }[];
    const results = msg.calls.map((call, i) => (values[i]?.ok ? { call, ok: true, repr: repr(values[i]!.v) } : { call, ok: false, error: values[i]?.e ?? "Error" }));
    post({ type: "test_result", id: msg.id, ok: true, results, durationMs: Math.round(performance.now() - started) });
  } catch (err) {
    const error = cleanError(err);
    if (msg.type === "run") post({ type: "run_result", id: msg.id, ok: false, output: out.join("\n"), error, durationMs: Math.round(performance.now() - started) });
    else post({ type: "test_result", id: msg.id, ok: false, results: [], error, durationMs: Math.round(performance.now() - started) });
  }
};
