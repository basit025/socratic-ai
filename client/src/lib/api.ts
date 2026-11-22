/** Fetch wrapper: JSON in and out, and errors that carry the server's friendly message. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

const OFFLINE = "Can't reach Socratic AI. Check your internet connection and try again.";

export async function api<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: "same-origin",
      signal: init.signal,
    });
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") throw err;
    throw new ApiError(0, OFFLINE, "offline");
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
  if (!res.ok) throw new ApiError(res.status, data?.error ?? "Something went wrong. Please try again.", data?.code);
  return data as T;
}

/** Wakes the serverless API so the visitor's first real click is fast. Fire and forget. */
export function prewarmApi(): void {
  fetch("/api/health", { credentials: "omit" }).catch(() => {});
}
