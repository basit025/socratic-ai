import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router";
import { api, ApiError } from "./api";
import { FullPageLoading } from "../components/ui";

export interface Me {
  role: "teacher" | "student";
  name: string;
  expiresAt: string;
  demo: boolean; // false for real accounts
}

const MeContext = createContext<Me | null>(null);

/** The signed-in visitor. Only available inside <RequireRole>. */
export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe must be used inside <RequireRole>");
  return me;
}

/** Shows children only to a visitor with this role; otherwise sends them to the right place. */
export function RequireRole({ role, children }: { role: Me["role"]; children: ReactNode }) {
  const [state, setState] = useState<{ me: Me } | { error: "none" | "other" } | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    api<Me>("/me", { signal: ctrl.signal })
      .then((me) => setState({ me }))
      .catch((err) => {
        if ((err as { name?: string })?.name === "AbortError") return;
        setState({ error: err instanceof ApiError && err.status === 401 ? "none" : "other" });
      });
    return () => ctrl.abort();
  }, []);

  if (!state) return <FullPageLoading label="Opening your demo…" />;
  if ("error" in state) return <Navigate to={state.error === "none" ? "/?ended=1" : "/"} replace />;
  if (state.me.role !== role) return <Navigate to={state.me.role === "teacher" ? "/teacher" : "/student"} replace />;
  return <MeContext.Provider value={state.me}>{children}</MeContext.Provider>;
}
