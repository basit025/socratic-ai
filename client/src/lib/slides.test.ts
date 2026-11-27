import { describe, expect, it } from "vitest";
import { readingMinutes, toSlides } from "./slides";

describe("toSlides", () => {
  it("makes one slide per ### section", () => {
    const s = toSlides("Trees", "### Binary trees\nEach node has two children.\n\n### Traversal\n- inorder\n- preorder");
    expect(s).toEqual([
      { heading: "Binary trees", body: "Each node has two children." },
      { heading: "Traversal", body: "- inorder\n- preorder" },
    ]);
  });

  it("keeps text before the first section under the lecture title", () => {
    const s = toSlides("Intro", "Why this matters.\n### Part one\nText");
    expect(s[0]).toEqual({ heading: "Intro", body: "Why this matters." });
    expect(s).toHaveLength(2);
  });

  it("ignores ### inside code blocks", () => {
    const s = toSlides("Code", "### Example\n```python\n### not a heading\nprint(1)\n```");
    expect(s).toHaveLength(1);
    expect(s[0]!.body).toContain("### not a heading");
  });

  it("skips empty sections", () => {
    expect(toSlides("T", "### Empty\n\n### Full\nyes")).toEqual([{ heading: "Full", body: "yes" }]);
  });
});

describe("readingMinutes", () => {
  it("is at least one minute", () => {
    expect(readingMinutes("short")).toBe(1);
    expect(readingMinutes("word ".repeat(600))).toBe(3);
  });
});
