/**
 * Records how the answer is written, in the frozen format (docs/event-format.md), and saves it.
 * - Typing is coalesced into one `keys` (or `delete`) event after TYPING_IDLE_MS or ~200 chars.
 * - A `snapshot` every SNAPSHOT_EVERY_N_EVENTS events, on every run and before submit.
 * - Tab hidden/visible → focus_lost / focus_back.
 * - Sends every FLUSH_INTERVAL_MS, immediately on run/submit, and with keepalive when the page hides.
 * - A failed send keeps the events and retries with the next one (the server ignores duplicates).
 */
import { FLUSH_INTERVAL_MS, SNAPSHOT_EVERY_N_EVENTS, TYPING_IDLE_MS, type Change, type ProcessEvent } from "../../../shared/events";

export type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; at: number } | { kind: "error"; message: string };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** An event before the recorder stamps it with seq and time. */
type Draft = DistributiveOmit<ProcessEvent, "seq" | "t">;

const MAX_CHARS_PER_BURST = 200;

export class EventRecorder {
  private seq: number;
  private queue: ProcessEvent[] = [];
  private burst: Change[] = [];
  private burstInserted = 0;
  private burstRemoved = 0;
  private burstTimer: ReturnType<typeof setTimeout> | null = null;
  private flushTimer: ReturnType<typeof setInterval>;
  private sinceSnapshot = 0;
  private awaySince: number | null = null;
  private inFlight = false;
  private state: SaveState = { kind: "idle" };
  private listeners = new Set<() => void>();
  private getDoc: () => string;
  private getOutput: () => string | null;
  private stopped = false;

  constructor(
    private readonly submissionId: string,
    firstSeq: number,
    opts: { getDoc: () => string; getOutput: () => string | null },
  ) {
    this.seq = firstSeq;
    this.getDoc = opts.getDoc;
    this.getOutput = opts.getOutput;
    this.flushTimer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("pagehide", this.onPageHide);
  }

  // ------------------------------------------------ observable save state ("Saved 3 s ago")
  getState = () => this.state;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private setState(s: SaveState) {
    this.state = s;
    this.listeners.forEach((fn) => fn());
  }

  // ------------------------------------------------ recording
  private push(e: Draft) {
    if (this.stopped) return;
    this.queue.push({ ...e, seq: this.seq++, t: Date.now() } as ProcessEvent);
    if (e.type !== "snapshot" && ++this.sinceSnapshot >= SNAPSHOT_EVERY_N_EVENTS) this.snapshot();
  }

  /** Changes from one editor transaction, already ordered so they apply one after another. */
  recordChanges(changes: Change[]) {
    for (const c of changes) {
      this.burst.push(c);
      this.burstInserted += c.insert.length;
      this.burstRemoved += c.to - c.from;
    }
    if (this.burstInserted + this.burstRemoved >= MAX_CHARS_PER_BURST) this.endBurst();
    else {
      if (this.burstTimer) clearTimeout(this.burstTimer);
      this.burstTimer = setTimeout(() => this.endBurst(), TYPING_IDLE_MS);
    }
  }

  private endBurst() {
    if (this.burstTimer) clearTimeout(this.burstTimer);
    this.burstTimer = null;
    if (!this.burst.length) return;
    const changes = this.burst;
    const onlyDeletes = changes.every((c) => c.insert === "");
    this.push(
      onlyDeletes
        ? { type: "delete", payload: { changes, chars: this.burstRemoved } }
        : { type: "keys", payload: { changes, chars: this.burstInserted } },
    );
    this.burst = [];
    this.burstInserted = 0;
    this.burstRemoved = 0;
  }

  snapshot() {
    this.endBurst();
    this.sinceSnapshot = 0;
    this.push({ type: "snapshot", payload: { doc: this.getDoc() } });
  }

  recordPasteAttempt(length: number, source: "paste" | "drop") {
    this.endBurst();
    this.push({ type: "paste_attempt", payload: { length, source } });
  }

  recordRun(ok: boolean, durationMs: number, error?: string) {
    this.endBurst();
    this.push({ type: "run", payload: { ok, durationMs: Math.round(durationMs), docLength: this.getDoc().length } });
    if (!ok && error) this.push({ type: "error", payload: { message: error.slice(0, 500) } });
    this.snapshot();
    void this.flush();
  }

  /** Last events before submitting: a snapshot and the submit marker, sent right away. */
  async recordSubmit(): Promise<boolean> {
    this.snapshot();
    this.push({ type: "submit", payload: { docLength: this.getDoc().length } });
    while (this.inFlight) await new Promise((r) => setTimeout(r, 50)); // let an autosave finish first
    const ok = await this.flush();
    this.stop();
    return ok;
  }

  private onVisibility = () => {
    if (document.visibilityState === "hidden") {
      if (this.awaySince != null) return;
      this.endBurst();
      this.awaySince = Date.now();
      this.push({ type: "focus_lost", payload: {} });
      this.flushWithKeepalive();
    } else if (this.awaySince != null) {
      this.push({ type: "focus_back", payload: { awayMs: Date.now() - this.awaySince } });
      this.awaySince = null;
    }
  };

  private onPageHide = () => {
    this.endBurst();
    this.flushWithKeepalive();
  };

  // ------------------------------------------------ sending
  private body(events: ProcessEvent[]) {
    const output = this.getOutput();
    return JSON.stringify({ events: events.length ? events : undefined, doc: this.getDoc(), ...(output != null ? { lastOutput: output.slice(0, 10_000) } : {}) });
  }

  /** Sends queued events + the current text. Returns true when everything queued is saved. */
  async flush(): Promise<boolean> {
    if (this.stopped) return this.queue.length === 0; // after submit nothing more may be sent (the server would refuse it)
    if (this.inFlight) return false;
    const batch = this.queue.slice(0, 500);
    this.inFlight = true;
    this.setState({ kind: "saving" });
    try {
      const res = await fetch(`/api/submissions/${this.submissionId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: this.body(batch),
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Couldn't save. Retrying…");
      }
      this.queue.splice(0, batch.length);
      this.setState({ kind: "saved", at: Date.now() });
      return this.queue.length === 0;
    } catch (err) {
      this.setState({ kind: "error", message: err instanceof Error && err.message !== "Failed to fetch" ? err.message : "Offline. Your work is kept here and will save when you're back online." });
      return false;
    } finally {
      this.inFlight = false;
    }
  }

  private flushWithKeepalive() {
    if (this.stopped || !this.queue.length) return;
    // keepalive lets the request finish even if the tab is closing. Duplicates are ignored by the server.
    void fetch(`/api/submissions/${this.submissionId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: this.body(this.queue.slice(0, 200)),
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => {});
  }

  stop() {
    this.stopped = true;
    clearInterval(this.flushTimer);
    if (this.burstTimer) clearTimeout(this.burstTimer);
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("pagehide", this.onPageHide);
  }
}
