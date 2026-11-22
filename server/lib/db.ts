/**
 * Minimal server-side database access through Supabase's REST API with the service_role key.
 * The browser never talks to the database; every table is locked to service_role (see the
 * initial migration), so this module is the only way in.
 */

type Env = Record<string, string | undefined>;

export class DbNotConfiguredError extends Error {
  constructor() {
    super("Database is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  }
}

/** A database failure. Deliberately has no `status` field, so the global error handler answers 500. */
export class DbError extends Error {
  constructor(
    message: string,
    readonly dbHttpStatus: number,
  ) {
    super(message);
  }
}

function config(env: Env) {
  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new DbNotConfiguredError();
  return { base: `${url.replace(/\/$/, "")}/rest/v1`, key };
}

/** Calls a Postgres function exposed through PostgREST (POST /rest/v1/rpc/<name>). */
export async function rpc<T>(
  name: string,
  args: Record<string, unknown> = {},
  opts: { env?: Env; fetchFn?: typeof fetch; timeoutMs?: number } = {},
): Promise<T> {
  const { base, key } = config(opts.env ?? process.env);
  const res = await (opts.fetchFn ?? fetch)(`${base}/rpc/${encodeURIComponent(name)}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 8_000),
  });
  if (!res.ok) {
    // Log the database's message server-side only; never forward it to the browser.
    const detail = await res.text().catch(() => "");
    throw new DbError(`rpc ${name} failed (${res.status}): ${detail.slice(0, 300)}`, res.status);
  }
  return (await res.json()) as T;
}
