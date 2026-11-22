/**
 * The ONLY module that calls an AI model.
 *
 * Fallback chain: LLM_PROVIDER first (default gemini), then the others in the order
 * gemini → groq → openrouter, skipping providers with no key.
 * - 429 / 5xx: retry once on the same provider, then move on. After a 429 the provider is
 *   skipped for 60 s (per function instance).
 * - Timeout (default 12 s, per request): move on immediately; a hung provider usually hangs again,
 *   and a student is waiting.
 * - 400 / 401 / 403 / 404: a configuration problem; move on immediately.
 * - Output that isn't valid JSON or doesn't match the schema: retry once, then move on.
 * - Every attempt is logged to ai_usage (tokens, latency) for the cost slide. Never logs keys or prompts.
 */
import { z } from "zod";
import { insert } from "./lib/db.js";

export type Provider = "gemini" | "groq" | "openrouter";
export type LlmPurpose = "hint" | "viva_question" | "viva_score" | "summary" | "handwriting" | "other";
type Env = Record<string, string | undefined>;

export const DEFAULT_ORDER: readonly Provider[] = ["gemini", "groq", "openrouter"];
export const COOLDOWN_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 12_000;

export function modelFor(provider: Provider, env: Env): string {
  if (provider === "gemini") return "gemini-3.1-flash-lite";
  if (provider === "groq") return "openai/gpt-oss-120b";
  return env.OPENROUTER_MODEL?.trim() || "google/gemini-3.1-flash-lite";
}

function keyFor(provider: Provider, env: Env): string | undefined {
  const k = provider === "gemini" ? env.GEMINI_API_KEY : provider === "groq" ? env.GROQ_API_KEY : env.OPENROUTER_API_KEY;
  return k?.trim() ? k.trim() : undefined;
}

export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LlmRequest<T> {
  purpose: LlmPurpose;
  system: string;
  messages: LlmMessage[];
  schema: z.ZodType<T>;
  schemaName: string;            // short identifier, e.g. "ustaad_reply"
  temperature?: number;
  maxOutputTokens?: number;
  sandboxId?: string | null;
  timeoutMs?: number;            // per provider call; interactive hints use ~6 s
}

export interface Attempt {
  provider: Provider;
  model: string;
  ok: boolean;
  errorCode?: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
}

export interface LlmResult<T> {
  data: T;
  provider: Provider;
  model: string;
  attempts: Attempt[];
}

/** Every provider failed. The message is safe to show to a student. */
export class LlmUnavailableError extends Error {
  readonly status = 503;
  readonly publicMessage = "Ustaad is busy right now. Your work is saved; please try again in a minute.";
  constructor(readonly attempts: Attempt[]) {
    super(`All AI providers failed: ${attempts.map((a) => `${a.provider}:${a.errorCode}`).join(", ")}`);
  }
}

type FailureKind = "rate_limited" | "server" | "timeout" | "client" | "invalid_output";

class ProviderFailure extends Error {
  constructor(
    readonly kind: FailureKind,
    readonly code: string,
  ) {
    super(code);
  }
}

interface RawOutput {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface LlmDeps {
  env?: Env;
  fetchFn?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  logUsage?: (attempt: Attempt, purpose: LlmPurpose, sandboxId: string | null) => Promise<void>;
}

const cooldownUntil = new Map<Provider, number>();
export function resetCooldowns(): void {
  cooldownUntil.clear();
}

/** JSON Schema for the providers' structured-output modes (zod v4 → draft 2020-12, minus "$schema"). */
export function jsonSchemaFor(schema: z.ZodType<unknown>): Record<string, unknown> {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest;
}

function classifyHttp(status: number): FailureKind {
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server";
  return "client";
}

async function postJson(fetchFn: typeof fetch, url: string, headers: Record<string, string>, body: unknown, timeoutMs: number): Promise<unknown> {
  let res: Response;
  try {
    res = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const name = (err as { name?: string })?.name;
    throw new ProviderFailure("timeout", name === "TimeoutError" || name === "AbortError" ? "timeout" : "network");
  }
  if (!res.ok) throw new ProviderFailure(classifyHttp(res.status), `http_${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new ProviderFailure("server", "bad_http_body");
  }
}

async function callGemini<T>(req: LlmRequest<T>, model: string, key: string, fetchFn: typeof fetch): Promise<RawOutput> {
  const body = {
    systemInstruction: { parts: [{ text: req.system }] },
    contents: req.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: jsonSchemaFor(req.schema),
      temperature: req.temperature ?? 0.4,
      maxOutputTokens: req.maxOutputTokens ?? 1024,
    },
  };
  const json = (await postJson(
    fetchFn,
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    { "x-goog-api-key": key },
    body,
    req.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  )) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return { text, inputTokens: json.usageMetadata?.promptTokenCount, outputTokens: json.usageMetadata?.candidatesTokenCount };
}

async function callOpenAiCompatible<T>(
  provider: "groq" | "openrouter",
  req: LlmRequest<T>,
  model: string,
  key: string,
  fetchFn: typeof fetch,
): Promise<RawOutput> {
  const url =
    provider === "groq" ? "https://api.groq.com/openai/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions";
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "system", content: req.system }, ...req.messages],
    temperature: req.temperature ?? 0.4,
    response_format: { type: "json_schema", json_schema: { name: req.schemaName, schema: jsonSchemaFor(req.schema), strict: false } },
  };
  if (provider === "groq") {
    // gpt-oss reasons before answering: keep reasoning short and leave room for the answer.
    body.reasoning_effort = "low";
    body.max_completion_tokens = (req.maxOutputTokens ?? 1024) + 1024;
  } else {
    body.max_tokens = req.maxOutputTokens ?? 1024;
  }
  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  if (provider === "openrouter") headers["X-Title"] = "Socratic AI";
  const json = (await postJson(fetchFn, url, headers, body, req.timeoutMs ?? DEFAULT_TIMEOUT_MS)) as {
    choices?: { message?: { content?: string | null } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    text: json.choices?.[0]?.message?.content ?? "",
    inputTokens: json.usage?.prompt_tokens,
    outputTokens: json.usage?.completion_tokens,
  };
}

/** Parses model text as JSON (tolerating ```json fences) and validates it against the schema. */
export function parseOutput<T>(text: string, schema: z.ZodType<T>): T {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new ProviderFailure("invalid_output", "invalid_json");
  }
  const result = schema.safeParse(parsed);
  if (!result.success) throw new ProviderFailure("invalid_output", "schema_mismatch");
  return result.data;
}

async function defaultLogUsage(attempt: Attempt, purpose: LlmPurpose, sandboxId: string | null): Promise<void> {
  await insert("ai_usage", {
    sandbox_id: sandboxId,
    provider: attempt.provider,
    model: attempt.model,
    purpose,
    input_tokens: attempt.inputTokens ?? null,
    output_tokens: attempt.outputTokens ?? null,
    latency_ms: attempt.latencyMs,
    ok: attempt.ok,
    error_code: attempt.errorCode ?? null,
  });
}

export function providerOrder(env: Env, now: number): Provider[] {
  const primary = (env.LLM_PROVIDER?.trim() as Provider) || "gemini";
  const order = DEFAULT_ORDER.includes(primary) ? [primary, ...DEFAULT_ORDER.filter((p) => p !== primary)] : [...DEFAULT_ORDER];
  return order.filter((p) => keyFor(p, env) && (cooldownUntil.get(p) ?? 0) <= now);
}

export async function generateJson<T>(req: LlmRequest<T>, deps: LlmDeps = {}): Promise<LlmResult<T>> {
  const env = deps.env ?? process.env;
  const fetchFn = deps.fetchFn ?? fetch;
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const logUsage = deps.logUsage ?? defaultLogUsage;
  const attempts: Attempt[] = [];

  for (const provider of providerOrder(env, now())) {
    const key = keyFor(provider, env)!;
    const model = modelFor(provider, env);
    for (let attemptNo = 1; attemptNo <= 2; attemptNo++) {
      const started = now();
      try {
        const raw =
          provider === "gemini"
            ? await callGemini(req, model, key, fetchFn)
            : await callOpenAiCompatible(provider, req, model, key, fetchFn);
        const data = parseOutput(raw.text, req.schema);
        const attempt: Attempt = { provider, model, ok: true, latencyMs: now() - started, inputTokens: raw.inputTokens, outputTokens: raw.outputTokens };
        attempts.push(attempt);
        void logUsage(attempt, req.purpose, req.sandboxId ?? null).catch(() => {});
        return { data, provider, model, attempts };
      } catch (err) {
        const failure = err instanceof ProviderFailure ? err : new ProviderFailure("server", "unexpected");
        const attempt: Attempt = { provider, model, ok: false, errorCode: failure.code, latencyMs: now() - started };
        attempts.push(attempt);
        void logUsage(attempt, req.purpose, req.sandboxId ?? null).catch(() => {});
        if (failure.kind === "client" || failure.kind === "timeout") break; // config problem or hung: next provider
        if (attemptNo === 2) {
          if (failure.kind === "rate_limited") cooldownUntil.set(provider, now() + COOLDOWN_MS);
          break;
        }
        await sleep(failure.kind === "rate_limited" ? 800 : 300);
      }
    }
  }
  throw new LlmUnavailableError(attempts);
}
