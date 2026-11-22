import { cx } from "./ui";

/** The Socratic AI mark: a speech bubble (Ustaad's question) holding a check (understanding verified). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cx("shrink-0", className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#1d4ed8" />
      <path d="M8 9.5h16a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-8.5L10.5 26v-4H8a2 2 0 0 1-2-2v-8.5a2 2 0 0 1 2-2Z" fill="#fff" />
      <path d="M11.5 15.8l3 3 6-6.3" fill="none" stroke="#1d4ed8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="size-8" />
      <span className="text-lg font-bold tracking-tight">Socratic AI</span>
    </span>
  );
}
