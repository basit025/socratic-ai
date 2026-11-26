/**
 * Helpers for the course packs in this folder. Each pack is one course: its weekly notes (written by
 * the team from their own lecture slides, which are never committed), assignments and quizzes.
 * Dates are offsets in days from today: past weeks are closed, the current week is open, later weeks
 * are drafts the teacher hasn't published yet.
 */
import type { SeedAnnouncement, SeedAssignment, SeedCourse, SeedModule, SeedQuiz } from "../content.js";

export interface CoursePack {
  course: SeedCourse;
  modules: SeedModule[];
  assignments: SeedAssignment[];
  announcements: SeedAnnouncement[];
}

export const labRules = (o: Partial<SeedAssignment["rules"]> = {}): SeedAssignment["rules"] => ({
  pasteBlocked: true, workflow: "run_first", vivaQuestions: 3, vivaSecondsPerQ: 90, vivaWeight: 50, variantsOn: false, ...o,
});

export const weeks = (course: string, list: [string, string][]): SeedModule[] => list.map(([title, notes], i) => ({ course, week: i + 1, title, notes: notes.trim() }));

type Timing = Pick<SeedAssignment, "status" | "opensInDays" | "dueInDays">;
/** Past week: handed in and closed. */
export const closed = (weeksAgo: number): Timing => ({ status: "closed", opensInDays: -7 * weeksAgo - 6, dueInDays: -7 * weeksAgo + 1 });
/** This week: open now, due in a few days. */
export const open = (dueInDays: number, openedDaysAgo = 3): Timing => ({ status: "published", opensInDays: -openedDaysAgo, dueInDays });
/** A later week: drafted by the teacher, not visible to students yet. */
export const draft = (weeksAhead: number): Timing => ({ status: "draft", opensInDays: 7 * weeksAhead - 2, dueInDays: 7 * weeksAhead + 4 });

/** A Python (or JS) lab whose hidden-test answers are computed by running the reference solution. */
export const lab = (a: Omit<SeedAssignment, "type" | "rules"> & { rules?: Partial<SeedAssignment["rules"]> }): SeedAssignment => ({ ...a, type: "code", rules: labRules(a.rules) });

/** A written answer, marked by its viva and the teacher. */
export const written = (a: Omit<SeedAssignment, "type" | "language" | "referenceSolution" | "tests" | "rules" | "starterCode"> & { starterCode?: string }): SeedAssignment => ({
  ...a, type: "written", language: null, starterCode: a.starterCode ?? "", referenceSolution: "", tests: [], rules: labRules(),
});

/** A timed quiz: each student gets `draw` questions from the pool, in their own order. */
export const quiz = (a: Omit<SeedAssignment, "type" | "language" | "starterCode" | "referenceSolution" | "tests" | "rules" | "quiz"> & { quiz: SeedQuiz }): SeedAssignment => ({
  ...a, type: "quiz", language: null, starterCode: "", referenceSolution: "", tests: [],
  rules: { pasteBlocked: true, workflow: "run_first", vivaQuestions: 0, vivaSecondsPerQ: 90, vivaWeight: 0, variantsOn: false },
});

/** Handwritten work: solved on paper with a one-time code word, photographed in the app, then a viva. */
export const handwritten = (a: Omit<SeedAssignment, "type" | "language" | "referenceSolution" | "tests" | "rules" | "starterCode">): SeedAssignment => ({
  ...a, type: "handwritten", language: null, starterCode: "", referenceSolution: "", tests: [], rules: labRules({ pasteBlocked: false }),
});
