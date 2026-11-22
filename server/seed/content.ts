/**
 * Demo content for the fictional "Pothohar Institute of Computing (Demo)".
 * Everything here is written by the team and clearly fictional: no real people or institutions.
 * Rules: no fabricated process logs. Past submissions with replays are added only from real
 * recorded sessions (see docs/event-format.md).
 *
 * Dates are offsets in days from the moment of seeding; demo sandboxes shift them to "now".
 */

export const INSTITUTION = "Pothohar Institute of Computing (Demo)";

export interface SeedPerson {
  key: string;
  fullName: string;
  initials: string;
  email?: string; // demo identities use demo-teacher@ / demo-student@pothohar.demo
}

export const teachers: SeedPerson[] = [
  { key: "sana", fullName: "Sana Rauf", initials: "SR", email: "demo-teacher@pothohar.demo" },
];

export const students: SeedPerson[] = [
  { key: "ayesha", fullName: "Ayesha Khan", initials: "AK", email: "demo-student@pothohar.demo" },
  { key: "bilal", fullName: "Bilal Ahmed", initials: "BA" },
  { key: "hamza", fullName: "Hamza Tariq", initials: "HT" },
  { key: "fatima", fullName: "Fatima Noor", initials: "FN" },
  { key: "zainab", fullName: "Zainab Ali", initials: "ZA" },
  { key: "usman", fullName: "Usman Javed", initials: "UJ" },
  { key: "mahnoor", fullName: "Mahnoor Iqbal", initials: "MI" },
  { key: "ali", fullName: "Ali Raza", initials: "AR" },
  { key: "sara", fullName: "Sara Malik", initials: "SM" },
  { key: "omar", fullName: "Omar Farooq", initials: "OF" },
];

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
  {
    key: "cs101",
    teacher: "sana",
    code: "CS-101",
    name: "Programming Fundamentals",
    section: "Section A",
    term: "Fall 2026",
    joinCode: "PKC7HA",
    students: students.map((s) => s.key),
  },
];

export interface SeedModule {
  course: string;
  week: number;
  title: string;
  notes: string;
}

export const modules: SeedModule[] = [
  { course: "cs101", week: 1, title: "Variables and arithmetic", notes: "A variable is a name for a value. This week: storing numbers and text, doing arithmetic, and printing results.\n\nExample: splitting a chai bill between friends, with a tip." },
  { course: "cs101", week: 2, title: "Loops and running totals", notes: "A `for` loop repeats the same steps for every item in a list. A running total starts at 0 and grows inside the loop.\n\nExample: adding up the runs in a cricket over." },
  { course: "cs101", week: 3, title: "Conditions", notes: "`if`, `elif` and `else` let a program choose. Combine a condition with a loop to count only the items you care about.\n\nExample: a rickshaw fare that changes after the first 2 km." },
  { course: "cs101", week: 4, title: "Functions", notes: "A function packages steps under a name, takes inputs (parameters) and gives back a result with `return`.\n\nWhy it matters: functions can be tested, which is how your assignments are marked." },
  { course: "cs101", week: 5, title: "Lists in depth", notes: "Indexing, slicing, `len`, and building new lists from old ones.\n\nExample: a load-shedding schedule stored as a list of hours." },
  { course: "cs101", week: 6, title: "Debugging and reading errors", notes: "Errors are information. Read the last line first, find the line number, and predict what each line does before you run it." },
];

export interface SeedTest {
  name: string;
  call: string;                      // Python expression run against the student's code
  expected: string | Record<string, string>; // repr() of the result, or per-variant values
}

export interface SeedAssignment {
  key: string;
  course: string;
  week: number;
  title: string;
  status: "draft" | "published" | "closed";
  opensInDays: number;
  dueInDays: number;
  marks: number;
  instructions: string;              // may contain {placeholders} filled per variant
  starterCode: string;
  referenceSolution: string;
  tests: SeedTest[];
  variantSpec?: { param: string; options: string[]; fills: Record<string, Record<string, string>> };
  rules: {
    pasteBlocked: boolean;
    workflow: "run_first" | "explain_first";
    vivaQuestions: number;
    vivaSecondsPerQ: number;
    vivaWeight: number;
    variantsOn: boolean;
  };
}

export const assignments: SeedAssignment[] = [
  {
    key: "chai",
    course: "cs101",
    week: 1,
    title: "Chai Bill Splitter",
    status: "closed",
    opensInDays: -16,
    dueInDays: -10,
    marks: 10,
    instructions:
      "Four friends share chai and parathas at a dhaba. Write `split_bill(total, people, tip_percent)` that returns how much each person pays, including the tip, rounded to 2 decimal places.\n\nExample: `split_bill(1200, 4, 10)` returns `330.0`.",
    starterCode: "def split_bill(total, people, tip_percent):\n    # Return the amount each person pays, rounded to 2 decimals\n    pass\n\n\nprint(split_bill(1200, 4, 10))\n",
    referenceSolution: "def split_bill(total, people, tip_percent):\n    with_tip = total * (1 + tip_percent / 100)\n    return round(with_tip / people, 2)\n",
    tests: [
      { name: "Example from the brief", call: "split_bill(1200, 4, 10)", expected: "330.0" },
      { name: "No tip", call: "split_bill(999, 3, 0)", expected: "333.0" },
      { name: "Half rupees", call: "split_bill(500, 2, 5)", expected: "262.5" },
      { name: "Empty bill", call: "split_bill(0, 5, 10)", expected: "0.0" },
    ],
    rules: { pasteBlocked: true, workflow: "run_first", vivaQuestions: 3, vivaSecondsPerQ: 90, vivaWeight: 50, variantsOn: false },
  },
  {
    key: "cricket",
    course: "cs101",
    week: 2,
    title: "Cricket Over Tracker",
    status: "published",
    opensInDays: -2,
    dueInDays: 3,
    marks: 10,
    instructions:
      "The {team} scorer records every ball of an over as a list of runs. Write `over_summary(balls)` that returns a tuple: **(total runs, number of balls that scored {boundary} or more)**.\n\nExample: `over_summary([1, 4, 0, 6, 2, 1])` returns `(14, {example_hits})`.\n\nAn empty over has scored nothing yet.",
    starterCode: "def over_summary(balls):\n    # balls is a list of runs, for example [1, 4, 0, 6, 2, 1]\n    # Return (total_runs, big_hits)\n    pass\n\n\nprint(over_summary([1, 4, 0, 6, 2, 1]))\n",
    referenceSolution:
      "def over_summary(balls):\n    total = 0\n    big_hits = 0\n    for runs in balls:\n        total += runs\n        if runs >= BOUNDARY:\n            big_hits += 1\n    return (total, big_hits)\n",
    tests: [
      { name: "Example from the brief", call: "over_summary([1, 4, 0, 6, 2, 1])", expected: { "4": "(14, 2)", "6": "(14, 1)" } },
      { name: "Empty over", call: "over_summary([])", expected: "(0, 0)" },
      { name: "Six sixes", call: "over_summary([6, 6, 6, 6, 6, 6])", expected: "(36, 6)" },
      { name: "A quiet over", call: "over_summary([0, 0, 1, 0, 0, 0])", expected: "(1, 0)" },
      { name: "Mixed over", call: "over_summary([4, 4, 3, 5, 6, 0])", expected: { "4": "(22, 4)", "6": "(22, 1)" } },
    ],
    variantSpec: {
      param: "boundary",
      options: ["4", "6"],
      fills: {
        "4": { boundary: "4", example_hits: "2", team: "Islamabad club" },
        "6": { boundary: "6", example_hits: "1", team: "Rawalpindi club" },
      },
    },
    rules: { pasteBlocked: true, workflow: "run_first", vivaQuestions: 3, vivaSecondsPerQ: 90, vivaWeight: 50, variantsOn: true },
  },
  {
    key: "rickshaw",
    course: "cs101",
    week: 3,
    title: "Rickshaw Fare Estimator",
    status: "draft",
    opensInDays: 5,
    dueInDays: 10,
    marks: 10,
    instructions:
      "A rickshaw charges Rs 100 for the first 2 km and Rs 40 for every km after that. Part of a km counts as a full km. Write `fare(km)` that returns the fare in rupees.\n\nExample: `fare(3)` returns `140`.",
    starterCode: "import math\n\n\ndef fare(km):\n    # Rs 100 covers the first 2 km; Rs 40 for each km after that\n    pass\n\n\nprint(fare(3))\n",
    referenceSolution: "import math\n\n\ndef fare(km):\n    km = math.ceil(km)\n    if km <= 2:\n        return 100\n    return 100 + 40 * (km - 2)\n",
    tests: [
      { name: "Short ride", call: "fare(1)", expected: "100" },
      { name: "Exactly 2 km", call: "fare(2)", expected: "100" },
      { name: "Example from the brief", call: "fare(3)", expected: "140" },
      { name: "Part of a km", call: "fare(5.5)", expected: "260" },
    ],
    rules: { pasteBlocked: true, workflow: "explain_first", vivaQuestions: 3, vivaSecondsPerQ: 90, vivaWeight: 50, variantsOn: false },
  },
];

export interface SeedAnnouncement {
  course: string;
  title: string;
  body: string;
  postedDaysAgo: number;
}

export const announcements: SeedAnnouncement[] = [
  { course: "cs101", title: "How marks work this term", body: "Every lab ends with a short viva from Ustaad about your own code. Half the marks come from the viva, so make sure you understand what you submit.", postedDaysAgo: 14 },
  { course: "cs101", title: "Cricket Over Tracker is open", body: "Week 2 lab is open. Run your code at least once before submitting, and ask Ustaad for hints if you get stuck. It will never write the code for you.", postedDaysAgo: 2 },
];
