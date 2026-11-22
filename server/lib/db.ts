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

/**
 * Reads rows through PostgREST. `pathAndQuery` is e.g.
 * `courses?select=id,code&teacher_id=eq.<uuid>`. Build filter values with `eq()` so they're encoded.
 */
export async function select<T>(pathAndQuery: string, opts: { env?: Env; fetchFn?: typeof fetch } = {}): Promise<T[]> {
  const { base, key } = config(opts.env ?? process.env);
  const res = await (opts.fetchFn ?? fetch)(`${base}/${pathAndQuery}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new DbError(`select ${pathAndQuery.split("?")[0]} failed (${res.status}): ${detail.slice(0, 300)}`, res.status);
  }
  return (await res.json()) as T[];
}

/** A PostgREST equality filter value, URL-encoded. */
export const eq = (v: string) => `eq.${encodeURIComponent(v)}`;

/** Inserts one row or many rows into a table. Returns nothing (use rpc for anything that must return data). */
export async function insert(
  table: string,
  rows: Record<string, unknown> | Record<string, unknown>[],
  opts: { env?: Env; fetchFn?: typeof fetch } = {},
): Promise<void> {
  const { base, key } = config(opts.env ?? process.env);
  const res = await (opts.fetchFn ?? fetch)(`${base}/${encodeURIComponent(table)}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(rows),
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new DbError(`insert into ${table} failed (${res.status}): ${detail.slice(0, 300)}`, res.status);
  }
}

/** Inserts rows, silently skipping any that collide with `onConflict` (e.g. a resent event batch). */
export async function insertIgnoringDuplicates(
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
  opts: { env?: Env; fetchFn?: typeof fetch } = {},
): Promise<void> {
  const { base, key } = config(opts.env ?? process.env);
  const res = await (opts.fetchFn ?? fetch)(`${base}/${encodeURIComponent(table)}?on_conflict=${encodeURIComponent(onConflict)}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal,resolution=ignore-duplicates",
    },
    body: JSON.stringify(rows),
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new DbError(`insert into ${table} failed (${res.status}): ${detail.slice(0, 300)}`, res.status);
  }
}

/** Updates rows matching `filter` (PostgREST query string, e.g. `id=eq.<uuid>`) and returns them. */
export async function update<T>(table: string, filter: string, patch: Record<string, unknown>, opts: { env?: Env; fetchFn?: typeof fetch } = {}): Promise<T[]> {
  const { base, key } = config(opts.env ?? process.env);
  const res = await (opts.fetchFn ?? fetch)(`${base}/${encodeURIComponent(table)}?${filter}`, {
    method: "PATCH",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(patch),
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new DbError(`update ${table} failed (${res.status}): ${detail.slice(0, 300)}`, res.status);
  }
  return (await res.json()) as T[];
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
