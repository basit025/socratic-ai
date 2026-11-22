# Process-event format (frozen Nov 23, 2026)

The workspace records **how** an answer was written. This file is the contract between three parts that are built in parallel:

| Part | Owner | Does |
| --- | --- | --- |
| Workspace recorder | R2 | Turns editor activity into events and sends them in batches |
| Event API | R4 | Validates each batch and stores it, append-only |
| Teacher replay and flags | R3, R1 | Rebuild the document and spot patterns |

The code version is `shared/events.ts` (zod schemas, used by both browser and server) and `shared/replay.ts` (rebuilds the document). **If this file and the code disagree, the code wins, and tell R1.** Changing the format needs the whole team's agreement, because recorded seed sessions depend on it.

## The envelope

Every event has the same outer shape:

```json
{ "seq": 12, "t": 1795400000000, "type": "keys", "payload": { ... } }
```

| Field | Meaning |
| --- | --- |
| `seq` | 1, 2, 3 … per submission. No gaps and no repeats. The server ignores a `seq` it already has, so resending a batch is safe |
| `t` | The browser's clock in milliseconds. The **server also records its own time** on arrival (`server_time`), which the student can't change |
| `type` | One of the ten types below |
| `payload` | Depends on the type |

## The ten event types

| Type | When the browser sends it | Payload |
| --- | --- | --- |
| `keys` | Text was inserted: typing, or typing over a selection. Coalesce typing into one event after **1.5 s idle** or about 200 characters | `{ "changes": [{ "from", "to", "insert" }], "chars": n }` |
| `delete` | Text was only removed (Backspace, Delete, cut) | `{ "changes": [{ "from", "to", "insert": "" }], "chars": n }` |
| `paste_attempt` | A paste or drag-drop was blocked by the rules (the inline message appears at the same moment) | `{ "length": n, "source": "paste" or "drop" }` |
| `run` | The student clicked "Run my code" | `{ "ok": true/false, "durationMs": n, "docLength": n }` |
| `error` | That run ended in an error | `{ "message": "first 500 characters" }` |
| `focus_lost` | The tab or window was hidden | `{}` |
| `focus_back` | It became visible again | `{ "awayMs": n }` |
| `fullscreen_exit` | The student left fullscreen on a fullscreen-required task | `{}` |
| `snapshot` | Every **25 events**, on every run and right before submit | `{ "doc": "the full current text" }` |
| `submit` | The student pressed Submit. Nothing after it is accepted | `{ "docLength": n }` |

### How `changes` work

Positions are character offsets into the document **as it is just before that change**. Several changes in one event are applied **in order**. This matches CodeMirror's `iterChanges` when you convert each change in sequence.

Example: the document is `print(x)` and the student renames `x` to `total`:

```json
{ "seq": 7, "t": 1795400004000, "type": "keys",
  "payload": { "changes": [{ "from": 6, "to": 7, "insert": "total" }], "chars": 5 } }
```

## Sending

- **POST** `/api/submissions/:id/events` with body `{ "events": [ ... ], "doc": "current text", "lastOutput": "..." }`: 1 to 500 events with consecutive `seq` numbers. `doc` and `lastOutput` are optional and autosave the editor (additive to the frozen event format).
- After **Submit** the submission is locked and this endpoint answers 409; the recorder sends nothing more.
- Send every **10 seconds**, immediately on run and submit, and on `visibilitychange` to hidden (use `navigator.sendBeacon`, so events aren't lost when the tab closes).
- If a send fails, keep the events and resend them with the next batch. Duplicates are ignored.
- The workspace keeps working offline; the "Saved 3 s ago" indicator shows the time of the last successful send.

## Storage rules (enforced by the database, not just the code)

- Events can **never be edited**. Deleting them is impossible except through the nightly reset of expired demo sandboxes.
- `server_time` is always set by the database on arrival.
- Each `(submission, seq)` pair is unique.

## What the flags read from the log

| Flag (shown to the teacher as a plain sentence) | Evidence in the log |
| --- | --- |
| Large instant insertion | A `keys` event with a big `chars` count in a very short time |
| Typing much faster than the student's own baseline | Characters per second, compared with the same student's earlier events |
| Long focus loss, then a burst | `focus_back` with a large `awayMs`, followed quickly by large `keys` events |
| Correct submission with no runs | `submit` with no earlier `run` event |
| Perfect tests, low viva score | Test results and viva score (stored on the submission, not in the log) |

Every flag stores the `seq` range it came from, so the teacher's "Show me" link jumps to exactly that moment in the replay.
