import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeftRight, LogOut, RotateCcw } from "lucide-react";
import { Dialog } from "./Dialog";
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
  const [switching, setSwitching] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  // "Reset demo": a fresh private copy of the demo institution, in the same role.
  const startOver = async () => {
    setResetting(true);
    try {
      const r = await api<{ home: string }>("/demo/start", { body: { role: me.role } });
      window.location.assign(r.home);
    } catch {
      setResetting(false);
      setResetOpen(false);
    }
  };

  // Demo only: see the same sandbox through the other role's eyes.
  const switchRole = async () => {
    setSwitching(true);
    try {
      const r = await api<{ home: string }>("/demo/switch", { body: {} });
      window.location.assign(r.home); // full reload so every screen re-reads the new role
    } catch {
      setSwitching(false);
    }
  };

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
            <Button variant="ghost" icon={ArrowLeftRight} loading={switching} onClick={switchRole} title={`See this demo as the ${me.role === "teacher" ? "student" : "teacher"}`}>
              <span className="hidden lg:inline">{me.role === "teacher" ? "Student view" : "Teacher view"}</span>
            </Button>
            <Button variant="ghost" icon={RotateCcw} onClick={() => setResetOpen(true)} title="Start over with a fresh copy of the demo">
              <span className="hidden xl:inline">Start over</span>
            </Button>
            <Button variant="ghost" icon={LogOut} loading={leaving} onClick={leave} title="Leave this demo and go back to the start page">
              <span className="hidden sm:inline">Leave demo</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <Dialog open={resetOpen} title="Start over with a fresh demo?" onClose={() => !resetting && setResetOpen(false)}>
        <p className="text-ink-2">You'll get a brand-new private copy of the demo institution, as a {me.role}. Anything you did in this demo is left behind.</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setResetOpen(false)} disabled={resetting} data-autofocus>
            Keep this demo
          </Button>
          <Button icon={RotateCcw} loading={resetting} onClick={startOver}>
            Start over
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
