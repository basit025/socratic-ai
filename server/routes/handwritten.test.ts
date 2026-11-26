import { describe, expect, it } from "vitest";
import { codeWordFound, newCodeWord, parseMeta } from "./handwritten.js";

describe("handwritten code words", () => {
  it("issues a word and a two-digit number", () => {
    for (let i = 0; i < 20; i++) expect(newCodeWord()).toMatch(/^[A-Z]+-\d{2}$/);
  });
  it("finds the word however it was written", () => {
    expect(codeWordFound("KITE-47", "kite 47")).toBe(true);
    expect(codeWordFound("KITE-47", null, "Code word: Kite-47\nQ1 ...")).toBe(true);
    expect(codeWordFound("KITE-47", "KITE-41")).toBe(false);
    expect(codeWordFound("KITE-47", null, null)).toBe(false);
  });
  it("reads the stored meta", () => {
    expect(parseMeta(JSON.stringify({ codeWord: "MANGO-12", codeWordFound: true, legibility: "clear" }))).toEqual({ codeWord: "MANGO-12", codeWordFound: true, legibility: "clear" });
    expect(parseMeta("(0, 0)")).toBeNull();
  });
});
