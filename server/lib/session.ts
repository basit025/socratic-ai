/**
 * Signed session cookie: who the visitor is and which sandbox they're in.
 * Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256). Tampering breaks the signature.
 * The signing key is SESSION_SECRET if set, otherwise derived from the service-role key
 * (so no extra environment variable is required; rotating that key logs everyone out).
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";

export const COOKIE_NAME = "sai_session";

export interface Session {
  sid: string;                      // sandbox id
  pid: string;                      // profile id
  role: "teacher" | "student";
  name: string;
  exp: number;                      // expiry, ms since epoch
  demo?: boolean;                   // false for real accounts (the 'live' sandbox)
}

type Env = Record<string, string | undefined>;

export function signingKey(env: Env = process.env): Buffer {
  const explicit = env.SESSION_SECRET?.trim();
  if (explicit) return Buffer.from(explicit);
  const base = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base) throw new Error("No session signing key: set SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY.");
  return createHash("sha256").update(`socratic-ai-session:${base}`).digest();
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export function encodeSession(s: Session, env?: Env): string {
  const body = b64(JSON.stringify(s));
  const sig = b64(createHmac("sha256", signingKey(env)).update(body).digest());
  return `${body}.${sig}`;
}

export function decodeSession(token: string | undefined, env?: Env, now = Date.now()): Session | null {
  if (!token || token.length > 2048) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", signingKey(env)).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Session;
    if (typeof s.exp !== "number" || s.exp <= now) return null;
    if (s.role !== "teacher" && s.role !== "student") return null;
    return s;
  } catch {
    return null;
  }
}

export function readCookie(req: Request, name = COOKIE_NAME): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

export function getSession(req: Request): Session | null {
  return decodeSession(readCookie(req));
}

export function setSessionCookie(res: Response, s: Session): void {
  res.cookie(COOKIE_NAME, encodeSession(s), {
    httpOnly: true,
    secure: process.env.VERCEL_ENV !== undefined,  // HTTPS on Vercel; plain http on localhost
    sameSite: "lax",
    path: "/",
    expires: new Date(s.exp),
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

/** Salted hash of the caller's IP (for rate limits). The raw IP is never stored. */
export function ipHash(req: Request, env?: Env): string {
  const forwarded = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
  const ip = forwarded || (req.headers["x-real-ip"] as string | undefined) || req.socket.remoteAddress || "unknown";
  return createHmac("sha256", signingKey(env)).update(`ip:${ip}`).digest("hex").slice(0, 32);
}
