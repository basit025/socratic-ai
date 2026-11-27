/**
 * The assignment journey (Understand → Write → Run → Explain → Submit + viva) is a sequence:
 * a step is shown as done only when every step before it is done, so the stepper can never show a
 * green step after a grey one. The first step that isn't done is the current one; later steps are
 * upcoming, or locked with a reason.
 */

export interface RawStep {
  key: string;
  label: string;
  done: boolean;
  lockedHint?: string;
}

export interface StepState {
  key: string;
  label: string;
  state: "done" | "current" | "upcoming" | "locked";
  hint?: string;
}

export function journeyStates(raw: RawStep[]): StepState[] {
  let blocked = false;
  return raw.map((s) => {
    if (!blocked && s.done) return { key: s.key, label: s.label, state: "done" };
    if (!blocked) {
      blocked = true;
      return { key: s.key, label: s.label, state: "current" };
    }
    return s.lockedHint ? { key: s.key, label: s.label, state: "locked", hint: s.lockedHint } : { key: s.key, label: s.label, state: "upcoming" };
  });
}

/** A run counts as the student's Run only when the code differs from the starter code. */
export function isOwnCode(code: string, starter: string): boolean {
  return code.trim() !== starter.trim();
}
