/**
 * Seeded timed quizzes (FR-13): one question at a time, each student gets `draw` questions from the
 * pool in their own order with shuffled options. Written by the team for the demo institution.
 */
import type { SeedAssignment, SeedQuiz } from "./content.js";

const quizRules: SeedAssignment["rules"] = { pasteBlocked: true, workflow: "run_first", vivaQuestions: 0, vivaSecondsPerQ: 90, vivaWeight: 0, variantsOn: false };

const quiz = (q: Omit<SeedAssignment, "type" | "language" | "starterCode" | "referenceSolution" | "tests" | "rules"> & { quiz: SeedQuiz }): SeedAssignment => ({
  ...q,
  type: "quiz",
  language: null,
  starterCode: "",
  referenceSolution: "",
  tests: [],
  rules: quizRules,
});

export const quizAssignments: SeedAssignment[] = [
  quiz({
    key: "quiz-python", course: "cs101", week: 3, title: "Quiz 1: Python Basics", status: "published", opensInDays: -2, dueInDays: 3, marks: 10,
    instructions: "A short timed quiz on weeks 1–3: variables, loops and functions. One question at a time; you can't go back.",
    quiz: {
      draw: 6, timeLimitMinutes: 6, fullscreen: true,
      questions: [
        { kind: "mcq", prompt: "What does `print(7 // 2)` show?", options: ["3.5", "3", "4", "3.0"], correct: 1 },
        { kind: "mcq", prompt: "What does `print(7 % 2)` show?", options: ["1", "3", "3.5", "0"], correct: 0 },
        { kind: "mcq", prompt: "`balls = [1, 4, 0, 6]`. What is `len(balls)`?", options: ["3", "4", "11", "6"], correct: 1 },
        { kind: "mcq", prompt: "How many numbers does `for i in range(2, 6): print(i)` print?", options: ["6", "5", "4", "3"], correct: 2 },
        { kind: "mcq", prompt: "A function has no `return` line. What does calling it give back?", options: ["0", "An error", "None", "An empty string"], correct: 2 },
        { kind: "mcq", prompt: "`runs = [1, 4, 0, 6]`. What is `runs[-1]`?", options: ["1", "6", "0", "An error"], correct: 1 },
        { kind: "short", prompt: "Which built-in function gives the number of items in a list? (Just the name.)", accepted: ["len", "len()"] },
        { kind: "short", prompt: "What does `print(\"Pak\" + \"istan\")` show?", accepted: ["Pakistan"] },
        { kind: "short", prompt: "Which keyword sends a value back from a function?", accepted: ["return"] },
      ],
    },
  }),
  quiz({
    key: "quiz-js", course: "web102", week: 4, title: "Quiz: JavaScript Basics", status: "published", opensInDays: -1, dueInDays: 4, marks: 10,
    instructions: "A short timed quiz on variables, arrays and functions in JavaScript. One question at a time; you can't go back.",
    quiz: {
      draw: 5, timeLimitMinutes: 5, fullscreen: true,
      questions: [
        { kind: "mcq", prompt: "What does `\"5\" + 2` give in JavaScript?", options: ["7", "\"52\"", "NaN", "An error"], correct: 1 },
        { kind: "mcq", prompt: "What does `[3, 1, 2].length` give?", options: ["2", "3", "6", "undefined"], correct: 1 },
        { kind: "mcq", prompt: "Which keyword declares a variable that can't be reassigned?", options: ["var", "let", "const", "static"], correct: 2 },
        { kind: "mcq", prompt: "What does `5 === \"5\"` give?", options: ["true", "false", "undefined", "An error"], correct: 1 },
        { kind: "mcq", prompt: "`const names = [\"Ali\", \"Sara\", \"Omar\"]`. What is `names[1]`?", options: ["\"Ali\"", "\"Sara\"", "\"Omar\"", "undefined"], correct: 1 },
        { kind: "short", prompt: "Which array method adds an item to the end? (Just the name.)", accepted: ["push", "push()", ".push", ".push()"] },
        { kind: "short", prompt: "Which function prints a value to the browser console?", accepted: ["console.log", "console.log()"] },
        { kind: "short", prompt: "What does `typeof 42` give? (One word.)", accepted: ["number"] },
      ],
    },
  }),
  quiz({
    key: "quiz-ds", course: "cs201", week: 3, title: "Quiz: Stacks and Queues", status: "published", opensInDays: -2, dueInDays: 5, marks: 10,
    instructions: "A short timed quiz on stacks and queues. One question at a time; you can't go back.",
    quiz: {
      draw: 5, timeLimitMinutes: 5, fullscreen: true,
      questions: [
        { kind: "mcq", prompt: "A stack follows which order?", options: ["First in, first out", "Last in, first out", "Sorted order", "Random order"], correct: 1 },
        { kind: "mcq", prompt: "A bank queue follows which order?", options: ["First in, first out", "Last in, first out", "Shortest first", "Random order"], correct: 0 },
        { kind: "mcq", prompt: "Push 1, push 2, push 3, then pop once. What is on top now?", options: ["1", "2", "3", "Nothing"], correct: 1 },
        { kind: "mcq", prompt: "Which Python list operation behaves like a stack's pop?", options: ["list.pop()", "list.pop(0)", "list.remove(x)", "list.sort()"], correct: 0 },
        { kind: "mcq", prompt: "Which is the best tool for checking balanced brackets like `([]{})`?", options: ["A queue", "A stack", "A sorted list", "A count of each bracket"], correct: 1 },
        { kind: "short", prompt: "Enqueue A, B, C into an empty queue, then dequeue once. Which letter comes out?", accepted: ["A"] },
        { kind: "short", prompt: "Which Python module gives `deque` for fast queues? (Just the module name.)", accepted: ["collections"] },
      ],
    },
  }),
];
