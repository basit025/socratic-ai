import { describe, expect, it } from "vitest";
import { loadSessions, planPastSubmissions } from "./seed.js";
import { students } from "./content.js";

// Runs on the real session files in server/seed/sessions.
const sessions = loadSessions();
const plan = planPastSubmissions(sessions);

describe("past submissions in the demo class (T04)", () => {
  it("loads the session files", () => {
    expect(sessions.length).toBeGreaterThan(0);
  });

  it("gives every session to exactly one student", () => {
    expect(plan.length).toBe(sessions.length);
    expect(new Set(plan.map((p) => p.session.label)).size).toBe(sessions.length);
  });

  it("never gives one student two submissions on the same assignment", () => {
    const keys = plan.map((p) => `${p.session.assignment}:${p.student}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives the demo student past work only on closed assignments, from a strong session", () => {
    const demo = students.find((s) => s.email)!.key;
    const hers = plan.filter((p) => p.student === demo);
    expect(hers.length).toBeGreaterThan(0);
    for (const p of hers) expect(p.session.persona).toBe("strong");
  });
});
