/**
 * CodeMirror 6 editor with paste/drop blocking and change capture for the recorder.
 * Blocking happens at the point of action and is never silent: onBlocked lets the page explain it.
 */
import { useEffect, useRef } from "react";
import { basicSetup } from "codemirror";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import { javascript } from "@codemirror/lang-javascript";
import type { Change } from "../../../shared/events";

export interface CodeEditorHandle {
  focus(): void;
  getDoc(): string;
}

interface Props {
  initialDoc: string;
  language: string | null;
  pasteBlocked: boolean;
  readOnly: boolean;
  onChange: (doc: string, changes: Change[]) => void;
  onBlocked: (source: "paste" | "drop", length: number) => void;
  onRunShortcut: () => void;
  handleRef: (h: CodeEditorHandle | null) => void;
  label: string;
}

const theme = EditorView.theme({
  "&": { fontSize: "15px", backgroundColor: "#ffffff", height: "100%" },
  ".cm-content": { fontFamily: "var(--font-mono)", padding: "12px 0", caretColor: "#1d4ed8" },
  ".cm-gutters": { backgroundColor: "#f8fafc", color: "#94a3b8", borderRight: "1px solid #e2e8f0" },
  ".cm-activeLine": { backgroundColor: "#eff6ff80" },
  ".cm-activeLineGutter": { backgroundColor: "#eff6ff", color: "#1d4ed8" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { lineHeight: "1.65" },
});

export function CodeEditor({ initialDoc, language, pasteBlocked, readOnly, onChange, onBlocked, onRunShortcut, handleRef, label }: Props) {
  const host = useRef<HTMLDivElement | null>(null);
  // Latest callbacks without recreating the editor.
  const cb = useRef({ onChange, onBlocked, onRunShortcut });
  cb.current = { onChange, onBlocked, onRunShortcut };

  useEffect(() => {
    if (!host.current) return;
    const extensions: Extension[] = [
      basicSetup,
      keymap.of([indentWithTab, { key: "Mod-Enter", run: () => (cb.current.onRunShortcut(), true) }]),
      language === "javascript" ? javascript() : python(),
      theme,
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ "aria-label": label }),
      EditorState.readOnly.of(readOnly),
      EditorView.editable.of(!readOnly),
      EditorView.updateListener.of((u) => {
        if (!u.docChanged) return;
        const collected: Change[] = [];
        u.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
          collected.push({ from: fromA, to: toA, insert: inserted.toString() });
        });
        // iterChanges reports positions in the OLD document, in ascending order. Applying them in
        // descending order keeps every position valid, which matches the event format's rule.
        collected.reverse();
        cb.current.onChange(u.state.doc.toString(), collected);
      }),
    ];
    if (pasteBlocked) {
      extensions.push(
        EditorView.domEventHandlers({
          paste: (e) => {
            e.preventDefault();
            cb.current.onBlocked("paste", e.clipboardData?.getData("text/plain").length ?? 0);
            return true;
          },
          drop: (e) => {
            e.preventDefault();
            cb.current.onBlocked("drop", e.dataTransfer?.getData("text/plain").length ?? 0);
            return true;
          },
          beforeinput: (e) => {
            if (e.inputType === "insertFromPaste" || e.inputType === "insertFromDrop" || e.inputType === "insertFromPasteAsQuotation") {
              e.preventDefault();
              cb.current.onBlocked(e.inputType === "insertFromDrop" ? "drop" : "paste", e.data?.length ?? 0);
              return true;
            }
            return false;
          },
        }),
      );
    }
    const view = new EditorView({ state: EditorState.create({ doc: initialDoc, extensions }), parent: host.current });
    handleRef({ focus: () => view.focus(), getDoc: () => view.state.doc.toString() });
    return () => {
      handleRef(null);
      view.destroy();
    };
    // The editor is created once per submission; later prop changes don't recreate it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, pasteBlocked, language]);

  return <div ref={host} className="h-full min-h-[320px] overflow-hidden" />;
}
