/**
 * Ustaad, the mentor: hints and Socratic questions while working, never answers.
 * When paste is blocked for the assignment, it's blocked here too (explanations must be typed).
 */
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Lightbulb, Loader2, Send } from "lucide-react";
import { Button, cx } from "../components/ui";

export interface ChatMessage {
  role: "student" | "ustaad";
  text: string;
  hint?: string | null;
  pending?: boolean;
}

interface Props {
  studentName: string;
  messages: ChatMessage[];
  sending: boolean;
  error: string | null;
  disabled: boolean;
  disabledReason?: string;
  pasteBlocked: boolean;
  starters: string[];
  onSend: (text: string) => void;
  onBlockedPaste: () => void;
  inputRef: (el: HTMLTextAreaElement | null) => void;
}

export function UstaadPanel({ studentName, messages, sending, error, disabled, disabledReason, pasteBlocked, starters, onSend, onBlockedPaste, inputRef }: Props) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length, sending]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const t = text.trim();
    if (!t || sending || disabled) return;
    onSend(t);
    setText("");
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <section aria-label="Ustaad, your mentor" className="flex h-full min-h-[480px] flex-col rounded-xl border border-line bg-surface">
      <header className="border-b border-line px-4 py-3">
        <h2 className="font-semibold">Ustaad · your mentor</h2>
        <p className="text-sm text-ink-3">Hints and questions, never answers. Your teacher can see this chat.</p>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="rounded-xl border border-line bg-canvas p-3.5 text-[15px] text-ink-2">
              Assalam-o-Alaikum {studentName}! I'm Ustaad. I'll never write your code for you, but I'll help you think it through. Ask me anything, in
              English or Roman Urdu.
            </div>
            {!disabled && (
              <div className="space-y-2">
                <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Try asking</p>
                {starters.map((s) => (
                  <button
                    key={s}
                    onClick={() => onSend(s)}
                    disabled={sending}
                    className="block w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-left text-sm hover:border-action hover:bg-action-soft"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cx("max-w-[92%]", m.role === "student" ? "ml-auto" : "mr-auto")}>
            <p className="mb-0.5 text-xs font-semibold text-ink-3">{m.role === "student" ? "You" : "Ustaad"}</p>
            <div className={cx("rounded-xl px-3.5 py-2.5 text-[15px] whitespace-pre-wrap", m.role === "student" ? "bg-action text-white" : "border border-line bg-canvas text-ink")}>
              {m.text}
            </div>
            {m.hint && (
              <p className="mt-1.5 flex gap-2 rounded-lg border border-attention-line bg-attention-soft px-3 py-2 text-sm text-ink-2">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-attention" aria-hidden />
                <span>
                  <strong className="text-attention">Hint:</strong> {m.hint}
                </span>
              </p>
            )}
          </div>
        ))}
        {sending && (
          <p className="flex items-center gap-2 text-sm text-ink-3" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Ustaad is thinking…
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="border-t border-line p-3">
        {disabled ? (
          <p className="px-1 py-2 text-sm text-ink-3">{disabledReason}</p>
        ) : (
          <div className="flex items-end gap-2">
            <label className="sr-only" htmlFor="ustaad-input">
              Message to Ustaad
            </label>
            <textarea
              id="ustaad-input"
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKey}
              onPaste={(e) => {
                if (!pasteBlocked) return;
                e.preventDefault();
                onBlockedPaste();
              }}
              onDrop={(e) => {
                if (!pasteBlocked) return;
                e.preventDefault();
                onBlockedPaste();
              }}
              rows={2}
              maxLength={1500}
              placeholder="Explain your thinking, or ask for a hint…"
              className="min-h-11 flex-1 resize-none rounded-lg border border-line-strong bg-surface px-3 py-2 text-[15px] focus:border-action focus:outline-none"
            />
            <Button type="submit" icon={Send} disabled={!text.trim() || sending} aria-label="Send to Ustaad">
              <span className="hidden sm:inline">Send</span>
            </Button>
          </div>
        )}
      </form>
    </section>
  );
}
