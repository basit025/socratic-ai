/**
 * The five-step journey, always visible: what's done, what's now, what's next.
 * Locked steps say why and how to unlock them (feedforward), never just grey out.
 */
import { Check, Lock } from "lucide-react";
import { cx } from "../components/ui";
import { Pop } from "../components/Motion";

export interface JourneyStep {
  key: string;
  label: string;
  state: "done" | "current" | "upcoming" | "locked";
  hint?: string; // shown under a locked or current step
}

export function JourneyStepper({ steps }: { steps: JourneyStep[] }) {
  return (
    <nav aria-label="Your progress on this assignment">
      <ol className="grid gap-1 sm:gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((s, i) => (
          <li key={s.key} aria-current={s.state === "current" ? "step" : undefined} className="min-w-0">
            <div
              className={cx(
                "h-1.5 rounded-full",
                s.state === "done" && "bg-done",
                s.state === "current" && "bg-action",
                (s.state === "upcoming" || s.state === "locked") && "bg-locked-line",
              )}
            />
            <div className="mt-2 flex items-center gap-1.5">
              <span
                className={cx(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  s.state === "done" && "bg-done text-white",
                  s.state === "current" && "bg-action text-white",
                  s.state === "upcoming" && "border border-line-strong bg-surface text-ink-3",
                  s.state === "locked" && "border border-dashed border-line-strong bg-surface text-ink-3",
                )}
                aria-hidden
              >
                {s.state === "done" ? <Pop><Check className="size-3.5" /></Pop> : s.state === "locked" ? <Lock className="size-3" /> : i + 1}
              </span>
              <span className={cx("truncate text-sm font-semibold", s.state === "current" ? "text-action" : s.state === "done" ? "text-done" : "text-ink-3")}>
                {s.label}
              </span>
              <span className="sr-only">
                {s.state === "done" ? "(done)" : s.state === "current" ? "(you are here)" : s.state === "locked" ? `(locked${s.hint ? `: ${s.hint}` : ""})` : "(next)"}
              </span>
            </div>
            {s.state === "locked" && s.hint && <p className="mt-0.5 hidden text-xs text-ink-3 md:block">{s.hint}</p>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
