// End-to-end check of submit → hidden tests → viva → grade + flags, through the real API and AI.
// Plays two simulated students on a dev server (preview database):
//   honest: types gradually, runs, fixes, answers the viva well (answers written by an AI playing a student who understands)
//   copier: long absence, steady retyping, never runs, can't explain
// This is an ENGINEERING check, not evidence for the pitch. Real results come only from real students.
// Run: npm run dev   then   npm run e2e:viva -- http://localhost:3000
import "../server/loadEnv.js";
import { z } from "zod";
import { generateJson } from "../server/llm.js";

const BASE = process.argv[2] ?? "http://localhost:3000";

class Client {
  cookie = "";
  async call<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE}/api${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(this.cookie ? { Cookie: this.cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0]!;
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) throw new Error(`${path} → ${res.status}: ${data.error}`);
    return data;
  }
}

/** The student's own code, evaluated in JS for the simulation (the real app runs Python in the browser). */
function makeSolution(boundary: number) {
  const code = `def over_summary(balls):\n    total = 0\n    big_hits = 0\n    for runs in balls:\n        total += runs\n        if runs >= ${boundary}:\n            big_hits += 1\n    return (total, big_hits)\n\n\nprint(over_summary([1, 4, 0, 6, 2, 1]))\n`;
  const evalCall = (call: string) => {
    const list = JSON.parse(call.slice(call.indexOf("(") + 1, call.lastIndexOf(")")).replace(/None/g, "null")) as number[] | null;
    if (!Array.isArray(list)) return { call, ok: false, error: "TypeError: 'NoneType' object is not iterable" };
    return { call, ok: true, repr: `(${list.reduce((a, b) => a + b, 0)}, ${list.filter((r) => r >= boundary).length})` };
  };
  return { code, evalCall };
}

const Answer = z.object({ answer: z.string() });
async function honestAnswer(code: string, question: string): Promise<string> {
  const r = await generateJson({
    purpose: "other",
    system: "You are a first-year student who wrote the code below yourself and understands it well. Answer the viva question in 1-2 short sentences, in plain English, like a student would. Be correct.",
    messages: [{ role: "user", content: `My code:\n${code}\n\nQuestion: ${question}` }],
    schema: Answer,
    schemaName: "answer",
    maxOutputTokens: 150,
  });
  return r.data.answer;
}

async function play(kind: "honest" | "copier") {
  const c = new Client();
  await c.call("/demo/start", { role: "student" });
  const home = await c.call<{ courses: { assignments: { id: string; title: string }[] }[] }>("/student/home");
  const aid = home.courses[0]!.assignments.find((a) => a.title === "Cricket Over Tracker")!.id;
  const ws = await c.call<{ assignment: { instructions: string }; submission: { id: string; nextSeq: number } }>(`/student/assignments/${aid}`);
  const boundary = /scored (\d) or more/.exec(ws.assignment.instructions)?.[1] === "6" ? 6 : 4;
  const { code, evalCall } = makeSolution(boundary);
  const sid = ws.submission.id;

  // ---- the process log
  let seq = ws.submission.nextSeq;
  let t = Date.now() - 20 * 60_000;
  const events: unknown[] = [];
  const keys = (text: string, dt: number) => events.push({ seq: seq++, t: (t += dt), type: "keys", payload: { changes: [...text].map((ch, i) => ({ from: i, to: i, insert: ch })), chars: text.length } });
  if (kind === "honest") {
    for (let i = 0; i < 40; i++) keys(code.slice(i * 6, i * 6 + 6) || "x", 5000); // ~1.2 chars/s, gradual
    events.push({ seq: seq++, t: (t += 3000), type: "run", payload: { ok: false, durationMs: 4, docLength: 200 } });
    events.push({ seq: seq++, t: (t += 10), type: "error", payload: { message: "NameError: name 'big_hit' is not defined" } });
    keys("s", 20_000);
    events.push({ seq: seq++, t: (t += 4000), type: "run", payload: { ok: true, durationMs: 5, docLength: 200 } });
  } else {
    keys("def ", 3000);
    events.push({ seq: seq++, t: (t += 2000), type: "focus_lost", payload: {} });
    t += 190_000;
    events.push({ seq: seq++, t, type: "focus_back", payload: { awayMs: 190_000 } });
    for (let i = 0; i < 14; i++) keys(code.slice(i * 16, i * 16 + 16) || "x", 1500); // ~10.7 chars/s, steady, no errors
  }
  events.push({ seq: seq++, t: (t += 2000), type: "snapshot", payload: { doc: code } });
  await c.call(`/submissions/${sid}/events`, { events, doc: code });
  await c.call(`/submissions/${sid}/events`, { events: [{ seq: seq++, t: (t += 1000), type: "submit", payload: { docLength: code.length } }], doc: code });

  // ---- submit, then hidden tests (inputs only; marked on the server)
  const sub = await c.call<{ testCalls: string[] }>(`/submissions/${sid}/submit`, { doc: code });
  const tests = await c.call<{ passed: number; total: number }>(`/submissions/${sid}/tests`, { results: sub.testCalls.map(evalCall) });

  // ---- viva
  let r = await c.call<{ current?: { index: number; kind: string; prompt: string; call: string | null }; done?: boolean; vivaScore?: number | null; grade?: number }>(`/submissions/${sid}/viva/start`, {});
  const transcript: string[] = [];
  const timings: number[] = [];
  while (r.current) {
    const q = r.current;
    const answer = kind === "honest" ? await honestAnswer(code, q.prompt) : ["pata nahi", "", "I think it adds them"][q.index % 3]!;
    transcript.push(`  Q${q.index + 1} [${q.kind}] ${q.prompt}\n     A: ${answer || "(blank, time ran out)"}`);
    const t0 = Date.now();
    r = await c.call(`/submissions/${sid}/viva/answer`, { index: q.index, answer, awayMs: 0, ...(q.call ? { groundTruth: evalCall(q.call) } : {}) });
    timings.push(Date.now() - t0);
  }
  return { kind, boundary, tests: `${tests.passed}/${tests.total}`, vivaScore: r.vivaScore, grade: r.grade, transcript, timings, c, aid };
}

async function main() {
  for (const kind of ["honest", "copier"] as const) {
    const r = await play(kind);
    console.log(`\n=== ${kind.toUpperCase()} (variant: ${r.boundary}+) ===`);
    console.log(r.transcript.join("\n"));
    console.log(`  tests ${r.tests} · viva ${r.vivaScore}/100 · suggested grade ${r.grade}/10 · next-question/score latency ${r.timings.map((ms) => `${(ms / 1000).toFixed(1)}s`).join(", ")}`);
    const state = await r.c.call<{ result?: { reviseNext: string | null } }>(`/submissions/${(await r.c.call<{ submission: { id: string } }>(`/student/assignments/${r.aid}`)).submission.id}/viva`);
    console.log(`  revise next: ${state.result?.reviseNext}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
