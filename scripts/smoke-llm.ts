// Live check of each AI provider with one tiny request (uses .env.local; prints model, latency and tokens, never keys).
// Run: npm run smoke:llm
import "../server/loadEnv.js";
import { z } from "zod";
import { generateJson } from "../server/llm.js";
const Reply = z.object({ message: z.string().describe("One short Socratic question for the student"), allowExecution: z.boolean() });
for (const p of ["gemini", "groq", "openrouter"] as const) {
  const env = { ...process.env, GEMINI_API_KEY: p === "gemini" ? process.env.GEMINI_API_KEY : "", GROQ_API_KEY: p === "groq" ? process.env.GROQ_API_KEY : "", OPENROUTER_API_KEY: p === "openrouter" ? process.env.OPENROUTER_API_KEY : "" };
  const t = Date.now();
  try {
    const r = await generateJson({ purpose: "other", system: "You are Ustaad, a Socratic coding mentor. Never write code. Reply in JSON.", messages: [{ role: "user", content: "My code is: total = 0\nfor r in [4, 6, 1]:\n  total += r\nprint(total)\nAsk me one question to check I understand it." }], schema: Reply, schemaName: "ustaad_reply", maxOutputTokens: 200 }, { env });
    console.log(`${p.padEnd(10)} OK  ${Date.now() - t} ms  ${r.model}  tokens in/out ${r.attempts.at(-1)?.inputTokens}/${r.attempts.at(-1)?.outputTokens}  -> ${JSON.stringify(r.data).slice(0, 110)}`);
  } catch (e: any) {
    console.log(`${p.padEnd(10)} FAIL ${Date.now() - t} ms  ${e.attempts ? e.attempts.map((a: any) => a.errorCode).join(",") : e.message}`);
  }
}
