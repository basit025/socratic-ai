/**
 * Work on the left, a side panel (Ustaad) on the right, with a handle between them that the student can drag
 * (or move with ← → when it has focus) to make the panel wider or narrower. Double-click resets it.
 * The width is remembered per browser. On small screens the panel simply sits below the work.
 */
import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { cx } from "./ui";
import { readPref, writePref } from "../lib/theme";

interface Props {
  main: ReactNode;
  side: ReactNode | null;
  /** localStorage key for the remembered width. */
  storageKey: string;
  /** What the handle resizes, for screen readers: "Ustaad panel". */
  label: string;
  defaultWidth?: number;
  minWidth?: number;
  /** The work area never gets narrower than this. */
  minMain?: number;
  className?: string;
}

const STEP = 32;

export function ResizableSplit({ main, side, storageKey, label, defaultWidth = 460, minWidth = 320, minMain = 440, className }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; w: number } | null>(null);
  const [width, setWidth] = useState(() => {
    const saved = Number(readPref(storageKey));
    return Number.isFinite(saved) && saved >= minWidth ? saved : defaultWidth;
  });
  const [dragging, setDragging] = useState(false);

  const maxWidth = () => Math.max(minWidth, (box.current?.clientWidth ?? 1280) - minMain - 20);
  const clamp = (v: number) => Math.round(Math.min(Math.max(v, minWidth), maxWidth()));
  const commit = (v: number) => {
    const c = clamp(v);
    setWidth(c);
    writePref(storageKey, String(c));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, w: Math.min(width, maxWidth()) };
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    // The panel is on the right, so dragging the handle left makes it wider.
    setWidth(clamp(drag.current.w + (drag.current.x - e.clientX)));
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    writePref(storageKey, String(width));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") commit(width + STEP);
    else if (e.key === "ArrowRight") commit(width - STEP);
    else if (e.key === "Home") commit(maxWidth());
    else if (e.key === "End") commit(minWidth);
    else return;
    e.preventDefault();
  };

  return (
    <div ref={box} className={cx("flex flex-col gap-5 lg:flex-row lg:gap-0", dragging && "cursor-col-resize select-none", className)}>
      <div className="min-w-0 flex-1 space-y-5">{main}</div>
      {side && (
        <>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={`Resize the ${label}: drag, or use the left and right arrow keys`}
            aria-valuenow={width}
            aria-valuemin={minWidth}
            aria-valuemax={maxWidth()}
            title={`Drag to resize the ${label} (double-click to reset)`}
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={() => commit(defaultWidth)}
            onKeyDown={onKeyDown}
            className="group relative hidden w-5 shrink-0 cursor-col-resize touch-none justify-center focus-visible:outline-none lg:flex"
          >
            <span className={cx("h-full w-0.5 rounded-full transition-colors", dragging ? "bg-action" : "bg-transparent group-hover:bg-line-strong group-focus-visible:bg-action")} aria-hidden />
            <span
              className={cx(
                "absolute top-40 flex h-10 w-4 items-center justify-center rounded-md border bg-surface transition-colors",
                dragging ? "border-action text-action" : "border-line text-ink-3 group-hover:border-line-strong group-hover:text-ink group-focus-visible:border-action group-focus-visible:text-action",
              )}
              aria-hidden
            >
              <GripVertical className="size-3.5" />
            </span>
          </div>
          <div className="min-w-0 lg:w-[var(--side-w)] lg:max-w-[calc(100%-460px)] lg:shrink-0" style={{ "--side-w": `${width}px` } as CSSProperties}>
            {side}
          </div>
        </>
      )}
    </div>
  );
}
