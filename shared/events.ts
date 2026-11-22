/**
 * Process-event format (FROZEN Nov 23, 2026). The contract between the workspace (records),
 * the API (validates + stores, append-only) and the teacher's replay (plays back).
 * Changing it needs the whole team's agreement: docs/event-format.md explains every field.
 */
import { z } from "zod";

export const EVENT_TYPES = [
  "keys",            // text inserted (typing, or typing over a selection)
  "delete",          // text removed only
  "paste_attempt",   // paste or drop blocked by the rules
  "run",             // student ran their code
  "error",           // that run ended in an error
  "focus_lost",      // tab or window hidden
  "focus_back",      // tab or window visible again
  "fullscreen_exit", // left fullscreen during a fullscreen-required task
  "snapshot",        // full document text, for fast seeking and as a checksum
  "submit",          // student pressed Submit; nothing after this is accepted
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const MAX_EVENTS_PER_BATCH = 500;
export const MAX_DOC_LENGTH = 100_000;
export const FLUSH_INTERVAL_MS = 10_000;
export const SNAPSHOT_EVERY_N_EVENTS = 25;
export const TYPING_IDLE_MS = 1_500;

/**
 * One text change. Positions are character offsets into the document AS IT IS just before
 * this change is applied; changes inside one event are applied in array order.
 */
export const ChangeSchema = z
  .object({
    from: z.number().int().min(0).max(MAX_DOC_LENGTH),
    to: z.number().int().min(0).max(MAX_DOC_LENGTH),
    insert: z.string().max(MAX_DOC_LENGTH),
  })
  .refine((c) => c.to >= c.from, { message: "to must be >= from" });
export type Change = z.infer<typeof ChangeSchema>;

const base = {
  seq: z.number().int().min(1),                       // 1, 2, 3 ... per submission, no gaps
  t: z.number().int().min(1_600_000_000_000),        // client clock, ms since epoch (the server records its own time too)
};

export const ProcessEventSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("keys"), payload: z.object({ changes: z.array(ChangeSchema).min(1).max(500), chars: z.number().int().min(0) }) }),
  z.object({
    ...base,
    type: z.literal("delete"),
    payload: z.object({
      changes: z.array(ChangeSchema.refine((c) => c.insert === "", { message: "delete changes insert nothing" })).min(1).max(500),
      chars: z.number().int().min(0),
    }),
  }),
  z.object({ ...base, type: z.literal("paste_attempt"), payload: z.object({ length: z.number().int().min(0), source: z.enum(["paste", "drop"]) }) }),
  z.object({ ...base, type: z.literal("run"), payload: z.object({ ok: z.boolean(), durationMs: z.number().int().min(0), docLength: z.number().int().min(0) }) }),
  z.object({ ...base, type: z.literal("error"), payload: z.object({ message: z.string().max(500) }) }),
  z.object({ ...base, type: z.literal("focus_lost"), payload: z.object({}).strict() }),
  z.object({ ...base, type: z.literal("focus_back"), payload: z.object({ awayMs: z.number().int().min(0) }) }),
  z.object({ ...base, type: z.literal("fullscreen_exit"), payload: z.object({}).strict() }),
  z.object({ ...base, type: z.literal("snapshot"), payload: z.object({ doc: z.string().max(MAX_DOC_LENGTH) }) }),
  z.object({ ...base, type: z.literal("submit"), payload: z.object({ docLength: z.number().int().min(0) }) }),
]);
export type ProcessEvent = z.infer<typeof ProcessEventSchema>;

/** Body of POST /api/submissions/:id/events */
export const EventBatchSchema = z
  .object({ events: z.array(ProcessEventSchema).min(1).max(MAX_EVENTS_PER_BATCH) })
  .refine((b) => b.events.every((e, i) => i === 0 || e.seq === b.events[i - 1]!.seq + 1), {
    message: "events in a batch must have consecutive seq numbers",
  });
export type EventBatch = z.infer<typeof EventBatchSchema>;
