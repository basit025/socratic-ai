import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { generateJson, LlmUnavailableError, parseOutput, providerOrder, resetCooldowns, type LlmDeps } from "./llm.js";

const Reply = z.object({ message: z.string(), allowExecution: z.boolean() });
const req = { purpose: "hint" as const, system: "You are Ustaad.", messages: [{ role: "user" as const, content: "Help" }], schema: Reply, schemaName: "ustaad_reply" };
const allKeys = { GEMINI_API_KEY: "g", GROQ_API_KEY: "q", OPENROUTER_API_KEY: "o" };
const good = { message: "What does line 4 do?", allowExecution: true };

const geminiOk = (data: unknown) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(data) }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } }));
const openAiOk = (text: string) => new Response(JSON.stringify({ choices: [{ message: { content: text } }], usage: { prompt_tokens: 12, completion_tokens: 6 } }));
const status = (code: number) => new Response("{}", { status: code });

/** Routes each call by provider URL to a queue of responses. */
function fakeFetch(queues: Partial<Record<"gemini" | "groq" | "openrouter", (() => Response)[]>>) {
  const calls: string[] = [];
  const fn = vi.fn(async (url: string) => {
    const p = url.includes("googleapis") ? "gemini" : url.includes("groq") ? "groq" : "openrouter";
    calls.push(p);
    const next = queues[p]?.shift();
    if (!next) throw new Error(`unexpected call to ${p}`);
    return next();
  }) as unknown as typeof fetch;
  return { fn, calls };
}

function deps(fetchFn: typeof fetch, env: Record<string, string> = allKeys): LlmDeps & { logged: unknown[] } {
  const logged: unknown[] = [];
  return { env, fetchFn, sleep: async () => {}, logUsage: async (a) => void logged.push(a), logged };
}

beforeEach(() => resetCooldowns());

describe("generateJson", () => {
  it("returns Gemini's answer when it works", async () => {
    const { fn, calls } = fakeFetch({ gemini: [() => geminiOk(good)] });
    const d = deps(fn);
    const r = await generateJson(req, d);
    expect(r.data).toEqual(good);
    expect(r.provider).toBe("gemini");
    expect(calls).toEqual(["gemini"]);
    expect(d.logged).toHaveLength(1);
  });

  it("retries a 429 once, then falls back to Groq and puts Gemini on cooldown", async () => {
    const { fn, calls } = fakeFetch({ gemini: [() => status(429), () => status(429)], groq: [() => openAiOk(JSON.stringify(good)), () => openAiOk(JSON.stringify(good))] });
    const r = await generateJson(req, deps(fn));
    expect(r.provider).toBe("groq");
    expect(calls).toEqual(["gemini", "gemini", "groq"]);
    // The next request skips Gemini entirely while it cools down.
    const second = await generateJson(req, deps(fn));
    expect(second.provider).toBe("groq");
    expect(calls).toEqual(["gemini", "gemini", "groq", "groq"]);
  });

  it("moves on immediately after a 401 (bad key), without retrying", async () => {
    const { fn, calls } = fakeFetch({ gemini: [() => status(401)], groq: [() => openAiOk(JSON.stringify(good))] });
    await generateJson(req, deps(fn));
    expect(calls).toEqual(["gemini", "groq"]);
  });

  it("moves on immediately after a timeout, without retrying the hung provider", async () => {
    const timeout = () => {
      throw Object.assign(new Error("timed out"), { name: "TimeoutError" });
    };
    const { fn, calls } = fakeFetch({ gemini: [timeout], groq: [() => openAiOk(JSON.stringify(good))] });
    const r = await generateJson(req, deps(fn));
    expect(r.provider).toBe("groq");
    expect(calls).toEqual(["gemini", "groq"]);
    expect(r.attempts[0]!.errorCode).toBe("timeout");
  });

  it("skips an overloaded provider (repeated 503) or a hung one for a while", async () => {
    const { fn, calls } = fakeFetch({ gemini: [() => status(503), () => status(503)], groq: [() => openAiOk(JSON.stringify(good)), () => openAiOk(JSON.stringify(good))] });
    await generateJson(req, deps(fn));
    await generateJson(req, deps(fn));
    expect(calls).toEqual(["gemini", "gemini", "groq", "groq"]);

    resetCooldowns();
    const timeout = () => {
      throw Object.assign(new Error("timed out"), { name: "TimeoutError" });
    };
    const t = fakeFetch({ gemini: [timeout], groq: [() => openAiOk(JSON.stringify(good)), () => openAiOk(JSON.stringify(good))] });
    await generateJson(req, deps(t.fn));
    await generateJson(req, deps(t.fn));
    expect(t.calls).toEqual(["gemini", "groq", "groq"]);
  });

  it("sends images only to providers that can see them", async () => {
    let geminiBody = "";
    const calls: string[] = [];
    const fn = (async (url: string, init: { body: string }) => {
      const p = url.includes("googleapis") ? "gemini" : url.includes("groq") ? "groq" : "openrouter";
      calls.push(p);
      if (p === "gemini") {
        geminiBody = init.body;
        return status(503);
      }
      return openAiOk(JSON.stringify(good));
    }) as unknown as typeof fetch;
    const r = await generateJson({ ...req, images: [{ mimeType: "image/jpeg", base64: "AAAA" }] }, deps(fn));
    expect(geminiBody).toContain("inline_data");
    expect(calls).toEqual(["gemini", "gemini", "openrouter"]); // Groq's text model is skipped
    expect(r.provider).toBe("openrouter");
    // Gemini is now cooling down and Groq can't see images: Gemini is still tried, not skipped.
    expect(providerOrder(allKeys, Date.now(), { images: true })).toEqual(["openrouter", "gemini"]);
    resetCooldowns();
    expect(providerOrder({ GEMINI_API_KEY: "g", GROQ_API_KEY: "q" }, Date.now(), { images: true })).toEqual(["gemini"]);
  });

  it("tries a cooling-down Gemini for images when it's the only provider that can see them", async () => {
    const fails = fakeFetch({ gemini: [() => status(503), () => status(503)], groq: [() => openAiOk(JSON.stringify(good))] });
    await generateJson(req, deps(fails.fn, { GEMINI_API_KEY: "g", GROQ_API_KEY: "q" })); // Gemini now cools down
    const { fn, calls } = fakeFetch({ gemini: [() => geminiOk(good)] });
    const r = await generateJson({ ...req, images: [{ mimeType: "image/jpeg", base64: "AAAA" }] }, deps(fn, { GEMINI_API_KEY: "g", GROQ_API_KEY: "q" }));
    expect(r.provider).toBe("gemini");
    expect(calls).toEqual(["gemini"]);
  });

  it("retries once when the output doesn't match the schema", async () => {
    const { fn, calls } = fakeFetch({ gemini: [() => geminiOk({ wrong: true }), () => geminiOk(good)] });
    const r = await generateJson(req, deps(fn));
    expect(r.data).toEqual(good);
    expect(calls).toEqual(["gemini", "gemini"]);
  });

  it("uses OpenRouter when Gemini and Groq both fail", async () => {
    const { fn, calls } = fakeFetch({ gemini: [() => status(503), () => status(503)], groq: [() => status(500), () => status(500)], openrouter: [() => openAiOk("```json\n" + JSON.stringify(good) + "\n```")] });
    const r = await generateJson(req, deps(fn));
    expect(r.provider).toBe("openrouter");
    expect(calls).toEqual(["gemini", "gemini", "groq", "groq", "openrouter"]);
  });

  it("throws a friendly LlmUnavailableError when every provider fails", async () => {
    const { fn } = fakeFetch({ gemini: [() => status(500), () => status(500)], groq: [() => status(500), () => status(500)], openrouter: [() => status(500), () => status(500)] });
    const err = await generateJson(req, deps(fn)).catch((e) => e);
    expect(err).toBeInstanceOf(LlmUnavailableError);
    expect(err.status).toBe(503);
    expect(err.publicMessage).toMatch(/Ustaad is busy/);
    expect(err.attempts).toHaveLength(6);
    // Everything is cooling down now, but the next request still tries every provider.
    expect(providerOrder(allKeys, Date.now())).toEqual(["gemini", "groq", "openrouter"]);
  });

  it("skips providers without a key and respects LLM_PROVIDER", () => {
    expect(providerOrder({ GROQ_API_KEY: "q" }, 0)).toEqual(["groq"]);
    expect(providerOrder({ ...allKeys, LLM_PROVIDER: "openrouter" }, 0)).toEqual(["openrouter", "gemini", "groq"]);
  });
});

describe("parseOutput", () => {
  it("accepts fenced JSON and rejects prose", () => {
    expect(parseOutput("```json\n{\"message\":\"a\",\"allowExecution\":false}\n```", Reply).message).toBe("a");
    expect(() => parseOutput("Sure! Here is your answer.", Reply)).toThrow();
  });
});
