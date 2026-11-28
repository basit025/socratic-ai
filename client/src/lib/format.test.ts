import { describe, expect, it } from "vitest";
import { firstName } from "./format";

describe("firstName", () => {
  it("uses the first name", () => expect(firstName("Ayesha Khan")).toBe("Ayesha"));
  it("keeps a title with the name", () => {
    expect(firstName("Dr. Nauman Shamim")).toBe("Dr. Nauman");
    expect(firstName("Mr. Irfan Hameed")).toBe("Mr. Irfan");
  });
  it("copes with a single word", () => expect(firstName("Hina")).toBe("Hina"));
});
