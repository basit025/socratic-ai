import { Router } from "express";
import { z } from "zod";
import { eq, rpc, select } from "../lib/db.js";
import { PublicError } from "../lib/errors.js";
import { enforce } from "../lib/limits.js";
import { requireSession } from "../lib/auth.js";
import { clearSessionCookie, ipHash, setSessionCookie, type Session } from "../lib/session.js";

export const demoRouter = Router();

const StartBody = z.object({ role: z.enum(["teacher", "student"]) });

interface SandboxResult {
  sandbox_id: string;
  profile_id: string;
  full_name: string;
  role: "teacher" | "student";
  expires_at: string;
}

/**
 * "Try as teacher" / "Try as student": creates a private copy of the demo institution for this
 * visitor (never calls an AI model) and signs them in to it.
 */
demoRouter.post("/demo/start", async (req, res, next) => {
  try {
    const parsed = StartBody.safeParse(req.body);
    if (!parsed.success) throw new PublicError(400, "Choose teacher or student.", "bad_role");
    const ip = ipHash(req);
    await enforce("demoStartPerIp", ip);
    const r = await rpc<SandboxResult>("create_demo_sandbox", { p_role: parsed.data.role, p_ip_hash: ip, p_hours: 24 });
    const session: Session = { sid: r.sandbox_id, pid: r.profile_id, role: r.role, name: r.full_name, exp: Date.parse(r.expires_at) };
    setSessionCookie(res, session);
    res.status(201).json({ role: session.role, name: session.name, expiresAt: r.expires_at, home: session.role === "teacher" ? "/teacher" : "/student" });
  } catch (err) {
    next(err);
  }
});

/** Who am I? The front end calls this on load to decide what to show. */
demoRouter.get("/me", requireSession(), (req, res) => {
  const s = req.session!;
  res.set("Cache-Control", "no-store").json({ role: s.role, name: s.name, expiresAt: new Date(s.exp).toISOString(), demo: true });
});

/**
 * "See what your teacher sees": switches the visitor to the other demo role INSIDE the same sandbox,
 * so a judge who just did the student journey sees their own submission in the teacher's report.
 */
demoRouter.post("/demo/switch", requireSession(), async (req, res, next) => {
  try {
    const s = req.session!;
    const role = s.role === "student" ? "teacher" : "student";
    const [p] = await select<{ id: string; full_name: string }>(
      `profiles?select=id,full_name&sandbox_id=${eq(s.sid)}&email=${eq(`demo-${role}@pothohar.demo`)}`,
    );
    if (!p) throw new PublicError(404, "This demo has no " + role + " account.", "no_role");
    const next: Session = { sid: s.sid, pid: p.id, role, name: p.full_name, exp: s.exp };
    setSessionCookie(res, next);
    res.json({ role, name: p.full_name, home: role === "teacher" ? "/teacher" : "/student" });
  } catch (err) {
    next(err);
  }
});

/** Leaves the demo (the sandbox itself is deleted by the nightly reset). */
demoRouter.post("/demo/end", (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});
