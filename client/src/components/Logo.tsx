import { cx } from "./ui";

/**
 * The Socratic AI mark: one continuous S with a dot at each end. The two dots are the two people in the room,
 * Ustaad and the student; the curve between them is the conversation, question by question. The amber dot is Ustaad.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cx("shrink-0", className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#1d4ed8" />
      <path d="M18.7 7.42A5.4 4.6 0 1 0 16 16a5.4 4.6 0 1 1-2.7 8.58" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="21.38" cy="11.8" r="2.25" fill="#fbbf24" />
      <circle cx="10.62" cy="20.2" r="2.25" fill="#fff" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="size-8" />
      <span className="text-lg font-bold tracking-tight">
        Socratic <span className="text-action">AI</span>
      </span>
    </span>
  );
}
