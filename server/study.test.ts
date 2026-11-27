import { describe, expect, it } from "vitest";
import { buildPracticePrompt, buildTutorPrompt, cleanPractice } from "./study.js";

const lectures = [
  { week: 1, title: "Variables", notes: "### Names\nA variable names a value." },
  { week: 2, title: "Loops", notes: "### for\nRepeat for each item. " + "x".repeat(5000) },
];

describe("buildTutorPrompt", () => {
  it("sends only the open lecture, the slide, and the graded titles to refuse", () => {
    const p = buildTutorPrompt({ courseCode: "CS-101", courseName: "Programming Fundamentals", lectures, week: 1, slide: { heading: "Names", body: "A variable names a value." }, gradedTitles: ["Cricket Over Tracker"], message: "what is a variable?" });
    expect(p).toContain('<lecture week="1" title="Variables">');
    expect(p).not.toContain('<lecture week="2"');
    expect(p).toContain("<slide>\n## Names");
    expect(p).toContain("never solve these): Cricket Over Tracker");
    expect(p).toContain("<student_message>\nwhat is a variable?\n</student_message>");
  });

  it("sends every lecture, capped, when no lecture is open", () => {
    const p = buildTutorPrompt({ courseCode: "CS-101", courseName: "PF", lectures, week: null, gradedTitles: [], message: "hi" }, 2000);
    expect(p).toContain('<lecture week="1"');
    expect(p).toContain('<lecture week="2"');
    expect(p.length).toBeLessThan(3500);
  });
});

describe("practice questions", () => {
  const q = (question: string, options = ["a", "b", "c", "d"], answer = 1) => ({ question, options, answer, explanation: "because" });

  it("drops broken and repeated questions and keeps the count", () => {
    const out = cleanPractice(
      { questions: [q("Q1"), q("Q2", ["a", "b", "c"]), q("Q3", ["a", "a", "b", "c"]), q("Q4", undefined, 4), q("q1"), q("Q5"), q("Q6")] },
      2,
    );
    expect(out.map((x) => x.question)).toEqual(["Q1", "Q5"]);
  });

  it("asks for the count and lists questions to avoid", () => {
    const p = buildPracticePrompt({ code: "CS-101", name: "PF" }, lectures[0]!, 5, ["What is a variable?"]);
    expect(p).toContain("Write 5 practice questions about lecture 1: Variables.");
    expect(p).toContain("- What is a variable?");
  });
});
