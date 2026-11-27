import { describe, expect, it } from "vitest";
import { assignments, courses, PACE } from "./content.js";

const mine = courses.filter((c) => c.students.includes("ayesha")).map((c) => c.key);
const myOpen = assignments.filter((a) => mine.includes(a.course) && a.status === "published");

describe("the sample student's semester", () => {
  it("has exactly five courses", () => {
    expect(mine.sort()).toEqual(["cs101", "cs201", "cs341", "cs381", "web102"]);
  });

  it("paces only assignments that exist", () => {
    const keys = new Set(assignments.map((a) => a.key));
    expect(Object.keys(PACE).filter((k) => !keys.has(k))).toEqual([]);
  });

  it("never piles work up: at most 2 due on one day, 7 in the next week, 3 open per course", () => {
    const perDay = new Map<number, number>();
    for (const a of myOpen) perDay.set(a.dueInDays, (perDay.get(a.dueInDays) ?? 0) + 1);
    expect(Math.max(...perDay.values())).toBeLessThanOrEqual(2);
    expect(myOpen.filter((a) => a.dueInDays >= 0 && a.dueInDays <= 7).length).toBeLessThanOrEqual(7);
    for (const c of mine) expect(myOpen.filter((a) => a.course === c).length).toBeLessThanOrEqual(3);
    for (const a of myOpen) expect(a.opensInDays).toBeLessThan(a.dueInDays);
  });

  it("keeps the demo path's assignment open", () => {
    expect(assignments.find((a) => a.key === "cricket")).toMatchObject({ status: "published", course: "cs101" });
  });
});
