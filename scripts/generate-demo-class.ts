// Generates the demo class: SIMULATED students (persona-driven) worked through the REAL platform.
// The platform's own viva questions, AI scoring and flag rules produce everything a teacher sees.
// Output: server/seed/sessions/*.json (marked "simulated"), loaded by `npm run seed`.
// This is DEMO DATA, labelled as such in the product. It is never presented as a measured result.
//
//   RATE_LIMITS=off npm run dev            (local server on the PREVIEW database, in recording mode)
//   npm run demo:generate -- http://localhost:3000 [--only cricket,chai]
import "../server/loadEnv.js";
import { existsSync } from "node:fs";
import { z } from "zod";
import { generateJson } from "../server/llm.js";
import { computeExpected, runCalls } from "../server/seed/expected.js";
import { exportSession } from "../server/seed/exportSession.js";
import { assignments, courses } from "../server/seed/content.js";
import { renderInstructions } from "../server/lib/variants.js";
import { diffOne } from "../shared/diff.js";
import type { Change } from "../shared/events.js";

const BASE = process.argv[2]?.startsWith("http") ? process.argv[2] : "http://localhost:3000";
const ONLY = (() => {
  const i = process.argv.indexOf("--only");
  return i > 0 ? new Set(process.argv[i + 1]!.split(",")) : null;
})();

const CONCURRENCY = Number(process.env.GEN_CONCURRENCY ?? 1); // Groq free tier allows ~8k tokens a minute

type Persona = "strong" | "struggling" | "copier" | "copier_paste";

/** Which personas work on which assignment, and how many extra classmates reuse each session. */
const PLAN: Record<string, { persona: Persona; reuse: number }[]> = {
  chai: [{ persona: "strong", reuse: 8 }, { persona: "struggling", reuse: 6 }, { persona: "copier", reuse: 4 }],
  metro: [{ persona: "strong", reuse: 8 }, { persona: "struggling", reuse: 6 }, { persona: "copier", reuse: 4 }],
  cricket: [
    { persona: "strong", reuse: 3 }, { persona: "strong", reuse: 3 }, { persona: "struggling", reuse: 2 },
    { persona: "copier", reuse: 3 }, { persona: "copier_paste", reuse: 2 }, { persona: "struggling", reuse: 2 },
  ],
  rickshaw: [{ persona: "strong", reuse: 2 }, { persona: "struggling", reuse: 1 }],
  vowels: [{ persona: "strong", reuse: 7 }, { persona: "struggling", reuse: 6 }, { persona: "copier", reuse: 4 }],
  attendance: [{ persona: "strong", reuse: 3 }, { persona: "struggling", reuse: 3 }, { persona: "copier", reuse: 2 }, { persona: "copier_paste", reuse: 2 }],
  second: [{ persona: "strong", reuse: 7 }, { persona: "struggling", reuse: 6 }, { persona: "copier", reuse: 4 }],
  brackets: [{ persona: "strong", reuse: 7 }, { persona: "struggling", reuse: 6 }, { persona: "copier", reuse: 4 }],
  queue: [{ persona: "strong", reuse: 3 }, { persona: "struggling", reuse: 3 }, { persona: "copier", reuse: 3 }],
  email: [{ persona: "strong", reuse: 7 }, { persona: "struggling", reuse: 6 }, { persona: "copier", reuse: 4 }],
  summary: [{ persona: "strong", reuse: 7 }, { persona: "struggling", reuse: 6 }, { persona: "copier", reuse: 4 }],
  phones: [{ persona: "strong", reuse: 3 }, { persona: "struggling", reuse: 3 }, { persona: "copier", reuse: 2 }],
  // Courses built from the team's lecture material: closed work gets three personas, open work two.
  ...Object.fromEntries(
    ["dm-five", "dm-star", "dm-basket", "ir-index", "ir-vb", "nlp-tokens", "nlp-edit", "nlp-bigram", "cc-lexer", "cc-dfa", "cc-ambiguity", "oop-account", "oop-shapes", "oop-hostel", "hci-chunking", "hci-gulfs", "dsa-linked", "dsa-bigo"].map(
      (k) => [k, [{ persona: "strong" as Persona, reuse: 8 }, { persona: "struggling" as Persona, reuse: 7 }, { persona: "copier" as Persona, reuse: 4 }]],
    ),
  ),
  ...Object.fromEntries(
    ["dm-kmeans", "ir-cosine", "nlp-nb", "cc-rd", "oop-fraction", "hci-review", "dsa-bst"].map((k) => [k, [{ persona: "strong" as Persona, reuse: 5 }, { persona: "copier" as Persona, reuse: 3 }]]),
  ),
};

// ---------------------------------------------------------------- tiny deterministic randomness
let seed = 20261124;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const between = (a: number, b: number) => a + rand() * (b - a);
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]!;
const shuffle = <T,>(xs: T[]) => xs.map((x) => [rand(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);

// ---------------------------------------------------------------- API client with a cookie jar
class Client {
  cookie = "";
  async call<T>(path: string, body?: unknown): Promise<T> {
    // Network blips (not HTTP errors) are retried once, except where a repeat would double an action.
    const once = /\/viva\/answer$|\/ustaad$/.test(path);
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.send<T>(path, body);
      } catch (err) {
        const network = err instanceof TypeError;
        if (!network || once || attempt === 2) throw network ? new Error(`${path}: ${(err as Error).message} (${String((err as { cause?: { code?: string } }).cause?.code ?? "")})`) : err;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }
  private async send<T>(path: string, body?: unknown): Promise<T> {
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

// ---------------------------------------------------------------- the student's own work (AI playing the student)
const CodeWork = z.object({
  final_code: z.string(),
  first_try: z.string().nullable(),
  first_error: z.string().nullable(),
});
const TextWork = z.object({ final_text: z.string(), first_draft: z.string().nullable() });
const Answer = z.object({ answer: z.string() });

/**
 * The simulated STUDENTS' side (their code, drafts and viva answers) runs on a different Groq model,
 * so it never eats the quota the platform itself needs for questions, hints and scoring.
 */
const STUDENT_AI = { env: { ...process.env, LLM_PROVIDER: process.env.STUDENT_PROVIDER ?? "gemini", GROQ_MODEL: process.env.STUDENT_GROQ_MODEL ?? "openai/gpt-oss-20b", OPENROUTER_API_KEY: "" } };

const PERSONA_CODE: Record<Persona, string> = {
  strong:
    "You are a hard-working first-year student in Pakistan. Write YOUR OWN solution: correct, simple, beginner style (plain for loops and ifs, no comprehensions or generator expressions, the variable names a student would pick, maybe one short comment). Also write first_try: the version you typed first, containing ONE realistic beginner mistake that makes it crash (a misspelled variable name, a missing colon or bracket) or give a wrong answer. In first_error, put the error message the language would show, or null if it just gives a wrong answer.",
  struggling:
    "You are a first-year student in Pakistan who finds programming hard. Write YOUR OWN solution in a simple, slightly clumsy beginner style: only for loops, if/else, counters and basic operators; NO comprehensions, generator expressions, lambda, map/filter or one-liners; maybe an unnecessary variable or a print left in. It should handle the main example correctly but may miss ONE edge case. first_try must contain a mistake that crashes (typo in a variable name, wrong indentation, a missing bracket). In first_error, put the error message the language would show.",
  copier:
    "Write the polished solution an AI chatbot would give for this task: idiomatic, compact, with a docstring or comments, using slightly advanced constructs (comprehensions, built-ins). first_try and first_error must be null.",
  copier_paste:
    "Write the polished solution an AI chatbot would give for this task: idiomatic, compact, with a docstring or comments. first_try and first_error must be null.",
};
const PERSONA_TEXT: Record<Persona, string> = {
  strong: "You are a sincere first-year university student in Pakistan writing in English as a second language. Write YOUR OWN answer: clear, personal, with a real-sounding example from your life, a few small grammar mistakes, plain vocabulary. Also give first_draft: an earlier, rougher version of the same answer (shorter, less organised).",
  struggling: "You are a first-year student in Pakistan whose English is weak. Write YOUR OWN answer: short, simple sentences, several grammar mistakes, partly meets the task. Also give first_draft: an even rougher earlier version.",
  copier: "Write the polished answer an AI chatbot would produce: fluent, formal, well structured, generic examples, no personal detail. first_draft must be null.",
  copier_paste: "Write the polished answer an AI chatbot would produce: fluent, formal, generic. first_draft must be null.",
};
// The student's voice. What each answer gets right or wrong is set per question (QUALITY).
const PERSONA_VIVA: Record<Persona, string> = {
  strong: "You did this work yourself. Answer the viva question in 1–3 short sentences, like a real student speaking: simple words, small grammar slips are fine.",
  struggling: "You did this work yourself but find programming hard. Answer in 1–2 short sentences with simple words, the way an unsure first-year student talks.",
  copier: "You handed in work copied from ChatGPT and never read it. Answer like a nervous student: very short (for example 'it just checks the numbers', 'I think it returns true', 'pata nahi sir').",
  copier_paste: "You handed in work copied from ChatGPT and only skimmed it. Answer very briefly, like a nervous student.",
};

async function studentWork(kind: "code" | "written", persona: Persona, language: string | null, instructions: string, starter: string) {
  if (kind === "written") {
    const r = await generateJson({ purpose: "other", system: PERSONA_TEXT[persona], messages: [{ role: "user", content: `The task:\n${instructions}` }], schema: TextWork, schemaName: "student_text", maxOutputTokens: 900, temperature: 0.9, timeoutMs: 30_000 }, STUDENT_AI);
    return { final: r.data.final_text.trim(), first: r.data.first_draft?.trim() || null, error: null };
  }
  const r = await generateJson({
    purpose: "other",
    system: PERSONA_CODE[persona],
    messages: [{ role: "user", content: `Language: ${language}\n\nThe task:\n${instructions}\n\nStarter code:\n${starter}\n\nKeep the function name and signature exactly as in the starter code. Keep the final print/console.log line.` }],
    schema: CodeWork,
    schemaName: "student_code",
    maxOutputTokens: 900,
    temperature: 0.9,
    timeoutMs: 30_000,
  }, STUDENT_AI);
  return { final: r.data.final_code.replace(/^```\w*\n?|```$/g, "").trim() + "\n", first: r.data.first_try ? r.data.first_try.replace(/^```\w*\n?|```$/g, "").trim() + "\n" : null, error: r.data.first_error };
}

type Quality = "solid" | "partial" | "confused" | "guess";
const QUALITY: Record<Quality, string> = {
  solid: "For THIS question: answer correctly and specifically.",
  partial: "For THIS question: get the main idea right but leave out or muddle one important detail.",
  confused: "For THIS question: you genuinely misunderstand this part. Answer as if you are fairly sure, but be wrong in a real way (for a 'what would it return' question, give a wrong value: off by one, wrong type, or a crash that wouldn't happen).",
  guess: "For THIS question: you don't know. Give a short, vague or wrong guess, the kind a nervous student makes. Do not explain the code correctly even if you could work it out.",
};
/** What kind of answer each persona gives to each of the viva questions. */
function qualities(persona: Persona, n: number): Quality[] {
  const fill = (xs: Quality[]) => Array.from({ length: n }, (_, i) => xs[i % xs.length]!);
  if (persona === "strong") return fill(rand() < 0.35 ? shuffle(["solid", "solid", "partial"]) : ["solid"]);
  if (persona === "struggling") return fill(shuffle(["partial", "confused", rand() < 0.5 ? "solid" : "partial"]));
  if (persona === "copier_paste") return fill(shuffle(["guess", "guess", "partial"]));
  return fill(["guess"]);
}

async function vivaAnswer(persona: Persona, quality: Quality, work: string, task: string, question: string, roman: boolean): Promise<string> {
  // A copier never studied the work they handed in: they only know what the task asked for.
  const knows = persona === "copier" || persona === "copier_paste"
    ? `What you remember: only the task you were given (below). You pasted the answer from ChatGPT and never read it, so you do NOT know its variable names, lines or exact logic.\n\nThe task:\n${task.slice(0, 1500)}`
    : `Your work:\n${work}`;
  const r = await generateJson({
    purpose: "other",
    system: `${PERSONA_VIVA[persona]} ${QUALITY[quality]}${roman ? " Write in Roman Urdu mixed with English, as Pakistani students often do." : ""}`,
    messages: [{ role: "user", content: `${knows}\n\nThe viva question: ${question}` }],
    schema: Answer,
    schemaName: "viva_answer",
    maxOutputTokens: 200,
    temperature: 0.9,
    timeoutMs: 20_000,
  }, STUDENT_AI);
  return r.data.answer.trim();
}

// ---------------------------------------------------------------- a human-like process log
interface Ev {
  ms: number;
  type: string;
  payload: unknown;
}

class Timeline {
  ms = 0;
  doc: string;
  events: Ev[] = [];
  private burst: Change[] = [];
  private burstChars = 0;
  private sinceSnap = 0;
  constructor(start: string) {
    this.doc = start;
  }
  private push(type: string, payload: unknown) {
    this.events.push({ ms: Math.round(this.ms), type, payload });
    if (type !== "snapshot" && ++this.sinceSnap >= 25) this.snapshot();
  }
  flush() {
    if (!this.burst.length) return;
    const onlyDeletes = this.burst.every((c) => c.insert === "");
    const chars = this.burst.reduce((n, c) => n + (onlyDeletes ? c.to - c.from : c.insert.length), 0);
    this.push(onlyDeletes ? "delete" : "keys", { changes: this.burst, chars });
    this.burst = [];
    this.burstChars = 0;
  }
  snapshot() {
    this.flush();
    this.sinceSnap = 0;
    this.events.push({ ms: Math.round(this.ms), type: "snapshot", payload: { doc: this.doc } });
  }
  wait(seconds: number) {
    if (seconds >= 1.5) this.flush(); // the recorder ends a burst after 1.5 s idle
    this.ms += seconds * 1000;
  }
  private apply(c: Change) {
    this.doc = this.doc.slice(0, c.from) + c.insert + this.doc.slice(c.to);
    this.burst.push(c);
    this.burstChars += c.insert.length + (c.to - c.from);
    if (this.burstChars >= 200) this.flush();
  }
  /** Types text at a position, one character at a time, at a human pace with typos. */
  type(at: number, text: string, opts: { cps: number; typoRate: number; linePause: [number, number]; thinkEvery?: number }) {
    let pos = at;
    let lines = 0;
    for (const ch of text) {
      if (rand() < opts.typoRate && /[a-z]/i.test(ch)) {
        this.apply({ from: pos, to: pos, insert: pick(["e", "a", "s", "r", "t"]) });
        this.ms += (1 / opts.cps) * 1000 * between(0.7, 1.5);
        this.wait(between(0.3, 0.9));
        this.apply({ from: pos, to: pos + 1, insert: "" });
      }
      this.apply({ from: pos, to: pos, insert: ch });
      pos += 1;
      this.ms += (1 / opts.cps) * 1000 * between(0.6, 1.6);
      if (ch === "\n") {
        lines += 1;
        this.wait(between(...opts.linePause));
        if (opts.thinkEvery && lines % opts.thinkEvery === 0) this.wait(between(15, 50));
      }
    }
    return pos;
  }
  remove(from: number, to: number, cps = 12) {
    for (let p = to; p > from; p--) {
      this.apply({ from: p - 1, to: p, insert: "" });
      this.ms += (1 / cps) * 1000;
    }
  }
  /** Turns the current document into `target` with one human edit (delete the old part, type the new). */
  editTo(target: string, opts: { cps: number; typoRate: number; linePause: [number, number] }) {
    const c = diffOne(this.doc, target);
    if (!c) return;
    if (c.to > c.from) this.remove(c.from, c.to);
    this.wait(between(0.5, 2));
    if (c.insert) this.type(c.from, c.insert, opts);
  }
  event(type: string, payload: unknown) {
    this.flush();
    this.push(type, payload);
  }
}

const PACE: Record<Persona, { cps: number; typoRate: number; linePause: [number, number]; thinkEvery?: number }> = {
  strong: { cps: 3.2, typoRate: 0.025, linePause: [2, 9], thinkEvery: 5 },
  struggling: { cps: 2.2, typoRate: 0.04, linePause: [4, 16], thinkEvery: 3 },
  copier: { cps: 10, typoRate: 0, linePause: [0.3, 1.1] },
  copier_paste: { cps: 9, typoRate: 0.003, linePause: [0.3, 1.2] },
};

const HINTS_CODE = [
  "Mera code error de raha hai, samajh nahi aa raha kyun. Kya check karun?",
  "I got an error when I ran it. Which line should I look at first?",
  "Ustaad, mujhe lagta hai loop sahi hai lekin answer galat aa raha hai. Hint dein?",
];
const HINTS_TEXT = ["Is my main point clear enough?", "Mujhe example dena hai lekin samajh nahi aa raha konsa dun. Hint?", "How should I start my answer?"];

// ---------------------------------------------------------------- one simulated student
async function runSession(key: string, persona: Persona, label: string) {
  const a = assignments.find((x) => x.key === key)!;
  const c = new Client();
  await c.call("/demo/start", { role: "student" });
  // The demo student isn't in every course: join with the course's real join code, like a student would.
  await c.call("/courses/join", { code: courses.find((x) => x.key === a.course)!.joinCode });
  const home = await c.call<{ courses: { assignments: { id: string; title: string }[] }[] }>("/student/home");
  const aid = home.courses.flatMap((x) => x.assignments).find((x) => x.title === a.title)?.id;
  if (!aid) throw new Error(`${a.title} isn't open for the demo student (is preview in recording mode?)`);
  const ws = await c.call<{ assignment: { instructions: string; starterCode: string }; submission: { id: string; nextSeq: number } }>(`/student/assignments/${aid}`);
  const sid = ws.submission.id;
  const option = a.variantSpec ? (a.variantSpec.options.find((o) => renderInstructions(a.instructions, a.variantSpec!, o) === ws.assignment.instructions) ?? null) : null;

  const kind = a.type === "written" ? "written" : "code";
  let work = await studentWork(kind, persona, a.language, ws.assignment.instructions, ws.assignment.starterCode);
  const calls = a.tests.map((t) => t.call);
  let passed = 0;
  if (kind === "code") {
    const expected = await computeExpected(a.language!, a.referenceSolution, a.tests, a.variantSpec ?? null);
    const score = async (code: string) => {
      const r = await runCalls(a.language!, code, calls);
      return r.filter((x, i) => {
        const e = expected[i]!.expected;
        const want = typeof e === "string" ? e : e[option ?? ""] ?? Object.values(e)[0];
        return x.ok && x.repr === want;
      }).length;
    };
    passed = await score(work.final);
    const needed = persona === "struggling" ? Math.max(1, calls.length - 2) : calls.length;
    if (passed < needed) {
      work = await studentWork(kind, persona, a.language, ws.assignment.instructions, ws.assignment.starterCode);
      passed = await score(work.final);
    }
    if (passed < needed) throw new Error(`generated code for ${label} passes only ${passed}/${calls.length}`);
  }

  // ---- the process
  const pace = PACE[persona];
  const tl = new Timeline(ws.assignment.starterCode);
  const honest = persona === "strong" || persona === "struggling";
  let hintAt: number | null = null;
  const runs: { ms: number; ok: boolean }[] = [];
  tl.wait(between(15, 45)); // reading the task
  if (honest) {
    const first = work.first ?? work.final;
    tl.editTo(first, pace);
    if (kind === "code") {
      tl.wait(between(3, 10));
      tl.event("run", { ok: !work.error, durationMs: Math.round(between(4, 30)), docLength: tl.doc.length });
      if (work.error) tl.event("error", { message: work.error.slice(0, 500) });
      tl.snapshot();
      runs.push({ ms: tl.ms, ok: !work.error });
      tl.wait(between(25, 80)); // reading the error
    } else {
      tl.wait(between(30, 90));
    }
    if (persona === "struggling" || rand() < 0.35) {
      hintAt = tl.ms;
      tl.wait(between(40, 90)); // reading Ustaad's reply
    }
    tl.editTo(work.final, pace);
    if (kind === "code") {
      tl.wait(between(3, 8));
      tl.event("run", { ok: true, durationMs: Math.round(between(4, 30)), docLength: tl.doc.length });
      tl.snapshot();
      runs.push({ ms: tl.ms, ok: true });
      if (persona === "strong" && rand() < 0.6) {
        tl.wait(between(20, 60));
        tl.event("run", { ok: true, durationMs: Math.round(between(4, 30)), docLength: tl.doc.length });
        tl.snapshot();
      }
    }
  } else {
    tl.wait(between(10, 30));
    tl.event("focus_lost", {});
    const away = between(150_000, 290_000);
    tl.ms += away;
    tl.event("focus_back", { awayMs: Math.round(away) });
    if (persona === "copier_paste") {
      tl.wait(between(2, 6));
      tl.event("paste_attempt", { length: work.final.length, source: "paste" });
      tl.wait(between(4, 12));
    }
    tl.editTo(work.final, pace);
    if (persona === "copier_paste") {
      tl.wait(between(3, 8));
      if (kind === "code") {
        tl.event("run", { ok: true, durationMs: Math.round(between(4, 20)), docLength: tl.doc.length });
        runs.push({ ms: tl.ms, ok: true });
      }
    }
  }
  tl.wait(between(5, 20));
  tl.snapshot();
  tl.event("submit", { docLength: tl.doc.length });
  tl.flush();

  // Send the log with client times laid out in the recent past, then hints, then submit.
  const endAt = Date.now() - 60_000;
  const startAt = endAt - tl.ms;
  const all = tl.events.map((e, i) => ({ seq: ws.submission.nextSeq + i, t: Math.round(startAt + e.ms), type: e.type, payload: e.payload }));
  for (let i = 0; i < all.length; i += 400) {
    const last = i + 400 >= all.length;
    await c.call(`/submissions/${sid}/events`, { events: all.slice(i, i + 400), ...(last ? { doc: work.final } : {}) });
  }
  const messageAt: number[] = [];
  if (hintAt !== null) {
    const msg = pick(kind === "code" ? HINTS_CODE : HINTS_TEXT);
    await c.call(`/submissions/${sid}/ustaad`, { message: msg, code: work.first ?? work.final, output: work.error ?? null, hasRun: kind === "code" && runs.length > 0 });
    messageAt.push(Math.round(hintAt), Math.round(hintAt + between(2500, 5000)));
  }
  const sub = await c.call<{ testCalls: string[] }>(`/submissions/${sid}/submit`, { doc: work.final });
  if (kind === "code" && sub.testCalls.length) {
    await c.call(`/submissions/${sid}/tests`, { results: await runCalls(a.language!, work.final, sub.testCalls) });
  }

  // ---- the viva, answered in character
  const roman = rand() < 0.35;
  const seconds: (number | null)[] = [];
  const plan = qualities(persona, a.rules.vivaQuestions);
  let r = await c.call<{ current?: { index: number; prompt: string; call: string | null; needsGroundTruth: boolean }; done?: boolean; vivaScore?: number | null }>(`/submissions/${sid}/viva/start`, {});
  while (r.current) {
    const q = r.current;
    const blank = !honest && rand() < 0.25;
    const answer = blank ? "" : await vivaAnswer(persona, plan[q.index] ?? "partial", work.final, ws.assignment.instructions, q.prompt, roman);
    seconds.push(blank ? 90 : Math.round(persona === "strong" ? between(30, 70) : persona === "struggling" ? between(50, 85) : between(70, 89)));
    const groundTruth = q.needsGroundTruth && q.call && a.language ? (await runCalls(a.language, work.final, [q.call]))[0] : undefined;
    r = await c.call(`/submissions/${sid}/viva/answer`, { index: q.index, answer, awayMs: 0, ...(groundTruth ? { groundTruth } : {}) });
  }
  if (r.vivaScore == null) throw new Error("the viva couldn't be scored (AI unavailable); trying again");
  return { sid, viva: r.vivaScore, passed, total: calls.length, seconds, messageAt };
}

// ---------------------------------------------------------------- the whole class
async function main() {
  const t0 = Date.now();
  // Plan every job up front (who owns which session), then run them a few at a time.
  const jobs: { key: string; persona: Persona; label: string; primary: string; alsoAs: { student: string; daysAgo: number }[]; daysAgo: number }[] = [];
  for (const [key, plan] of Object.entries(PLAN)) {
    if (ONLY && !ONLY.has(key)) continue;
    const a = assignments.find((x) => x.key === key)!;
    const roster = shuffle(courses.find((c) => c.key === a.course)!.students.filter((s) => s !== "ayesha"));
    const closed = a.status === "closed";
    // Closed: handed in during the last days before the due date. Open: since it opened, never today.
    const days = () => (closed ? Math.round(-a.dueInDays + between(0, 3)) : Math.max(1, Math.min(-a.opensInDays, Math.round(between(1, 2)))));
    let next = 0;
    for (const [i, step] of plan.entries()) {
      const primary = roster[next++];
      if (!primary) break;
      const alsoAs = Array.from({ length: step.reuse }, () => roster[next++]).filter(Boolean).map((student) => ({ student: student!, daysAgo: days() }));
      jobs.push({ key, persona: step.persona, label: `sim-${key}-${step.persona}-${i + 1}`, primary, alsoAs, daysAgo: days() });
    }
  }
  let made = 0;
  let cursor = 0;
  const worker = async () => {
    while (cursor < jobs.length) {
      const j = jobs[cursor++]!;
      if (existsSync(`server/seed/sessions/${j.label}.json`)) {
        console.log(`  · ${j.label} already generated (delete the file to redo it)`);
        continue;
      }
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const r = await runSession(j.key, j.persona, j.label);
          const out = exportSession({ submissionId: r.sid, as: j.primary, label: j.label, daysAgo: j.daysAgo, alsoAs: j.alsoAs, simulated: { persona: j.persona }, vivaSeconds: r.seconds, messageAtMs: r.messageAt });
          made++;
          console.log(`  ✓ ${j.label.padEnd(34)} viva ${String(r.viva ?? "–").padStart(3)} · tests ${r.passed}/${r.total} · ${out.events} events · ${1 + j.alsoAs.length} students`);
          break;
        } catch (err) {
          console.log(`  ✗ ${j.label} attempt ${attempt}: ${(err as Error).message}`);
        }
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`\n${made}/${jobs.length} simulated sessions in ${Math.round((Date.now() - t0) / 1000)} s. Now run: npm run seed (preview), then npm run seed -- --production`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
