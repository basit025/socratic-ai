import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./passwords.js";

describe("passwords", () => {
  it("verifies the right password and rejects others", async () => {
    const h = await hashPassword("chai-and-paratha");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(h).not.toContain("chai");
    expect(await verifyPassword("chai-and-paratha", h)).toBe(true);
    expect(await verifyPassword("chai-and-parath", h)).toBe(false);
    expect(await verifyPassword("anything", null)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });
});
