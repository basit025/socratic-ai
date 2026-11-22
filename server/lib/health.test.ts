import { beforeEach, describe, expect, it, vi } from "vitest";
import { getHealth, overallStatus, resetHealthCache } from "./health.js";
import { isAuthorizedCron } from "./cronAuth.js";

const okFetch = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
const fullEnv = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  GEMINI_API_KEY: "g",
  GROQ_API_KEY: "q",
  OPENROUTER_API_KEY: "o",
};

describe("overallStatus", () => {
  it("is down when the database is not ok", () => {
    expect(overallStatus({ database: "error", gemini: "ok", groq: "ok", openrouter: "ok" })).toBe("down");
    expect(overallStatus({ database: "not_configured", gemini: "ok", groq: "ok", openrouter: "ok" })).toBe("down");
  });
  it("is degraded when an AI provider is not ok", () => {
    expect(overallStatus({ database: "ok", gemini: "error", groq: "ok", openrouter: "ok" })).toBe("degraded");
    expect(overallStatus({ database: "ok", gemini: "ok", groq: "ok", openrouter: "not_configured" })).toBe("degraded");
  });
  it("is ok when everything answers", () => {
    expect(overallStatus({ database: "ok", gemini: "ok", groq: "ok", openrouter: "ok" })).toBe("ok");
  });
});

describe("getHealth", () => {
  beforeEach(() => resetHealthCache());

  it("reports not_configured without calling anything when keys are missing", async () => {
    const fetchSpy = vi.fn() as unknown as typeof fetch;
    const report = await getHealth({}, fetchSpy, 0);
    expect(report.checks).toEqual({ database: "not_configured", gemini: "not_configured", groq: "not_configured", openrouter: "not_configured" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("treats network failures as error, never throws", async () => {
    const failing = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const report = await getHealth(fullEnv, failing, 0);
    expect(report.checks).toEqual({ database: "error", gemini: "error", groq: "error", openrouter: "error" });
    expect(report.status).toBe("down");
  });

  it("caches results for 60 seconds", async () => {
    await getHealth(fullEnv, okFetch, 0);
    const second = await getHealth(fullEnv, okFetch, 30_000);
    expect(second.cached).toBe(true);
    const third = await getHealth(fullEnv, okFetch, 61_000);
    expect(third.cached).toBe(false);
  });

  it("never puts secrets in the report", async () => {
    const report = await getHealth(fullEnv, okFetch, 0);
    const text = JSON.stringify(report);
    expect(text).not.toContain("service");
    expect(text).not.toContain("example.supabase.co");
  });
});

describe("isAuthorizedCron", () => {
  it("accepts only the exact bearer secret", () => {
    expect(isAuthorizedCron("Bearer s3cret", "s3cret")).toBe(true);
    expect(isAuthorizedCron("Bearer wrong", "s3cret")).toBe(false);
    expect(isAuthorizedCron("s3cret", "s3cret")).toBe(false);
    expect(isAuthorizedCron(undefined, "s3cret")).toBe(false);
  });
  it("rejects everything when the secret is not configured", () => {
    expect(isAuthorizedCron("Bearer ", "")).toBe(false);
    expect(isAuthorizedCron("Bearer undefined", undefined)).toBe(false);
  });
});
