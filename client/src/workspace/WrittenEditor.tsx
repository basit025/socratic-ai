/**
 * Plain-text editor for written answers (FR-10): paste and drop blocked with an inline explanation,
 * a live word count, and every change captured in the same frozen event format as code.
 */
import { useEffect, useRef, useState } from "react";
import type { Change } from "../../../shared/events";
import { diffOne } from "../../../shared/diff";

export const countWords = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

interface Props {
  initial: string;
  readOnly: boolean;
  pasteBlocked: boolean;
  onChange: (doc: string, changes: Change[]) => void;
  onBlocked: (source: "paste" | "drop", length: number) => void;
  focusRef: (el: HTMLTextAreaElement | null) => void;
  label: string;
}

export function WrittenEditor({ initial, readOnly, pasteBlocked, onChange, onBlocked, focusRef, label }: Props) {
  const [text, setText] = useState(initial);
  const prev = useRef(initial);
  useEffect(() => {
    prev.current = initial;
    setText(initial);
  }, [initial]);

  return (
    <div>
      <textarea
        ref={focusRef}
        aria-label={label}
        value={text}
        readOnly={readOnly}
        onChange={(e) => {
          const next = e.target.value;
          const ch = diffOne(prev.current, next);
          prev.current = next;
          setText(next);
          if (ch) onChange(next, [ch]);
        }}
        onPaste={(e) => {
          if (!pasteBlocked) return;
          e.preventDefault();
          onBlocked("paste", e.clipboardData.getData("text/plain").length);
        }}
        onDrop={(e) => {
          if (!pasteBlocked) return;
          e.preventDefault();
          onBlocked("drop", e.dataTransfer.getData("text/plain").length);
        }}
        rows={14}
        placeholder="Write your answer in your own words…"
        className="block min-h-[320px] w-full resize-y border-0 bg-surface p-4 text-[16px] leading-7 focus:outline-none"
      />
      <div className="flex justify-end border-t border-line px-4 py-2 text-sm text-ink-3" aria-live="polite">
        {countWords(text)} words
      </div>
    </div>
  );
}
