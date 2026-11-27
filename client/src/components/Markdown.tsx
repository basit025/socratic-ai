/**
 * A small, safe Markdown renderer for course notes and assignment briefs (no HTML is ever injected).
 * Supports: ### headings, paragraphs, - and 1. lists, > key-idea callouts, ``` code blocks,
 * | tables |, **bold**, *italic* and `code`.
 */
import { Fragment, type ReactNode } from "react";
import { Lightbulb } from "lucide-react";
import { cx } from "./ui";

function inline(text: string, keyBase = ""): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).map((part, i) => {
    const k = `${keyBase}${i}`;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2)
      return <code key={k} className="rounded bg-locked-soft px-1 py-0.5 font-mono text-[0.9em] text-ink">{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={k} className="font-semibold text-ink">{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={k}>{part.slice(1, -1)}</em>;
    return <Fragment key={k}>{part}</Fragment>;
  });
}

type Block =
  | { kind: "h"; level: 3 | 4; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "code"; lang: string; text: string }
  | { kind: "table"; head: string[]; rows: string[][] };

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = line.match(/^```(\w*)/);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith("```")) body.push(lines[i++]!);
      i++;
      blocks.push({ kind: "code", lang: fence[1] ?? "", text: body.join("\n") });
      continue;
    }
    const h = line.match(/^(#{2,4})\s+(.*)/);
    if (h) {
      blocks.push({ kind: "h", level: h[1]!.length <= 3 ? 3 : 4, text: h[2]! });
      i++;
      continue;
    }
    if (line.trim().startsWith("|") && lines[i + 1]?.trim().match(/^\|?\s*:?-{2,}/)) {
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.trim().startsWith("|")) rows.push(cells(lines[i++]!));
      blocks.push({ kind: "table", head, rows });
      continue;
    }
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && (ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/).test(lines[i]!)) {
        items.push(lines[i]!.replace(ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/, ""));
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]!) && !/^\s*([-*]|\d+[.)])\s+/.test(lines[i]!)) items[items.length - 1] += " " + lines[i++]!.trim();
      }
      blocks.push({ kind: ordered ? "ol" : "ul", items });
      continue;
    }
    if (line.startsWith(">")) {
      const body: string[] = [];
      while (i < lines.length && lines[i]!.startsWith(">")) body.push(lines[i++]!.replace(/^>\s?/, ""));
      blocks.push({ kind: "quote", text: body.join(" ") });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^(```|#{2,4}\s|>|\s*[-*]\s+|\s*\d+[.)]\s+|\|)/.test(lines[i]!)) para.push(lines[i++]!.trim());
    if (para.length) blocks.push({ kind: "p", text: para.join(" ") });
    else i++; // a line that only looked like a block start
  }
  return blocks;
}

export function Markdown({ text, className, variant = "notes" }: { text: string; className?: string; variant?: "notes" | "slide" }) {
  const slide = variant === "slide";
  return (
    <div className={cx(slide ? "space-y-4 text-lg leading-relaxed text-ink-2 xl:text-xl" : "space-y-3 text-[15px] leading-relaxed text-ink-2", className)}>
      {parseMarkdown(text).map((b, i) => {
        switch (b.kind) {
          case "h":
            return b.level === 3 ? (
              <h3 key={i} className={cx("pt-1 font-semibold text-ink", slide ? "text-xl xl:text-2xl" : "text-base")}>{inline(b.text)}</h3>
            ) : (
              <h4 key={i} className="pt-1 text-[15px] font-semibold text-ink">{inline(b.text)}</h4>
            );
          case "p":
            return <p key={i}>{inline(b.text, `${i}-`)}</p>;
          case "ul":
            return (
              <ul key={i} className="list-disc space-y-1 pl-5 marker:text-ink-3">
                {b.items.map((it, j) => <li key={j}>{inline(it, `${i}-${j}-`)}</li>)}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="list-decimal space-y-1 pl-5 marker:text-ink-3">
                {b.items.map((it, j) => <li key={j}>{inline(it, `${i}-${j}-`)}</li>)}
              </ol>
            );
          case "quote":
            return (
              <p key={i} className="flex gap-2.5 rounded-lg border border-action-line bg-action-soft px-3.5 py-2.5 text-ink">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-action" aria-hidden />
                <span>{inline(b.text, `${i}-`)}</span>
              </p>
            );
          case "code":
            return (
              <pre key={i} className={cx("overflow-x-auto rounded-lg border border-line bg-canvas px-3.5 py-3 font-mono leading-6 text-ink", slide ? "text-base xl:text-lg leading-7" : "text-[13.5px]")} aria-label={b.lang ? `${b.lang} code` : "code"}>
                <code>{b.text}</code>
              </pre>
            );
          case "table":
            return (
              <div key={i} className="overflow-x-auto rounded-lg border border-line">
                <table className={cx("w-full text-left", slide ? "text-base xl:text-lg" : "text-sm")}>
                  <thead className="bg-canvas text-ink">
                    <tr>{b.head.map((h, j) => <th key={j} className="px-3 py-2 font-semibold">{inline(h)}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {b.rows.map((r, j) => (
                      <tr key={j}>{r.map((c, k) => <td key={k} className="px-3 py-2 align-top">{inline(c, `${i}-${j}-${k}-`)}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </div>
  );
}
