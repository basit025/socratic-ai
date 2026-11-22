/**
 * Cheap dependency checks for GET /api/health.
 * - No model generation: Gemini and Groq are checked with a "get model" metadata call,
 *   which validates the key and the model name without using generation quota.
 * - Results are cached per function instance for CACHE_MS so a public health URL
 *   can't be used to hammer the providers.
 * - The response never includes keys, URLs or raw provider errors.
 */

export type CheckStatus = "ok" | "not_configured" | "error";

export interface HealthReport {
  status: "ok" | "degraded" | "down";
  checks: { database: CheckStatus; gemini: CheckStatus; groq: CheckStatus };
  llmProvider: string;
  environment: string;
  commit: string | null;
  checkedAt: string;
  cached: boolean;
}

export const GEMINI_MODEL = "gemini-3.1-flash-lite";
export const GROQ_MODEL = "openai/gpt-oss-120b";
const CACHE_MS = 60_000;
const TIMEOUT_MS = 4_000;

type Env = Record<string, string | undefined>;
type Fetch = typeof fetch;

function isSet(value: string | undefined): value is string {
  return Boolean(value && value.trim() && !value.startsWith("YOUR_"));
}

async function probe(fetchFn: Fetch, url: string, headers: Record<string, string>): Promise<CheckStatus> {
  try {
    const res = await fetchFn(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.ok ? "ok" : "error";
  } catch {
    return "error";
  }
}

export async function checkDatabase(env: Env, fetchFn: Fetch = fetch): Promise<CheckStatus> {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!isSet(url) || !isSet(key)) return "not_configured";
  // PostgREST answers /rest/v1/ by introspecting Postgres, so a 200 means the database is reachable.
  // Replace with a `select 1` RPC once the schema exists.
  return probe(fetchFn, `${url.replace(/\/$/, "")}/rest/v1/`, { apikey: key, Authorization: `Bearer ${key}` });
}

export async function checkGemini(env: Env, fetchFn: Fetch = fetch): Promise<CheckStatus> {
  const key = env.GEMINI_API_KEY;
  if (!isSet(key)) return "not_configured";
  return probe(fetchFn, `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}`, {
    "x-goog-api-key": key,
  });
}

export async function checkGroq(env: Env, fetchFn: Fetch = fetch): Promise<CheckStatus> {
  const key = env.GROQ_API_KEY;
  if (!isSet(key)) return "not_configured";
  return probe(fetchFn, `https://api.groq.com/openai/v1/models/${GROQ_MODEL}`, {
    Authorization: `Bearer ${key}`,
  });
}

/**
 * down     = the database is unreachable (nothing works without it)
 * degraded = the database is fine but at least one AI provider isn't (fallback may still cover it)
 * ok       = everything answers
 */
export function overallStatus(checks: HealthReport["checks"]): HealthReport["status"] {
  if (checks.database !== "ok") return "down";
  if (checks.gemini !== "ok" || checks.groq !== "ok") return "degraded";
  return "ok";
}

let cache: { at: number; report: HealthReport } | null = null;

export function resetHealthCache(): void {
  cache = null;
}

export async function getHealth(env: Env = process.env, fetchFn: Fetch = fetch, now = Date.now()): Promise<HealthReport> {
  if (cache && now - cache.at < CACHE_MS) {
    return { ...cache.report, cached: true };
  }
  const [database, gemini, groq] = await Promise.all([
    checkDatabase(env, fetchFn),
    checkGemini(env, fetchFn),
    checkGroq(env, fetchFn),
  ]);
  const checks = { database, gemini, groq };
  const report: HealthReport = {
    status: overallStatus(checks),
    checks,
    llmProvider: env.LLM_PROVIDER || "gemini",
    environment: env.VERCEL_ENV || "local",
    commit: env.VERCEL_GIT_COMMIT_SHA ? env.VERCEL_GIT_COMMIT_SHA.slice(0, 7) : null,
    checkedAt: new Date(now).toISOString(),
    cached: false,
  };
  cache = { at: now, report };
  return report;
}
