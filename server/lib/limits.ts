/**
 * Rate limits, stored in Postgres (serverless instances share no memory).
 * Fixed windows via hit_rate_limit(); every limit has a friendly message.
 */
import { rpc } from "./db.js";
import { tooMany } from "./errors.js";

export const LIMITS = {
  demoStartPerIp: { window: 3600, max: 30, message: "Too many new demos from this network in the last hour. Please continue with the one you have, or try again later." },
  loginPerIp: { window: 900, max: 20, message: "Too many sign-in attempts from this network. Please wait 15 minutes and try again." },
  joinPerIp: { window: 900, max: 30, message: "Too many join attempts. Please wait a few minutes and try again." },
  aiPerSandbox: { window: 3600, max: 60, message: "You've asked Ustaad a lot this hour. Take a moment to try it yourself, then ask again in a few minutes." },
  aiPerIp: { window: 3600, max: 200, message: "Ustaad is getting a lot of questions from this network right now. Please try again in a few minutes." },
} as const;

type LimitName = keyof typeof LIMITS;

export async function enforce(name: LimitName, subject: string): Promise<void> {
  const l = LIMITS[name];
  const allowed = await rpc<boolean>("hit_rate_limit", { p_key: `${name}:${subject}`, p_window_seconds: l.window, p_max: l.max });
  if (!allowed) throw tooMany(l.message);
}

/** Call before every AI request. */
export async function enforceAi(sandboxId: string, ipHash: string): Promise<void> {
  await enforce("aiPerSandbox", sandboxId);
  await enforce("aiPerIp", ipHash);
}
