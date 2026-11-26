// Checks the course content before seeding: every lab's reference solution runs and produces a value
// for every hidden test (printed, so examples in briefs can be compared by eye), quizzes are well
// formed, and every assignment points at a real course and week.
//   npx tsx scripts/check-content.ts [courseKey]
import { assignments, courses, modules } from "../server/seed/content.js";
import { computeExpected } from "../server/seed/expected.js";

const only = process.argv[2];
let problems = 0;
const bad = (msg: string) => {
  problems++;
  console.log(`  ✗ ${msg}`);
};

for (const a of assignments) {
  if (only && a.course !== only) continue;
  const course = courses.find((c) => c.key === a.course);
  if (!course) bad(`${a.title}: no course ${a.course}`);
  if (!modules.some((m) => m.course === a.course && m.week === a.week)) bad(`${a.title}: no week ${a.week} in ${a.course}`);
  console.log(`\n${a.course} · week ${a.week} · ${a.type} · ${a.status} · ${a.title}`);
  if (a.type === "code") {
    try {
      const tests = await computeExpected(a.language!, a.referenceSolution, a.tests, a.variantSpec ?? null);
      for (const t of tests) console.log(`    ${t.name}: ${t.call} → ${typeof t.expected === "string" ? t.expected : JSON.stringify(t.expected)}`);
      if (tests.length < 3) bad(`${a.title}: only ${tests.length} hidden tests`);
    } catch (err) {
      bad(`${a.title}: reference solution failed: ${(err as Error).message.split("\n").slice(-2).join(" ")}`);
    }
  }
  if (a.type === "quiz") {
    const q = a.quiz!;
    if (q.draw > q.questions.length) bad(`${a.title}: draws ${q.draw} of ${q.questions.length}`);
    q.questions.forEach((x, i) => {
      if (x.kind === "mcq" && (x.correct < 0 || x.correct >= x.options.length)) bad(`${a.title} Q${i + 1}: correct index out of range`);
      if (x.kind === "short" && !x.accepted.length) bad(`${a.title} Q${i + 1}: no accepted answers`);
    });
    console.log(`    quiz: ${q.questions.length} questions, ${q.draw} drawn, ${q.timeLimitMinutes} min`);
  }
}
const keys = new Set<string>();
for (const a of assignments) {
  if (keys.has(a.key)) bad(`duplicate assignment key ${a.key}`);
  keys.add(a.key);
}
const codes = new Set<string>();
for (const c of courses) {
  if (codes.has(c.joinCode)) bad(`duplicate join code ${c.joinCode}`);
  if (!/^[A-Z2-9]{6}$/.test(c.joinCode)) bad(`bad join code ${c.joinCode}`);
  codes.add(c.joinCode);
}
console.log(problems ? `\n${problems} problem(s).` : `\nAll content checks passed (${courses.length} courses, ${modules.length} weeks, ${assignments.length} assignments).`);
process.exit(problems ? 1 : 0);
