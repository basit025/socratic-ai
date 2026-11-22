import { describe, expect, it } from "vitest";
import { decodeSession, encodeSession, type Session } from "./session.js";

const env = { SUPABASE_SERVICE_ROLE_KEY: "test-key" };
const s: Session = { sid: "sb-1", pid: "p-1", role: "student", name: "Ayesha Khan", exp: Date.now() + 60_000 };

describe("session cookie", () => {
  it("round-trips a valid session", () => {
    expect(decodeSession(encodeSession(s, env), env)).toEqual(s);
  });

  it("rejects a tampered payload (e.g. switching role to teacher)", () => {
    const [, sig] = encodeSession(s, env).split(".");
    const forged = Buffer.from(JSON.stringify({ ...s, role: "teacher" })).toString("base64url");
    expect(decodeSession(`${forged}.${sig}`, env)).toBeNull();
  });

  it("rejects a cookie signed with a different key", () => {
    expect(decodeSession(encodeSession(s, { SUPABASE_SERVICE_ROLE_KEY: "other" }), env)).toBeNull();
  });

  it("rejects expired sessions and garbage", () => {
    expect(decodeSession(encodeSession({ ...s, exp: Date.now() - 1 }, env), env)).toBeNull();
    expect(decodeSession("not-a-token", env)).toBeNull();
    expect(decodeSession(undefined, env)).toBeNull();
  });

  it("prefers SESSION_SECRET when set", () => {
    const token = encodeSession(s, { ...env, SESSION_SECRET: "explicit" });
    expect(decodeSession(token, env)).toBeNull();
    expect(decodeSession(token, { ...env, SESSION_SECRET: "explicit" })).toEqual(s);
  });
});
