import { createHash, timingSafeEqual } from "node:crypto";

/**
 * True only when the Authorization header is exactly `Bearer ${CRON_SECRET}`.
 * Vercel Cron sends this header automatically when CRON_SECRET is set in the project.
 * If CRON_SECRET is missing or empty, every request is rejected.
 */
export function isAuthorizedCron(authHeader: string | undefined, secret: string | undefined): boolean {
  if (!secret || !secret.trim() || !authHeader) return false;
  // Hash both sides so the comparison is constant-time even when lengths differ.
  const given = createHash("sha256").update(authHeader).digest();
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(given, expected);
}
