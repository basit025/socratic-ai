import { describe, expect, it } from "vitest";
import { buildNotices } from "./home.js";

const NOW = Date.parse("2026-11-27T12:00:00Z");
const iso = (hoursFromNow: number) => new Date(NOW + hoursFromNow * 3_600_000).toISOString();

const assignment = (over: Partial<Parameters<typeof buildNotices>[0][number]["assignments"][number]>) => ({
  id: "a1",
  title: "Cricket Over Tracker",
  type: "code",
  open: true,
  opensAt: iso(-24 * 20),
  dueAt: iso(24 * 10),
  marks: 10,
  submission: null,
  ...over,
});

describe("buildNotices", () => {
  it("announces new work opened in the last week, but not older work", () => {
    const n = buildNotices([{ id: "c1", code: "CS-101", assignments: [assignment({ id: "new", opensAt: iso(-5) }), assignment({ id: "old" })] }], [], NOW);
    expect(n.map((x) => x.id)).toEqual(["n:new"]);
  });

  it("reminds about work due within two days that isn't handed in", () => {
    const n = buildNotices(
      [
        {
          id: "c1",
          code: "CS-101",
          assignments: [
            assignment({ id: "soon", dueAt: iso(20) }),
            assignment({ id: "done", dueAt: iso(20), submission: { status: "submitted", grade: null, confirmed: false, gradedAt: null } }),
          ],
        },
      ],
      [],
      NOW,
    );
    expect(n.map((x) => x.id)).toEqual(["d:soon"]);
  });

  it("tells the student when a teacher confirms a mark, never for an unconfirmed suggestion", () => {
    const n = buildNotices(
      [
        {
          id: "c1",
          code: "CS-101",
          assignments: [
            assignment({ id: "m", open: false, submission: { status: "graded", grade: 7, confirmed: true, gradedAt: iso(-3) } }),
            assignment({ id: "s", open: false, submission: { status: "graded", grade: 9, confirmed: false, gradedAt: iso(-3) } }),
          ],
        },
      ],
      [],
      NOW,
    );
    expect(n).toHaveLength(1);
    expect(n[0]).toMatchObject({ id: "m:m", kind: "marked", body: "7/10" });
  });

  it("puts the newest first and skips announcements scheduled for the future", () => {
    const n = buildNotices(
      [{ id: "c1", code: "CS-101", assignments: [assignment({ id: "new", opensAt: iso(-30) })] }],
      [
        { id: "x", course_id: "c1", title: "Lab moved", body: "Thursday", posted_at: iso(-1) },
        { id: "y", course_id: "c1", title: "Later", body: "not yet", posted_at: iso(5) },
      ],
      NOW,
    );
    expect(n.map((x) => x.id)).toEqual(["a:x", "n:new"]);
    expect(n[0]!.courseCode).toBe("CS-101");
  });
});
