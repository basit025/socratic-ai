import type { ButtonHTMLAttributes, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Circle, Clock, Loader2, Lock, type LucideIcon } from "lucide-react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ---------------------------------------------------------------- buttons
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "lg";
  loading?: boolean;
  icon?: LucideIcon;
};

export function Button({ variant = "primary", size = "md", loading, icon: Icon, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed",
        size === "md" ? "min-h-11 px-4 text-[15px]" : "min-h-14 px-6 text-base",
        variant === "primary" && "bg-action text-white hover:bg-action-hover disabled:bg-locked/60",
        variant === "secondary" && "border border-line-strong bg-surface text-ink hover:border-action hover:text-action disabled:text-ink-3",
        variant === "ghost" && "text-ink-2 hover:bg-locked-soft hover:text-ink disabled:text-ink-3",
        className,
      )}
    >
      {loading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : Icon ? <Icon className="size-5" aria-hidden /> : null}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- status chips (icon + words, never colour alone)
export type ChipTone = "action" | "done" | "attention" | "locked" | "danger";

const toneClass: Record<ChipTone, string> = {
  action: "bg-action-soft text-action border-action-line",
  done: "bg-done-soft text-done border-done-line",
  attention: "bg-attention-soft text-attention border-attention-line",
  locked: "bg-locked-soft text-locked border-locked-line",
  danger: "bg-danger-soft text-danger border-danger-line",
};
const toneIcon: Record<ChipTone, LucideIcon> = { action: Circle, done: CheckCircle2, attention: Clock, locked: Lock, danger: AlertTriangle };

export function Chip({ tone, icon, children, className }: { tone: ChipTone; icon?: LucideIcon | null; children: ReactNode; className?: string }) {
  const Icon = icon === null ? null : (icon ?? toneIcon[tone]);
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[13px] font-medium whitespace-nowrap", toneClass[tone], className)}>
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {children}
    </span>
  );
}

/** Always visible on demo content, so demo data is never mistaken for real results. */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      title="Everything here is fictional demo data: the institution and the people. Classmates' past work comes from simulated students who worked through the real platform (its real viva, scoring and flags)."
      className={cx("inline-flex items-center rounded-md border border-attention-line bg-attention-soft px-2 py-0.5 text-xs font-semibold text-attention", className)}
    >
      Demo data
    </span>
  );
}

// ---------------------------------------------------------------- layout
export function Card({ children, className, as: As = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" }) {
  return <As className={cx("rounded-xl border border-line bg-surface", className)}>{children}</As>;
}

export function PageHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-ink-3">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------- states
export function Spinner({ label }: { label: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-ink-3">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      {label}
    </span>
  );
}

export function FullPageLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner label={label} />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("animate-pulse rounded-lg bg-locked-soft", className)} />;
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line-strong bg-surface px-6 py-10 text-center">
      <Icon className="size-8 text-ink-3" aria-hidden />
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 max-w-md text-ink-3">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-xl border border-danger-line bg-danger-soft px-6 py-8 text-center">
      <AlertTriangle className="size-7 text-danger" aria-hidden />
      <p className="mt-2 font-semibold text-danger">That didn't load</p>
      <p className="mt-1 max-w-md text-ink-2">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- toggle switch (role="switch")
export function Toggle({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx("relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors", checked ? "bg-action" : "bg-line-strong")}
    >
      <span className={cx("inline-block size-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-6" : "translate-x-1")} />
    </button>
  );
}

/** A row of mutually exclusive options (radio semantics). */
export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-lg bg-locked-soft p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx("min-h-9 rounded-md px-3 text-sm font-semibold transition-colors", o.value === value ? "bg-surface text-action shadow-sm" : "text-ink-2 hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A short Urdu label beside an English action (NFR-09). Decorative for screen readers that read the English. */
export function Ur({ children, className }: { children: string; className?: string }) {
  return (
    <span lang="ur" dir="rtl" className={cx("font-urdu text-[0.8em] leading-loose font-medium opacity-90", className)}>
      {children}
    </span>
  );
}
