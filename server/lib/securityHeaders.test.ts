import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// vercel.json sends these on every response (pages, assets and the API).
const config = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8")) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};
const everyResponse = new Map(config.headers.find((h) => h.source === "/(.*)")?.headers.map((h) => [h.key, h.value]) ?? []);

describe("security headers on every response", () => {
  it("stops browsers guessing content types", () => {
    expect(everyResponse.get("X-Content-Type-Options")).toBe("nosniff");
  });
  it("keeps full URLs out of the Referer sent to other sites", () => {
    expect(everyResponse.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });
  it("turns off browser features the platform never uses, and leaves fullscreen alone (timed quizzes need it)", () => {
    const policy = everyResponse.get("Permissions-Policy") ?? "";
    for (const feature of ["camera=()", "microphone=()", "geolocation=()", "payment=()"]) expect(policy).toContain(feature);
    expect(policy).not.toContain("fullscreen");
  });
});
