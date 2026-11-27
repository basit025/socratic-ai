import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";

export type Loadable<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: T };

/** GET an API path with loading / error / retry states. 401 sends the visitor back to the start page. */
export function useApi<T>(path: string | null): Loadable<T> & { reload: () => void } {
  const [state, setState] = useState<Loadable<T>>({ status: "loading" });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (path == null) return; // nothing to load (e.g. data another role uses)
    const ctrl = new AbortController();
    setState({ status: "loading" });
    api<T>(path, { signal: ctrl.signal })
      .then((data) => setState({ status: "ready", data }))
      .catch((err) => {
        if ((err as { name?: string })?.name === "AbortError") return;
        if (err instanceof ApiError && err.status === 401) {
          window.location.assign("/?ended=1");
          return;
        }
        setState({ status: "error", message: err instanceof ApiError ? err.message : "Something went wrong." });
      });
    return () => ctrl.abort();
  }, [path, tick]);

  return { ...state, reload };
}
