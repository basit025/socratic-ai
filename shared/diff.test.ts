import { describe, expect, it } from "vitest";
import { applyChanges } from "./replay.js";
import { diffOne } from "./diff.js";

describe("written-answer diffs", () => {
  it("rebuilds every edit exactly through the replay", () => {
    const states = ["", "AI", "AI can", "AI can help", "AI can help students", "AI can help weak students", "AI helps weak students", "AI helps weak students."];
    let doc = "";
    for (let i = 1; i < states.length; i++) {
      const ch = diffOne(states[i - 1]!, states[i]!);
      expect(ch).not.toBeNull();
      doc = applyChanges(doc, [ch!]);
      expect(doc).toBe(states[i]);
    }
  });

  it("returns null when nothing changed", () => {
    expect(diffOne("same", "same")).toBeNull();
  });
});
