import { describe, expect, it } from "vitest";
import { chooseOption, renderInstructions, type VariantSpec } from "./variants.js";

const spec: VariantSpec = {
  param: "boundary",
  options: ["4", "6"],
  fills: { "4": { boundary: "4", team: "Islamabad club" }, "6": { boundary: "6", team: "Rawalpindi club" } },
};

describe("variants", () => {
  it("gives the same student the same option every time", () => {
    expect(chooseOption(spec, "student-a", "asg-1")).toBe(chooseOption(spec, "student-a", "asg-1"));
  });

  it("spreads a class across the options", () => {
    const picks = new Set(Array.from({ length: 20 }, (_, i) => chooseOption(spec, `student-${i}`, "asg-1")));
    expect(picks).toEqual(new Set(["4", "6"]));
  });

  it("returns null when there are no variants", () => {
    expect(chooseOption({}, "s", "a")).toBeNull();
  });

  it("fills placeholders and leaves unknown ones alone", () => {
    expect(renderInstructions("The {team} counts balls of {boundary}+ ({unknown}).", spec, "6")).toBe("The Rawalpindi club counts balls of 6+ ({unknown}).");
  });

  it("uses the first option's text when variants are off", () => {
    expect(renderInstructions("{team}", spec, null)).toBe("Islamabad club");
    expect(renderInstructions("No placeholders.", {}, null)).toBe("No placeholders.");
  });
});
