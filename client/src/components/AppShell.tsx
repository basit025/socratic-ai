import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { LogOut } from "lucide-react";
import { api } from "../lib/api";
import { useMe } from "../lib/session";
import { Logo } from "./Logo";
import { Button, DemoBadge } from "./ui";

const INSTITUTION = "Pothohar Institute of Computing";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Top bar + page container for signed-in screens. */
export function AppShell({ children }: { children: ReactNode }) {
  const me = useMe();
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);

  const leave = async () => {
    setLeaving(true);
    await api("/demo/end", { method: "POST" }).catch(() => {});
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link to={me.role === "teacher" ? "/teacher" : "/student"} aria-label="Socratic AI home">
              <Logo />
            </Link>
            <span className="hidden truncate text-sm text-ink-3 md:inline">{INSTITUTION}</span>
            <DemoBadge />
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 sm:flex">
              <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-action-soft text-sm font-semibold text-action">
                {initials(me.name)}
              </span>
              <span className="text-sm leading-tight">
                <span className="block font-semibold">{me.name}</span>
                <span className="block text-ink-3">{me.role === "teacher" ? "Teacher" : "Student"}</span>
              </span>
            </div>
            <Button variant="ghost" icon={LogOut} loading={leaving} onClick={leave} title="Leave this demo and go back to the start page">
              <span className="hidden sm:inline">Leave demo</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
