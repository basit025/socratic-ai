import { describe, expect, it } from "vitest";
import { NO_CHECKS, mergeChecks, missingCheck, missingHint, requiredChecks } from "./explainChecks";

describe("the Explain step needs Ustaad's checks (T02)", () => {
  it("one vague message (no checks met) leaves Explain open", () => {
    expect(missingCheck(NO_CHECKS, "code", "run_first")).toBe("goalClear");
  });

  it("run first needs goal, logic and output", () => {
    expect(requiredChecks("code", "run_first")).toEqual(["goalClear", "logicExplained", "outputInterpreted"]);
    expect(missingCheck({ goalClear: true, logicExplained: true, outputInterpreted: false }, "code", "run_first")).toBe("outputInterpreted");
    expect(missingCheck({ goalClear: true, logicExplained: true, outputInterpreted: true }, "code", "run_first")).toBeNull();
  });

  it("explain first and written work don't need the output", () => {
    const both = { goalClear: true, logicExplained: true, outputInterpreted: false };
    expect(missingCheck(both, "code", "explain_first")).toBeNull();
    expect(missingCheck(both, "written", "run_first")).toBeNull();
  });

  it("a check met once stays met", () => {
    const after = mergeChecks({ goalClear: true, logicExplained: false, outputInterpreted: false }, { goalClear: false, logicExplained: true });
    expect(after).toEqual({ goalClear: true, logicExplained: true, outputInterpreted: false });
    expect(mergeChecks(after, null)).toEqual(after);
  });

  it("every missing check has a sentence telling the student what to say", () => {
    for (const k of ["goalClear", "logicExplained", "outputInterpreted"] as const) {
      expect(missingHint(k, "code")).toMatch(/^Tell Ustaad /);
      expect(missingHint(k, "written")).toMatch(/^Tell Ustaad /);
    }
  });
});
