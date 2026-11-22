/**
 * Rebuilds the document from a process-event log. Used by the teacher's replay (frames to
 * scrub through) and by the integrity flags. Pure functions: no DOM, no network.
 */
import type { Change, ProcessEvent } from "./events.js";

export function applyChanges(doc: string, changes: readonly Change[]): string {
  let out = doc;
  for (const c of changes) {
    const from = Math.min(c.from, out.length);
    const to = Math.min(Math.max(c.to, from), out.length);
    out = out.slice(0, from) + c.insert + out.slice(to);
  }
  return out;
}

export interface ReplayFrame {
  seq: number;
  t: number;
  type: ProcessEvent["type"];
  doc: string;            // document after this event
  snapshotMismatch?: true; // the rebuilt text differed from a snapshot; the snapshot wins
}

/**
 * One frame per event. Snapshots are trusted over the rebuilt text, so one lost batch never
 * corrupts the rest of the replay; a mismatch is marked so the teacher view can say so.
 */
export function buildReplay(initialDoc: string, events: readonly ProcessEvent[]): ReplayFrame[] {
  const frames: ReplayFrame[] = [];
  let doc = initialDoc;
  const sorted = [...events].sort((a, b) => a.seq - b.seq);
  for (const e of sorted) {
    let mismatch = false;
    if (e.type === "keys" || e.type === "delete") {
      doc = applyChanges(doc, e.payload.changes);
    } else if (e.type === "snapshot") {
      mismatch = e.payload.doc !== doc;
      doc = e.payload.doc;
    }
    frames.push({ seq: e.seq, t: e.t, type: e.type, doc, ...(mismatch ? { snapshotMismatch: true as const } : {}) });
  }
  return frames;
}

/** Index of the last frame at or before a time (for "Show me" links and the scrubber). */
export function frameAtTime(frames: readonly ReplayFrame[], t: number): number {
  let lo = 0;
  let hi = frames.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid]!.t <= t) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}
