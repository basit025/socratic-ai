/**
 * Assignment templates a teacher can start from in the builder ("rules in 3 clicks").
 * Written by the team; Pakistani classroom contexts. Expected test values are NOT stored here:
 * the builder computes them by running the reference solution in the teacher's browser.
 * `{placeholders}` in instructions and the reference solution are filled per variant option.
 */
export interface Template {
  key: string;
  title: string;
  summary: string;
  instructions: string;
  starterCode: string;
  referenceSolution: string;
  tests: { name: string; call: string }[];
  variants: { param: string; options: string[]; fills: Record<string, Record<string, string>> } | null;
  marks: number;
}

export const templates: Template[] = [
  {
    key: "cricket",
    title: "Cricket Over Tracker",
    summary: "Loops and running totals: total runs and big hits in an over.",
    instructions:
      "The {team} scorer records every ball of an over as a list of runs. Write `over_summary(balls)` that returns a tuple: **(total runs, number of balls that scored {boundary} or more)**.\n\nExample: `over_summary([1, 4, 0, 6, 2, 1])` returns `(14, {example_hits})`.\n\nAn empty over has scored nothing yet.",
    starterCode: "def over_summary(balls):\n    # balls is a list of runs, for example [1, 4, 0, 6, 2, 1]\n    # Return (total_runs, big_hits)\n    pass\n\n\nprint(over_summary([1, 4, 0, 6, 2, 1]))\n",
    referenceSolution:
      "def over_summary(balls):\n    total = 0\n    big_hits = 0\n    for runs in balls:\n        total += runs\n        if runs >= {boundary}:\n            big_hits += 1\n    return (total, big_hits)\n",
    tests: [
      { name: "Example from the brief", call: "over_summary([1, 4, 0, 6, 2, 1])" },
      { name: "Empty over", call: "over_summary([])" },
      { name: "Six sixes", call: "over_summary([6, 6, 6, 6, 6, 6])" },
      { name: "A quiet over", call: "over_summary([0, 0, 1, 0, 0, 0])" },
      { name: "Mixed over", call: "over_summary([4, 4, 3, 5, 6, 0])" },
    ],
    variants: {
      param: "boundary",
      options: ["4", "6"],
      fills: {
        "4": { boundary: "4", example_hits: "2", team: "Islamabad club" },
        "6": { boundary: "6", example_hits: "1", team: "Rawalpindi club" },
      },
    },
    marks: 10,
  },
  {
    key: "loadshedding",
    title: "Load-shedding Planner",
    summary: "Sorting and streaks: the longest power cut in a day.",
    instructions:
      "WAPDA publishes the hours (0–23) when your area has no electricity. Write `longest_outage(hours)` that returns the **length of the longest run of consecutive hours** without power.\n\nExample: `longest_outage([1, 2, 3, 7, 8])` returns `3`.\n\nThe hours may come in any order. No outages means `0`.",
    starterCode: "def longest_outage(hours):\n    # hours is a list like [1, 2, 3, 7, 8]\n    # Return the longest run of back-to-back hours\n    pass\n\n\nprint(longest_outage([1, 2, 3, 7, 8]))\n",
    referenceSolution:
      "def longest_outage(hours):\n    best = 0\n    run = 0\n    prev = None\n    for h in sorted(hours):\n        if prev is not None and h == prev + 1:\n            run += 1\n        else:\n            run = 1\n        best = max(best, run)\n        prev = h\n    return best\n",
    tests: [
      { name: "Example from the brief", call: "longest_outage([1, 2, 3, 7, 8])" },
      { name: "No outages", call: "longest_outage([])" },
      { name: "Out of order", call: "longest_outage([9, 7, 8, 1])" },
      { name: "Late night", call: "longest_outage([21, 22, 23])" },
      { name: "Scattered hours", call: "longest_outage([1, 3, 5])" },
    ],
    variants: null,
    marks: 10,
  },
  {
    key: "results",
    title: "Exam Result Calculator",
    summary: "Conditions: turning marks into a grade.",
    instructions:
      "Write `grade(marks)` for a {board} result card. It returns **\"A\"** for {a} or more, **\"B\"** for {b} or more, **\"C\"** for {c} or more, and **\"F\"** otherwise.\n\nExample: `grade(72)` returns `\"B\"`.",
    starterCode: "def grade(marks):\n    # Return \"A\", \"B\", \"C\" or \"F\"\n    pass\n\n\nprint(grade(72))\n",
    referenceSolution:
      "def grade(marks):\n    if marks >= {a}:\n        return \"A\"\n    if marks >= {b}:\n        return \"B\"\n    if marks >= {c}:\n        return \"C\"\n    return \"F\"\n",
    tests: [
      { name: "Example from the brief", call: "grade(72)" },
      { name: "Top marks", call: "grade(100)" },
      { name: "Exactly on the A line", call: "grade(85)" },
      { name: "Just below C", call: "grade(54)" },
      { name: "Zero", call: "grade(0)" },
    ],
    variants: {
      param: "scale",
      options: ["board", "university"],
      fills: {
        board: { board: "intermediate board", a: "85", b: "70", c: "55" },
        university: { board: "university", a: "80", b: "65", c: "50" },
      },
    },
    marks: 10,
  },
  {
    key: "metro",
    title: "Metro Card Balance",
    summary: "Integer division and edge cases: rides left on a card.",
    instructions:
      "A Metro Bus card has a balance in rupees, and every ride costs the same fare. Write `rides_left(balance, fare)` that returns **how many full rides** the balance can pay for.\n\nExample: `rides_left(500, 50)` returns `10`.\n\nIf the fare is 0 or less, return `0` (the card is broken).",
    starterCode: "def rides_left(balance, fare):\n    # Return how many full rides the balance pays for\n    pass\n\n\nprint(rides_left(500, 50))\n",
    referenceSolution: "def rides_left(balance, fare):\n    if fare <= 0:\n        return 0\n    return balance // fare\n",
    tests: [
      { name: "Example from the brief", call: "rides_left(500, 50)" },
      { name: "Not enough for one ride", call: "rides_left(49, 50)" },
      { name: "Leftover change", call: "rides_left(130, 40)" },
      { name: "Broken card", call: "rides_left(100, 0)" },
      { name: "Empty card", call: "rides_left(0, 30)" },
    ],
    variants: null,
    marks: 10,
  },
];
