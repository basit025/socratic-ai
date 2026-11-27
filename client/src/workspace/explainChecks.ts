/**
 * The "Explain" step (T02): it is done only when Ustaad's comprehension checks say the student has
 * explained their work, not after any one message. Until then Submit stays locked and the student is
 * told exactly what is still missing. Checks are kept per submission in this browser (localStorage),
 * so a reload doesn't lose them; the server-side version is backlog T01 (later).
 */

export interface ExplainChecks {
  goalClear: boolean;
  logicExplained: boolean;
  outputInterpreted: boolean;
}

export type CheckKey = keyof ExplainChecks;
export type WorkKind = "code" | "written";
export type Workflow = "run_first" | "explain_first";

export const NO_CHECKS: ExplainChecks = { goalClear: false, logicExplained: false, outputInterpreted: false };

/** A check met once stays met: Ustaad may judge a later, unrelated message on its own. */
export function mergeChecks(prev: ExplainChecks, next: Partial<ExplainChecks> | null | undefined): ExplainChecks {
  return {
    goalClear: prev.goalClear || Boolean(next?.goalClear),
    logicExplained: prev.logicExplained || Boolean(next?.logicExplained),
    outputInterpreted: prev.outputInterpreted || Boolean(next?.outputInterpreted),
  };
}

/** Which checks the Explain step needs. Explaining before running can't cover the output yet. */
export function requiredChecks(kind: WorkKind, workflow: Workflow): CheckKey[] {
  if (kind === "written" || workflow === "explain_first") return ["goalClear", "logicExplained"];
  return ["goalClear", "logicExplained", "outputInterpreted"];
}

export function missingCheck(checks: ExplainChecks, kind: WorkKind, workflow: Workflow): CheckKey | null {
  return requiredChecks(kind, workflow).find((k) => !checks[k]) ?? null;
}

/** One plain sentence telling the student what Ustaad still needs to hear. */
export function missingHint(key: CheckKey, kind: WorkKind): string {
  if (kind === "written") {
    return key === "goalClear" ? "Tell Ustaad your main point, in your own words." : "Tell Ustaad why your point holds, with a reason or an example.";
  }
  if (key === "goalClear") return "Tell Ustaad what your program must produce, in your own words.";
  if (key === "logicExplained") return "Tell Ustaad how your code gets there: the steps, or what a key line does.";
  return "Tell Ustaad why your code printed what it did.";
}

const storageKey = (submissionId: string) => `socratic:explain-checks:${submissionId}`;

export function loadChecks(submissionId: string): ExplainChecks {
  try {
    const raw = window.localStorage.getItem(storageKey(submissionId));
    return raw ? mergeChecks(NO_CHECKS, JSON.parse(raw) as Partial<ExplainChecks>) : NO_CHECKS;
  } catch {
    return NO_CHECKS;
  }
}

export function saveChecks(submissionId: string, checks: ExplainChecks): void {
  try {
    window.localStorage.setItem(storageKey(submissionId), JSON.stringify(checks));
  } catch {
    // Storage blocked (private window): the checks still hold for this visit.
  }
}
