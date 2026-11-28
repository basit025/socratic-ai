import { describe, expect, it } from "vitest";
import { LECTURE_DECKS } from "./lectureDecks.js";
import { deckFor, pagePath } from "./lectureSlides.js";

describe("lecture slide decks", () => {
  it("finds a course's deck by code and week, and nothing for other lectures", () => {
    const dm = deckFor("CS-341", 4);
    expect(dm?.count).toBeGreaterThan(0);
    expect(deckFor("CS-341", 99)).toBeNull();
    expect(deckFor("NOPE-1", 1)).toBeNull();
  });

  it("builds zero-padded page paths inside the deck's folder", () => {
    expect(pagePath({ dir: "CS-201/w07-abcd1234", count: 132 }, 7)).toBe("CS-201/w07-abcd1234/007.webp");
  });

  it("keeps every deck in its own course folder with a content hash", () => {
    for (const [code, weeks] of Object.entries(LECTURE_DECKS))
      for (const [week, d] of Object.entries(weeks)) {
        expect(d.dir).toMatch(new RegExp(`^${code}/w${String(week).padStart(2, "0")}-[0-9a-f]{8}$`));
        expect(d.count).toBeGreaterThan(0);
      }
  });
});
