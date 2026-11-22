/**
 * Process replay: a story timeline of the session (runs, errors, paste attempts, time away) and the
 * code as it stood at any moment. "Show me" jumps here via `jumpToSeq`.
 * Long idle gaps are compressed on the timeline (time away is still drawn and labelled with its real length).
 */
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ClipboardX, EyeOff, Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { buildReplay } from "../../../shared/replay";
import type { ProcessEvent } from "../../../shared/events";
import { Button, cx } from "../components/ui";

export interface ReplayEvent {
  seq: number;
  t: number;
  type: ProcessEvent["type"];
  payload: unknown;
}

const MAX_GAP_MS = 180_000; // gaps longer than 3 min are drawn as 3 min

export function fmtOffset(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${s % 60 ? `${s % 60} s` : ""}`.trim();
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

function describe(e: ReplayEvent): string {
  const p = e.payload as Record<string, unknown>;
  switch (e.type) {
    case "keys":
      return `Typed ${p.chars} character${p.chars === 1 ? "" : "s"}`;
    case "delete":
      return `Deleted ${p.chars} character${p.chars === 1 ? "" : "s"}`;
    case "paste_attempt":
      return `Tried to paste ${p.length ? `${p.length} characters` : "text"} (blocked)`;
    case "run":
      return p.ok ? "Ran the code: no errors" : "Ran the code: it failed";
    case "error":
      return `Error: ${String(p.message ?? "").split("\n").at(-1)}`;
    case "focus_lost":
      return "Left the page";
    case "focus_back":
      return `Came back after ${fmtOffset(Number(p.awayMs ?? 0))}`;
    case "fullscreen_exit":
      return "Left fullscreen";
    case "snapshot":
      return "Checkpoint";
    case "submit":
      return "Submitted";
  }
}

export function Replay({ starterCode, events, jumpToSeq, highlightSeqs, compact }: { starterCode: string; events: ReplayEvent[]; jumpToSeq?: { seq: number; nonce: number } | null; highlightSeqs?: Set<number>; compact?: boolean }) {
  const frames = useMemo(() => buildReplay(starterCode, events as ProcessEvent[]), [starterCode, events]);
  const [idx, setIdx] = useState(frames.length - 1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);

  // Compressed time axis.
  const axis = useMemo(() => {
    const pos: number[] = [];
    let acc = 0;
    events.forEach((e, i) => {
      if (i > 0) acc += Math.min(MAX_GAP_MS, Math.max(0, e.t - events[i - 1]!.t));
      pos.push(acc);
    });
    return { pos, total: Math.max(1, acc) };
  }, [events]);
  const start = events[0]?.t ?? 0;

  useEffect(() => setIdx(frames.length - 1), [frames.length]);
  useEffect(() => {
    if (!jumpToSeq) return;
    const i = events.findIndex((e) => e.seq >= jumpToSeq.seq);
    if (i >= 0) {
      setPlaying(false);
      setIdx(i);
    }
  }, [jumpToSeq, events]);
  useEffect(() => {
    if (!playing) return;
    if (idx >= frames.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setIdx((i) => Math.min(frames.length - 1, i + 1)), 1000 / speed);
    return () => clearTimeout(t);
  }, [playing, idx, speed, frames.length]);

  if (events.length === 0) {
    return <p className="rounded-lg border border-dashed border-line-strong p-6 text-center text-ink-3">No recorded activity yet.</p>;
  }

  const frame = frames[Math.max(0, idx)]!;
  const current = events[Math.max(0, idx)]!;
  const lines = frame.doc.split("\n");
  const pct = (i: number) => `${(axis.pos[i]! / axis.total) * 100}%`;

  // Time-away spans.
  const spans: { from: number; to: number; ms: number }[] = [];
  events.forEach((e, i) => {
    if (e.type === "focus_lost") {
      const j = events.findIndex((x, k) => k > i && x.type === "focus_back");
      if (j > 0) spans.push({ from: i, to: j, ms: Number((events[j]!.payload as { awayMs?: number }).awayMs ?? events[j]!.t - e.t) });
    }
  });

  return (
    <div>
      {/* Story timeline */}
      <div className="relative h-12 select-none" aria-label="Session timeline">
        <div className="absolute inset-x-0 top-5 h-2 rounded-full bg-locked-soft" />
        {spans.map((s, k) => (
          <div key={k} className="absolute top-3.5 h-5 rounded bg-locked/25" style={{ left: pct(s.from), width: `calc(${pct(s.to)} - ${pct(s.from)})`, minWidth: 6 }} title={`Away for ${fmtOffset(s.ms)}`}>
            <EyeOff className="mx-auto mt-0.5 size-4 text-ink-2" aria-hidden />
          </div>
        ))}
        {events.map((e, i) => {
          const p = e.payload as { ok?: boolean };
          const kind =
            e.type === "run" ? (p.ok ? "run_ok" : "run_err") : e.type === "paste_attempt" ? "paste" : e.type === "submit" ? "submit" : highlightSeqs?.has(e.seq) ? "flag" : null;
          if (!kind) return null;
          return (
            <button
              key={e.seq}
              onClick={() => {
                setPlaying(false);
                setIdx(i);
              }}
              title={`${fmtOffset(e.t - start)} · ${describe(e)}`}
              aria-label={`${fmtOffset(e.t - start)}: ${describe(e)}`}
              className={cx(
                "absolute top-3 size-6 -translate-x-1/2 rounded-full border-2 border-surface shadow-sm",
                kind === "run_ok" && "bg-done",
                kind === "run_err" && "bg-danger",
                kind === "paste" && "bg-attention",
                kind === "submit" && "bg-ink",
                kind === "flag" && "bg-attention ring-2 ring-attention/40",
              )}
              style={{ left: pct(i) }}
            />
          );
        })}
        <div className="pointer-events-none absolute top-1 h-10 w-0.5 -translate-x-1/2 bg-action" style={{ left: pct(Math.max(0, idx)) }} aria-hidden />
      </div>
      {!compact && (
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3" aria-label="Timeline legend">
          <li className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-done" />Run, no errors</li>
          <li className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-danger" />Run with an error</li>
          <li className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-attention" />Blocked paste</li>
          <li className="flex items-center gap-1.5"><EyeOff className="size-3.5" />Away from the page</li>
          <li className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-ink" />Submitted</li>
        </ul>
      )}

      {/* Controls */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="secondary" icon={playing ? Pause : idx >= frames.length - 1 ? RotateCcw : Play} onClick={() => (idx >= frames.length - 1 && !playing ? (setIdx(0), setPlaying(true)) : setPlaying(!playing))}>
          {playing ? "Pause" : idx >= frames.length - 1 ? "Replay from start" : "Play"}
        </Button>
        <label className="flex items-center gap-1.5 text-sm text-ink-3">
          Speed
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="min-h-9 rounded-md border border-line-strong bg-surface px-2 text-ink">
            <option value={2}>2×</option>
            <option value={4}>4×</option>
            <option value={12}>12×</option>
          </select>
        </label>
        <Button variant="ghost" icon={SkipForward} onClick={() => setIdx(frames.length - 1)}>
          Final code
        </Button>
        <input
          type="range"
          min={0}
          max={frames.length - 1}
          value={Math.max(0, idx)}
          onChange={(e) => {
            setPlaying(false);
            setIdx(Number(e.target.value));
          }}
          aria-label="Scrub through the session"
          className="min-w-40 flex-1 accent-[var(--color-action)]"
        />
      </div>
      <p className="mt-2 flex items-center gap-2 text-sm" aria-live="polite">
        <span className="font-mono text-ink-3 tabular-nums">+{fmtOffset(current.t - start)}</span>
        <span className={cx("font-medium", current.type === "paste_attempt" && "text-attention", current.type === "error" || (current.type === "run" && !(current.payload as { ok?: boolean }).ok) ? "text-danger" : "")}>
          {current.type === "paste_attempt" && <ClipboardX className="mr-1 inline size-4" aria-hidden />}
          {current.type === "error" && <AlertTriangle className="mr-1 inline size-4" aria-hidden />}
          {describe(current)}
        </span>
        {highlightSeqs?.has(current.seq) && <span className="rounded bg-attention-soft px-1.5 text-xs font-semibold text-attention">Flagged moment</span>}
        {frame.snapshotMismatch && <span className="text-xs text-ink-3">(resynced from a checkpoint)</span>}
      </p>

      {/* Code at this moment */}
      <pre className={cx("mt-2 overflow-auto rounded-lg border border-line bg-surface py-3 font-mono text-[13px] leading-6", compact ? "max-h-64" : "max-h-96")}>
        {lines.map((l, i) => (
          <div key={i} className="flex">
            <span className="w-10 shrink-0 pr-3 text-right text-ink-3 select-none">{i + 1}</span>
            <span className="whitespace-pre-wrap">{l || " "}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}
