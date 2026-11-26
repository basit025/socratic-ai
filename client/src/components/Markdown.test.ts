import { describe, expect, it } from "vitest";
import { parseMarkdown } from "./Markdown";

describe("course notes markdown", () => {
  it("parses the blocks our notes use", () => {
    const b = parseMarkdown([
      "### Support and confidence",
      "Support is how often an itemset appears.",
      "",
      "- **Support** = count / N",
      "- **Confidence** = support(A ∪ B) / support(A)",
      "",
      "1. Count",
      "2. Prune",
      "",
      "> Key idea: frequent subsets first.",
      "",
      "```python",
      "def support(t, s):",
      "    return 1",
      "```",
      "",
      "| Itemset | Count |",
      "| --- | --- |",
      "| {chai} | 4 |",
    ].join("\n"));
    expect(b.map((x) => x.kind)).toEqual(["h", "p", "ul", "ol", "quote", "code", "table"]);
    expect(b[5]).toMatchObject({ kind: "code", lang: "python", text: "def support(t, s):\n    return 1" });
    expect(b[6]).toMatchObject({ head: ["Itemset", "Count"], rows: [["{chai}", "4"]] });
  });

  it("keeps old plain notes working", () => {
    expect(parseMarkdown("One paragraph.\n\nAnother with `code`.").map((x) => x.kind)).toEqual(["p", "p"]);
  });
});
