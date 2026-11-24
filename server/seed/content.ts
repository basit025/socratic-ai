/**
 * Demo content for the fictional "Pothohar Institute of Computing (Demo)".
 * Written by the team for this project; every person and the institution are fictional.
 * Rules: no fabricated process logs (past submissions come only from real recorded sessions in
 * ./sessions), and no hand-typed expected test values (the seed computes them by running each
 * reference solution, see ./expected.ts).
 * Dates are offsets in days from the moment of seeding; demo sandboxes shift them to "now".
 */
import { quizAssignments } from "./quizzes.js";

export const INSTITUTION = "Pothohar Institute of Computing (Demo)";

export interface SeedPerson {
  key: string;
  fullName: string;
  initials: string;
  email?: string; // demo identities use demo-teacher@ / demo-student@pothohar.demo
}

const person = (key: string, fullName: string, email?: string): SeedPerson => ({
  key,
  fullName,
  initials: fullName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase(),
  ...(email ? { email } : {}),
});

export const teachers: SeedPerson[] = [
  person("sana", "Sana Rauf", "demo-teacher@pothohar.demo"),
  person("imran", "Imran Qureshi"),
  person("hina", "Hina Baig"),
];

// The first ten keys are the classmates real recorded sessions are mapped to (docs/recording-guide.md).
export const students: SeedPerson[] = [
  person("ayesha", "Ayesha Khan", "demo-student@pothohar.demo"),
  person("bilal", "Bilal Ahmed"),
  person("hamza", "Hamza Tariq"),
  person("fatima", "Fatima Noor"),
  person("zainab", "Zainab Ali"),
  person("usman", "Usman Javed"),
  person("mahnoor", "Mahnoor Iqbal"),
  person("ali", "Ali Raza"),
  person("sara", "Sara Malik"),
  person("omar", "Omar Farooq"),
  person("hassan", "Hassan Mehmood"),
  person("ayaan", "Ayaan Siddiqui"),
  person("hira", "Hira Shahid"),
  person("maryam", "Maryam Aslam"),
  person("saad", "Saad Khalid"),
  person("iqra", "Iqra Nadeem"),
  person("faizan", "Faizan Akhtar"),
  person("laiba", "Laiba Yousaf"),
  person("taha", "Taha Hussain"),
  person("aiman", "Aiman Zahid"),
  person("danish", "Danish Rafiq"),
  person("noor", "Noor Fatima"),
  person("rida", "Rida Kamran"),
  person("shahzaib", "Shahzaib Anwar"),
  person("areeba", "Areeba Saleem"),
  person("moiz", "Moiz Sheikh"),
  person("emaan", "Emaan Butt"),
  person("waleed", "Waleed Asghar"),
  person("kinza", "Kinza Arif"),
  person("zeeshan", "Zeeshan Latif"),
  person("alishba", "Alishba Nawaz"),
  person("junaid", "Junaid Iqbal"),
  person("mishal", "Mishal Tahir"),
  person("arham", "Arham Javaid"),
  person("yusra", "Yusra Bashir"),
  person("talha", "Talha Rashid"),
  person("anaya", "Anaya Shafiq"),
  person("huzaifa", "Huzaifa Naeem"),
  person("sameen", "Sameen Ghani"),
  person("rayyan", "Rayyan Chaudhry"),
  person("nimra", "Nimra Saeed"),
  person("ahsan", "Ahsan Mir"),
  person("warda", "Warda Ilyas"),
  person("fahad", "Fahad Zubair"),
  person("sadia", "Sadia Munir"),
];

const keys = students.map((s) => s.key);
const firstYears = keys.slice(0, 34);
const secondYears = keys.slice(15, 45);

export interface SeedCourse {
  key: string;
  teacher: string;
  code: string;
  name: string;
  section: string;
  term: string;
  joinCode: string; // 6 chars from A–Z and 2–9
  students: string[];
}

export const courses: SeedCourse[] = [
  { key: "cs101", teacher: "sana", code: "CS-101", name: "Programming Fundamentals", section: "Section A", term: "Fall 2026", joinCode: "PKC7HA", students: firstYears.slice(0, 30) },
  // A new, empty section: shows the creation flow and the teaching empty states.
  { key: "cs101b", teacher: "sana", code: "CS-101", name: "Programming Fundamentals", section: "Section B (new)", term: "Fall 2026", joinCode: "PKC7HB", students: [] },
  { key: "web102", teacher: "imran", code: "WEB-102", name: "Web Development", section: "Section A", term: "Fall 2026", joinCode: "WEB4KQ", students: ["ayesha", ...firstYears.slice(5, 34)] },
  { key: "cs201", teacher: "imran", code: "CS-201", name: "Data Structures", section: "Section A", term: "Fall 2026", joinCode: "DSA8MZ", students: secondYears },
  { key: "eng101", teacher: "hina", code: "ENG-101", name: "Communication Skills", section: "Section C", term: "Fall 2026", joinCode: "ENG3RT", students: ["ayesha", ...firstYears.slice(3, 32)] },
];

export interface SeedModule {
  course: string;
  week: number;
  title: string;
  notes: string;
}

const weeks = (course: string, list: [string, string][]): SeedModule[] => list.map(([title, notes], i) => ({ course, week: i + 1, title, notes }));

export const modules: SeedModule[] = [
  ...weeks("cs101", [
    ["Variables and arithmetic", "A variable is a name for a value. This week: storing numbers and text, doing arithmetic, and printing results.\n\nExample: splitting a chai bill between friends, with a tip."],
    ["Functions", "A function packages steps under a name, takes inputs (parameters) and gives back a result with `return`.\n\nWhy it matters: functions can be tested, which is how your labs are marked."],
    ["Loops and running totals", "A `for` loop repeats the same steps for every item in a list. A running total starts at 0 and grows inside the loop.\n\nExample: adding up the runs in a cricket over."],
    ["Conditions", "`if`, `elif` and `else` let a program choose. Combine a condition with a loop to count only the items you care about.\n\nExample: a rickshaw fare that changes after the first 2 km."],
    ["Lists in depth", "Sorting, indexing, slicing and `len`, and building new lists from old ones.\n\nExample: finding the longest power cut in a load-shedding schedule."],
    ["Debugging and reading errors", "Errors are information. Read the last line first, find the line number, and predict what each line does before you run it."],
  ]),
  ...weeks("web102", [
    ["JavaScript basics", "Values, `let` and `const`, and `console.log`. JavaScript runs in every browser, so the programs you write can power real web pages."],
    ["Strings", "Strings are text. Loop over a string with `for (const ch of text)`, change case with `toLowerCase()`, and check membership with `includes`."],
    ["Arrays", "An array holds a list of values. Build a new array with `push`, or with `filter` and `map` once you're comfortable."],
    ["Objects", "Objects group related values: `{ name: \"Ali\", attendance: 72 }`. Read a field with `record.name`."],
    ["Functions and arrow functions", "`function total(xs) { ... }` and `const total = (xs) => ...` both define functions. Return values; don't just print them."],
    ["Debugging in the browser", "Use `console.log` to see values as your code runs. Read the error name first: TypeError, ReferenceError, SyntaxError."],
  ]),
  ...weeks("cs201", [
    ["Lists and how long things take", "Some operations take the same time for any list size; others grow with the list. Counting steps helps you choose the right approach."],
    ["Stacks", "A stack is last-in, first-out, like a pile of plates. Push to add, pop to remove. Perfect for matching brackets."],
    ["Queues", "A queue is first-in, first-out, like a bank line. Each person waits for everyone in front of them."],
    ["Dictionaries", "A dictionary maps keys to values. Counting words is the classic use: `counts[word] = counts.get(word, 0) + 1`."],
    ["Merging sorted lists", "Two sorted lists can be merged in one pass by always taking the smaller front item."],
    ["Recursion", "A function that calls itself on a smaller problem, with a base case that stops it."],
  ]),
  ...weeks("eng101", [
    ["Clear sentences", "One idea per sentence. Put the important words first. Cut words that add nothing."],
    ["Formal emails", "A clear subject, a polite greeting, the point in the first two lines, one specific request, and a proper closing."],
    ["Building a paragraph", "A topic sentence, two or three supporting sentences, and a sentence that links to what comes next."],
    ["Making an argument", "State your position, give reasons, support one with a real example, and answer an objection fairly."],
    ["Summarising", "Keep the main idea and the key evidence; drop examples and repetition. Use your own words."],
    ["Reflective writing", "Describe what happened, what you thought, what you learned, and what you'll do differently."],
  ]),
];

export interface SeedTestInput {
  name: string;
  call: string;
}

export interface SeedAssignment {
  key: string;
  course: string;
  week: number;
  type: "code" | "written" | "quiz";
  language: "python" | "javascript" | null;
  title: string;
  status: "draft" | "published" | "closed";
  opensInDays: number;
  dueInDays: number;
  marks: number;
  instructions: string;              // may contain {placeholders} filled per variant
  starterCode: string;
  referenceSolution: string;         // may contain {placeholders}; expected values are computed from it
  tests: SeedTestInput[];
  variantSpec?: { param: string; options: string[]; fills: Record<string, Record<string, string>> };
  rules: { pasteBlocked: boolean; workflow: "run_first" | "explain_first"; vivaQuestions: number; vivaSecondsPerQ: number; vivaWeight: number; variantsOn: boolean };
  quiz?: SeedQuiz;
}

/** A timed quiz: each student gets `draw` questions from the pool, in their own order (see quizzes.ts). */
export interface SeedQuiz {
  draw: number;
  timeLimitMinutes: number;
  fullscreen: boolean;
  questions: ({ kind: "mcq"; prompt: string; options: string[]; correct: number } | { kind: "short"; prompt: string; accepted: string[] })[];
}

const labRules = (o: Partial<SeedAssignment["rules"]> = {}): SeedAssignment["rules"] => ({ pasteBlocked: true, workflow: "run_first", vivaQuestions: 3, vivaSecondsPerQ: 90, vivaWeight: 50, variantsOn: false, ...o });

export const assignments: SeedAssignment[] = [
  // ------------------------------------------------------------ CS-101 (Python)
  {
    key: "chai", course: "cs101", week: 1, type: "code", language: "python", title: "Chai Bill Splitter", status: "closed", opensInDays: -16, dueInDays: -10, marks: 10,
    instructions: "Four friends share chai and parathas at a dhaba. Write `split_bill(total, people, tip_percent)` that returns how much each person pays, including the tip, rounded to 2 decimal places.\n\nExample: `split_bill(1200, 4, 10)` returns `330.0`.",
    starterCode: "def split_bill(total, people, tip_percent):\n    # Return the amount each person pays, rounded to 2 decimals\n    pass\n\n\nprint(split_bill(1200, 4, 10))\n",
    referenceSolution: "def split_bill(total, people, tip_percent):\n    with_tip = total * (1 + tip_percent / 100)\n    return round(with_tip / people, 2)\n",
    tests: [
      { name: "Example from the brief", call: "split_bill(1200, 4, 10)" },
      { name: "No tip", call: "split_bill(999, 3, 0)" },
      { name: "Half rupees", call: "split_bill(500, 2, 5)" },
      { name: "Empty bill", call: "split_bill(0, 5, 10)" },
    ],
    rules: labRules(),
  },
  {
    key: "metro", course: "cs101", week: 2, type: "code", language: "python", title: "Metro Card Balance", status: "closed", opensInDays: -9, dueInDays: -4, marks: 10,
    instructions: "A Metro Bus card has a balance in rupees, and every ride costs the same fare. Write `rides_left(balance, fare)` that returns **how many full rides** the balance can pay for.\n\nExample: `rides_left(500, 50)` returns `10`.\n\nIf the fare is 0 or less, return `0` (the card is broken).",
    starterCode: "def rides_left(balance, fare):\n    # Return how many full rides the balance pays for\n    pass\n\n\nprint(rides_left(500, 50))\n",
    referenceSolution: "def rides_left(balance, fare):\n    if fare <= 0:\n        return 0\n    return balance // fare\n",
    tests: [
      { name: "Example from the brief", call: "rides_left(500, 50)" },
      { name: "Not enough for one ride", call: "rides_left(49, 50)" },
      { name: "Leftover change", call: "rides_left(130, 40)" },
      { name: "Broken card", call: "rides_left(100, 0)" },
    ],
    rules: labRules(),
  },
  {
    key: "cricket", course: "cs101", week: 3, type: "code", language: "python", title: "Cricket Over Tracker", status: "published", opensInDays: -2, dueInDays: 3, marks: 10,
    instructions: "The {team} scorer records every ball of an over as a list of runs. Write `over_summary(balls)` that returns a tuple: **(total runs, number of balls that scored {boundary} or more)**.\n\nExample: `over_summary([1, 4, 0, 6, 2, 1])` returns `(14, {example_hits})`.\n\nAn empty over has scored nothing yet.",
    starterCode: "def over_summary(balls):\n    # balls is a list of runs, for example [1, 4, 0, 6, 2, 1]\n    # Return (total_runs, big_hits)\n    pass\n\n\nprint(over_summary([1, 4, 0, 6, 2, 1]))\n",
    referenceSolution: "def over_summary(balls):\n    total = 0\n    big_hits = 0\n    for runs in balls:\n        total += runs\n        if runs >= {boundary}:\n            big_hits += 1\n    return (total, big_hits)\n",
    tests: [
      { name: "Example from the brief", call: "over_summary([1, 4, 0, 6, 2, 1])" },
      { name: "Empty over", call: "over_summary([])" },
      { name: "Six sixes", call: "over_summary([6, 6, 6, 6, 6, 6])" },
      { name: "A quiet over", call: "over_summary([0, 0, 1, 0, 0, 0])" },
      { name: "Mixed over", call: "over_summary([4, 4, 3, 5, 6, 0])" },
    ],
    variantSpec: { param: "boundary", options: ["4", "6"], fills: { "4": { boundary: "4", example_hits: "2", team: "Islamabad club" }, "6": { boundary: "6", example_hits: "1", team: "Rawalpindi club" } } },
    rules: labRules({ variantsOn: true }),
  },
  {
    key: "rickshaw", course: "cs101", week: 4, type: "code", language: "python", title: "Rickshaw Fare Estimator", status: "published", opensInDays: -1, dueInDays: 8, marks: 10,
    instructions: "A rickshaw charges Rs 100 for the first 2 km and Rs 40 for every km after that. Part of a km counts as a full km. Write `fare(km)` that returns the fare in rupees.\n\nExample: `fare(3)` returns `140`.",
    starterCode: "import math\n\n\ndef fare(km):\n    # Rs 100 covers the first 2 km; Rs 40 for each km after that\n    pass\n\n\nprint(fare(3))\n",
    referenceSolution: "import math\n\n\ndef fare(km):\n    km = math.ceil(km)\n    if km <= 2:\n        return 100\n    return 100 + 40 * (km - 2)\n",
    tests: [
      { name: "Short ride", call: "fare(1)" },
      { name: "Exactly 2 km", call: "fare(2)" },
      { name: "Example from the brief", call: "fare(3)" },
      { name: "Part of a km", call: "fare(5.5)" },
    ],
    rules: labRules({ workflow: "explain_first" }),
  },
  {
    key: "loadshedding", course: "cs101", week: 5, type: "code", language: "python", title: "Load-shedding Planner", status: "draft", opensInDays: 6, dueInDays: 13, marks: 10,
    instructions: "WAPDA publishes the hours (0–23) when your area has no electricity. Write `longest_outage(hours)` that returns the **length of the longest run of consecutive hours** without power.\n\nExample: `longest_outage([1, 2, 3, 7, 8])` returns `3`.\n\nThe hours may come in any order. No outages means `0`.",
    starterCode: "def longest_outage(hours):\n    # hours is a list like [1, 2, 3, 7, 8]\n    pass\n\n\nprint(longest_outage([1, 2, 3, 7, 8]))\n",
    referenceSolution: "def longest_outage(hours):\n    best = 0\n    run = 0\n    prev = None\n    for h in sorted(hours):\n        if prev is not None and h == prev + 1:\n            run += 1\n        else:\n            run = 1\n        best = max(best, run)\n        prev = h\n    return best\n",
    tests: [
      { name: "Example from the brief", call: "longest_outage([1, 2, 3, 7, 8])" },
      { name: "No outages", call: "longest_outage([])" },
      { name: "Out of order", call: "longest_outage([9, 7, 8, 1])" },
      { name: "Scattered hours", call: "longest_outage([1, 3, 5])" },
    ],
    rules: labRules(),
  },
  {
    key: "results", course: "cs101", week: 6, type: "code", language: "python", title: "Exam Result Calculator", status: "draft", opensInDays: 13, dueInDays: 20, marks: 10,
    instructions: "Write `grade(marks)` for an intermediate board result card. It returns **\"A\"** for 85 or more, **\"B\"** for 70 or more, **\"C\"** for 55 or more, and **\"F\"** otherwise.\n\nExample: `grade(72)` returns `\"B\"`.",
    starterCode: "def grade(marks):\n    # Return \"A\", \"B\", \"C\" or \"F\"\n    pass\n\n\nprint(grade(72))\n",
    referenceSolution: "def grade(marks):\n    if marks >= 85:\n        return \"A\"\n    if marks >= 70:\n        return \"B\"\n    if marks >= 55:\n        return \"C\"\n    return \"F\"\n",
    tests: [
      { name: "Example from the brief", call: "grade(72)" },
      { name: "Exactly on the A line", call: "grade(85)" },
      { name: "Just below C", call: "grade(54)" },
    ],
    rules: labRules(),
  },
  // ------------------------------------------------------------ WEB-102 (JavaScript)
  {
    key: "vowels", course: "web102", week: 2, type: "code", language: "javascript", title: "Name Vowel Counter", status: "closed", opensInDays: -12, dueInDays: -6, marks: 10,
    instructions: "Write a JavaScript function `countVowels(name)` that returns **how many vowels** (a, e, i, o, u, upper or lower case) are in a name written in English letters.\n\nExample: `countVowels(\"Ayesha\")` returns `3`.\n\nAn empty name has `0` vowels.",
    starterCode: "function countVowels(name) {\n  // Return the number of vowels in name\n}\n\nconsole.log(countVowels(\"Ayesha\"));\n",
    referenceSolution: "function countVowels(name) {\n  let count = 0;\n  for (const ch of name.toLowerCase()) {\n    if (\"aeiou\".includes(ch)) count++;\n  }\n  return count;\n}\n",
    tests: [
      { name: "Example from the brief", call: "countVowels(\"Ayesha\")" },
      { name: "Empty name", call: "countVowels(\"\")" },
      { name: "Capital letters", call: "countVowels(\"OMAR\")" },
      { name: "No vowels", call: "countVowels(\"Rhythm\")" },
    ],
    rules: labRules(),
  },
  {
    key: "attendance", course: "web102", week: 4, type: "code", language: "javascript", title: "Attendance Shortage List", status: "published", opensInDays: -2, dueInDays: 4, marks: 10,
    instructions: "Each record looks like `{ name: \"Ali\", attendance: 72 }`. Write `shortList(records)` that returns an **array of names** whose attendance is **below {limit}%**, in the same order.\n\nExample: `shortList([{ name: \"Ali\", attendance: 72 }, { name: \"Sara\", attendance: 90 }])` returns `[\"Ali\"]`.",
    starterCode: "function shortList(records) {\n  // Return the names below the attendance limit\n}\n\nconsole.log(shortList([{ name: \"Ali\", attendance: 72 }, { name: \"Sara\", attendance: 90 }]));\n",
    referenceSolution: "function shortList(records) {\n  const names = [];\n  for (const r of records) {\n    if (r.attendance < {limit}) names.push(r.name);\n  }\n  return names;\n}\n",
    tests: [
      { name: "Example from the brief", call: "shortList([{ name: \"Ali\", attendance: 72 }, { name: \"Sara\", attendance: 90 }])" },
      { name: "Nobody short", call: "shortList([{ name: \"Omar\", attendance: 95 }])" },
      { name: "Empty class", call: "shortList([])" },
      { name: "Exactly 75%", call: "shortList([{ name: \"Zainab\", attendance: 75 }])" },
    ],
    variantSpec: { param: "limit", options: ["75", "80"], fills: { "75": { limit: "75" }, "80": { limit: "80" } } },
    rules: labRules({ variantsOn: true }),
  },
  {
    key: "bill", course: "web102", week: 5, type: "code", language: "javascript", title: "Dhaba Bill Total", status: "published", opensInDays: 0, dueInDays: 9, marks: 10,
    instructions: "Each item looks like `{ name: \"Paratha\", price: 60, qty: 2 }`. Write `billTotal(items)` that returns the **total in rupees**.\n\nExample: `billTotal([{ name: \"Chai\", price: 50, qty: 3 }, { name: \"Paratha\", price: 60, qty: 2 }])` returns `270`.\n\nAn empty order costs `0`.",
    starterCode: "function billTotal(items) {\n  // Add up price × qty for every item\n}\n\nconsole.log(billTotal([{ name: \"Chai\", price: 50, qty: 3 }, { name: \"Paratha\", price: 60, qty: 2 }]));\n",
    referenceSolution: "function billTotal(items) {\n  let total = 0;\n  for (const item of items) total += item.price * item.qty;\n  return total;\n}\n",
    tests: [
      { name: "Example from the brief", call: "billTotal([{ name: \"Chai\", price: 50, qty: 3 }, { name: \"Paratha\", price: 60, qty: 2 }])" },
      { name: "Empty order", call: "billTotal([])" },
      { name: "One item, many", call: "billTotal([{ name: \"Samosa\", price: 30, qty: 10 }])" },
    ],
    rules: labRules(),
  },
  {
    key: "palindrome", course: "web102", week: 6, type: "code", language: "javascript", title: "Palindrome Checker", status: "draft", opensInDays: 7, dueInDays: 14, marks: 10,
    instructions: "Write `isPalindrome(text)` that returns `true` if the text reads the same forwards and backwards, **ignoring case and spaces**.\n\nExample: `isPalindrome(\"Nurses run\")` returns `true`.",
    starterCode: "function isPalindrome(text) {\n  // Ignore case and spaces\n}\n\nconsole.log(isPalindrome(\"Nurses run\"));\n",
    referenceSolution: "function isPalindrome(text) {\n  const clean = text.toLowerCase().split(\" \").join(\"\");\n  return clean === clean.split(\"\").reverse().join(\"\");\n}\n",
    tests: [
      { name: "Example from the brief", call: "isPalindrome(\"Nurses run\")" },
      { name: "Not a palindrome", call: "isPalindrome(\"Lahore\")" },
      { name: "Single word", call: "isPalindrome(\"Madam\")" },
    ],
    rules: labRules(),
  },
  // ------------------------------------------------------------ CS-201 (Python, data structures)
  {
    key: "second", course: "cs201", week: 1, type: "code", language: "python", title: "Second Highest Score", status: "closed", opensInDays: -15, dueInDays: -9, marks: 10,
    instructions: "Write `second_highest(scores)` that returns the **second highest different score**, or `None` if there isn't one.\n\nExample: `second_highest([3, 1, 4, 1, 5])` returns `4`.",
    starterCode: "def second_highest(scores):\n    pass\n\n\nprint(second_highest([3, 1, 4, 1, 5]))\n",
    referenceSolution: "def second_highest(scores):\n    values = sorted(set(scores))\n    return values[-2] if len(values) >= 2 else None\n",
    tests: [
      { name: "Example from the brief", call: "second_highest([3, 1, 4, 1, 5])" },
      { name: "All the same", call: "second_highest([7, 7])" },
      { name: "Empty list", call: "second_highest([])" },
      { name: "Negative scores", call: "second_highest([-2, -5])" },
    ],
    rules: labRules(),
  },
  {
    key: "brackets", course: "cs201", week: 2, type: "code", language: "python", title: "Balanced Brackets", status: "closed", opensInDays: -8, dueInDays: -3, marks: 10,
    instructions: "Write `balanced(text)` that returns `True` if every bracket `()`, `[]` and `{}` in the text is closed in the right order, and `False` otherwise. Other characters are ignored.\n\nExample: `balanced(\"([]{})\")` returns `True`, `balanced(\"(]\")` returns `False`.",
    starterCode: "def balanced(text):\n    # Hint: a stack\n    pass\n\n\nprint(balanced(\"([]{})\"))\n",
    referenceSolution: "def balanced(text):\n    pairs = {')': '(', ']': '[', '}': '{'}\n    stack = []\n    for ch in text:\n        if ch in '([{':\n            stack.append(ch)\n        elif ch in pairs:\n            if not stack or stack.pop() != pairs[ch]:\n                return False\n    return not stack\n",
    tests: [
      { name: "Nested", call: "balanced(\"([]{})\")" },
      { name: "Wrong order", call: "balanced(\"(]\")" },
      { name: "Never closed", call: "balanced(\"((\")" },
      { name: "Empty text", call: "balanced(\"\")" },
      { name: "With letters", call: "balanced(\"a(b)c\")" },
    ],
    rules: labRules(),
  },
  {
    key: "queue", course: "cs201", week: 3, type: "code", language: "python", title: "Bank Queue Waiting Times", status: "published", opensInDays: -2, dueInDays: 5, marks: 10,
    instructions: "Customers stand in one queue at a bank counter. `service` lists how many minutes each customer's work takes, in queue order. Write `wait_times(service)` that returns a list of **how long each customer waits before being served**.\n\nExample: `wait_times([5, 3, 2])` returns `[0, 5, 8]`.",
    starterCode: "def wait_times(service):\n    pass\n\n\nprint(wait_times([5, 3, 2]))\n",
    referenceSolution: "def wait_times(service):\n    waits = []\n    clock = 0\n    for minutes in service:\n        waits.append(clock)\n        clock += minutes\n    return waits\n",
    tests: [
      { name: "Example from the brief", call: "wait_times([5, 3, 2])" },
      { name: "Nobody waiting", call: "wait_times([])" },
      { name: "One customer", call: "wait_times([4])" },
      { name: "Equal jobs", call: "wait_times([2, 2, 2, 2])" },
    ],
    rules: labRules(),
  },
  {
    key: "words", course: "cs201", week: 4, type: "code", language: "python", title: "Word Frequency Counter", status: "draft", opensInDays: 5, dueInDays: 12, marks: 10,
    instructions: "Write `word_counts(text)` that returns a dictionary mapping each **lower-case word** to how many times it appears, in the order words first appear.\n\nExample: `word_counts(\"Chai and more chai\")` returns `{'chai': 2, 'and': 1, 'more': 1}`.",
    starterCode: "def word_counts(text):\n    pass\n\n\nprint(word_counts(\"Chai and more chai\"))\n",
    referenceSolution: "def word_counts(text):\n    counts = {}\n    for word in text.lower().split():\n        counts[word] = counts.get(word, 0) + 1\n    return counts\n",
    tests: [
      { name: "Example from the brief", call: "word_counts(\"Chai and more chai\")" },
      { name: "Empty text", call: "word_counts(\"\")" },
      { name: "All different", call: "word_counts(\"one two three\")" },
    ],
    rules: labRules(),
  },
  {
    key: "merge", course: "cs201", week: 5, type: "code", language: "python", title: "Merge Two Sorted Lists", status: "draft", opensInDays: 12, dueInDays: 19, marks: 10,
    instructions: "Write `merge_sorted(a, b)` that merges two lists that are already sorted into one sorted list, **without calling `sorted` or `sort`**.\n\nExample: `merge_sorted([1, 4, 9], [2, 3, 10])` returns `[1, 2, 3, 4, 9, 10]`.",
    starterCode: "def merge_sorted(a, b):\n    pass\n\n\nprint(merge_sorted([1, 4, 9], [2, 3, 10]))\n",
    referenceSolution: "def merge_sorted(a, b):\n    i = j = 0\n    out = []\n    while i < len(a) and j < len(b):\n        if a[i] <= b[j]:\n            out.append(a[i])\n            i += 1\n        else:\n            out.append(b[j])\n            j += 1\n    return out + a[i:] + b[j:]\n",
    tests: [
      { name: "Example from the brief", call: "merge_sorted([1, 4, 9], [2, 3, 10])" },
      { name: "One empty", call: "merge_sorted([], [1])" },
      { name: "Duplicates", call: "merge_sorted([5], [5])" },
    ],
    rules: labRules(),
  },
  // ------------------------------------------------------------ ENG-101 (written answers)
  {
    key: "email", course: "eng101", week: 2, type: "written", language: null, title: "Formal Email to Your Teacher", status: "closed", opensInDays: -14, dueInDays: -8, marks: 10,
    instructions: "You missed a lab because of a family emergency. Write a **formal email** (120–180 words) to your teacher asking to submit the lab late.\n\nInclude: a clear subject line, a polite greeting, the reason in one or two sentences, exactly what you are asking for, and a proper closing.",
    starterCode: "Subject: \n\nDear ", referenceSolution: "", tests: [], rules: labRules(),
  },
  {
    key: "summary", course: "eng101", week: 5, type: "written", language: null, title: "Summarise a News Paragraph", status: "closed", opensInDays: -7, dueInDays: -2, marks: 10,
    instructions: "Summarise this paragraph in **60–80 words, in your own words**:\n\n\"Long hours of load-shedding in summer affect far more than comfort. Students study by phone torchlight, small shops lose refrigerated stock, and tailors and welders lose working hours they cannot recover. Families that can afford solar panels or UPS batteries cope better, which widens the gap between households. Economists argue that reliable electricity is not a luxury but a basic condition for learning and earning.\"",
    starterCode: "", referenceSolution: "", tests: [], rules: labRules(),
  },
  {
    key: "phones", course: "eng101", week: 4, type: "written", language: null, title: "Should Phones Be Allowed in Class?", status: "published", opensInDays: -1, dueInDays: 5, marks: 10,
    instructions: "In **150–200 words**, argue **for or against** allowing phones in university classes.\n\nState your position in the first sentence, give **two reasons**, support one of them with a **real example** from your own experience, and answer one objection.",
    starterCode: "", referenceSolution: "", tests: [], rules: labRules(),
  },
  {
    key: "process", course: "eng101", week: 3, type: "written", language: null, title: "Explain How to Make Chai", status: "draft", opensInDays: 4, dueInDays: 10, marks: 10,
    instructions: "Explain **how to make a cup of doodh patti chai** to someone who has never made it, in **6–8 clear steps**. Use one sentence per step and start each step with a verb.",
    starterCode: "", referenceSolution: "", tests: [], rules: labRules(),
  },
  {
    key: "reflection", course: "eng101", week: 6, type: "written", language: null, title: "Reflection: How I Use AI", status: "draft", opensInDays: 11, dueInDays: 18, marks: 10,
    instructions: "In **150–200 words**, reflect honestly on how you have used AI tools this term. Describe one time AI **helped you learn** and one time it **did the thinking for you**, and say what you will do differently.",
    starterCode: "", referenceSolution: "", tests: [], rules: labRules(),
  },
  ...quizAssignments,
];

export interface SeedAnnouncement {
  course: string;
  title: string;
  body: string;
  postedDaysAgo: number;
}

export const announcements: SeedAnnouncement[] = [
  { course: "cs101", title: "How marks work this term", body: "Every lab ends with a short viva from Ustaad about your own code. Half the marks come from the viva, so make sure you understand what you submit.", postedDaysAgo: 14 },
  { course: "cs101", title: "Cricket Over Tracker is open", body: "Week 3 lab is open. Run your code before submitting, and ask Ustaad for hints if you're stuck. It will never write the code for you.", postedDaysAgo: 2 },
  { course: "cs101", title: "Lab timings", body: "Monday and Wednesday labs run 2–5 PM in Lab 3. Bring your student card.", postedDaysAgo: 20 },
  { course: "web102", title: "JavaScript labs run in your browser", body: "No installation needed: your code runs right in the workspace. Use console.log to see what your program is doing.", postedDaysAgo: 12 },
  { course: "web102", title: "Attendance Shortage List is open", body: "Each of you has your own version of the limit, so read your task carefully.", postedDaysAgo: 2 },
  { course: "cs201", title: "Welcome to Data Structures", body: "We'll build stacks, queues and dictionaries from scratch. Every lab has a viva: be ready to explain your choices.", postedDaysAgo: 18 },
  { course: "cs201", title: "Bank Queue lab is open", body: "Think about what each customer has to wait for. Trace it on paper first.", postedDaysAgo: 2 },
  { course: "eng101", title: "Writing in your own words", body: "Paste is off in writing tasks. Ustaad will ask you about your own sentences after you submit, so write what you mean.", postedDaysAgo: 13 },
  { course: "eng101", title: "Argument task is open", body: "Pick a side and defend it with one real example from your own life.", postedDaysAgo: 1 },
];
