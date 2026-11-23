import { describe, expect, it } from "vitest";
import { computeExpected } from "./expected.js";

describe("expected values come from running the reference solution", () => {
  it("python, with variants that change some answers", async () => {
    const out = await computeExpected(
      "python",
      "def over_summary(balls):\n    return (sum(balls), len([b for b in balls if b >= {boundary}]))\n",
      [{ name: "a", call: "over_summary([1, 4, 0, 6, 2, 1])" }, { name: "b", call: "over_summary([])" }],
      { options: ["4", "6"], fills: { "4": { boundary: "4" }, "6": { boundary: "6" } } },
    );
    expect(out[0]!.expected).toEqual({ "4": "(14, 2)", "6": "(14, 1)" });
    expect(out[1]!.expected).toBe("(0, 0)");
  }, 30_000);

  it("javascript, using the same repr as the browser", async () => {
    const out = await computeExpected("javascript", "function f(n) { return [n, String(n)]; }", [{ name: "a", call: "f(3)" }], null);
    expect(out[0]!.expected).toBe('[3,"3"]');
  });
});
