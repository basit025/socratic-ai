import { describe, expect, it } from "vitest";
import { EventBatchSchema, ProcessEventSchema } from "./events.js";
import { applyChanges, buildReplay, frameAtTime } from "./replay.js";
import type { ProcessEvent } from "./events.js";

const T = 1_795_400_000_000;

describe("event schema", () => {
  it("accepts a valid typing event", () => {
    const e = { seq: 1, t: T, type: "keys", payload: { changes: [{ from: 0, to: 0, insert: "x = 1" }], chars: 5 } };
    expect(ProcessEventSchema.safeParse(e).success).toBe(true);
  });

  it("rejects unknown types, missing payloads and bad positions", () => {
    expect(ProcessEventSchema.safeParse({ seq: 1, t: T, type: "copy", payload: {} }).success).toBe(false);
    expect(ProcessEventSchema.safeParse({ seq: 1, t: T, type: "run" }).success).toBe(false);
    expect(
      ProcessEventSchema.safeParse({ seq: 1, t: T, type: "keys", payload: { changes: [{ from: 5, to: 2, insert: "a" }], chars: 1 } }).success,
    ).toBe(false);
  });

  it("rejects a delete event that inserts text", () => {
    const e = { seq: 1, t: T, type: "delete", payload: { changes: [{ from: 0, to: 3, insert: "sneaky" }], chars: 3 } };
    expect(ProcessEventSchema.safeParse(e).success).toBe(false);
  });

  it("requires consecutive seq numbers in a batch", () => {
    const ok = { events: [{ seq: 4, t: T, type: "focus_lost", payload: {} }, { seq: 5, t: T + 1, type: "focus_back", payload: { awayMs: 1 } }] };
    const gap = { events: [{ seq: 4, t: T, type: "focus_lost", payload: {} }, { seq: 6, t: T + 1, type: "focus_back", payload: { awayMs: 1 } }] };
    expect(EventBatchSchema.safeParse(ok).success).toBe(true);
    expect(EventBatchSchema.safeParse(gap).success).toBe(false);
  });
});

describe("replay", () => {
  it("applies changes in order", () => {
    expect(applyChanges("print(x)", [{ from: 6, to: 7, insert: "total" }, { from: 0, to: 0, insert: "# a\n" }])).toBe("# a\nprint(total)");
  });

  it("rebuilds the document frame by frame and trusts snapshots", () => {
    const events: ProcessEvent[] = [
      { seq: 1, t: T, type: "keys", payload: { changes: [{ from: 0, to: 0, insert: "runs = 0" }], chars: 8 } },
      { seq: 2, t: T + 1000, type: "run", payload: { ok: true, durationMs: 40, docLength: 8 } },
      { seq: 3, t: T + 2000, type: "delete", payload: { changes: [{ from: 7, to: 8, insert: "" }], chars: 1 } },
      { seq: 4, t: T + 3000, type: "snapshot", payload: { doc: "runs = 10" } },
    ];
    const frames = buildReplay("", events);
    expect(frames.map((f) => f.doc)).toEqual(["runs = 0", "runs = 0", "runs = ", "runs = 10"]);
    expect(frames[3]!.snapshotMismatch).toBe(true);
    expect(frameAtTime(frames, T + 2500)).toBe(2);
    expect(frameAtTime(frames, T - 1)).toBe(-1);
  });

  it("never throws on out-of-range positions", () => {
    expect(applyChanges("abc", [{ from: 10, to: 20, insert: "!" }])).toBe("abc!");
  });
});
