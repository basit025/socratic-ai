import { useEffect, useRef, type ReactNode } from "react";

/**
 * Accessible confirmation dialog: focus moves in once when it opens (and back when it closes),
 * Esc closes it, and clicking the backdrop closes it.
 */
export function Dialog({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  const panel = useRef<HTMLDivElement | null>(null);
  // Keep the latest onClose without re-running the focus effect on every render
  // (re-focusing on each keystroke would yank the cursor out of the field being typed in).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("[data-autofocus], input, button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onCloseRef.current()}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="dialog-title" className="w-full max-w-lg rounded-xl bg-surface p-6 shadow-xl">
        <h2 id="dialog-title" className="text-xl font-bold">
          {title}
        </h2>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}
