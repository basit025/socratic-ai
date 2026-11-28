/**
 * Real accounts (FR-01) and courses with join codes (FR-02, FR-03).
 * Accounts live in the 'live' sandbox; demo visitors can also create and join courses inside their own sandbox.
 */
import { randomInt, randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { requireSession } from "../lib/auth.js";
import { eq, insert, insertIgnoringDuplicates, rpc, select } from "../lib/db.js";
import { PublicError } from "../lib/errors.js";
import { enforce } from "../lib/limits.js";
import { hashPassword, verifyPassword } from "../lib/passwords.js";
import { ipHash, setSessionCookie, type Session } from "../lib/session.js";

export const accountsRouter = Router();

const ACCOUNT_DAYS = 14;
const initials = (name: string) => name.trim().replace(/^(Dr|Mr|Ms|Mrs|Prof)\.?\s+/i, "").split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";

const SignupBody = z.object({
  role: z.enum(["teacher", "student"]),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(8).max(200),
});

accountsRouter.post("/auth/signup", async (req, res, next) => {
  try {
    await enforce("demoStartPerIp", ipHash(req)); // shares the per-network limit for new identities
    const body = SignupBody.safeParse(req.body);
    if (!body.success) {
      const field = body.error.issues[0]?.path[0];
      throw new PublicError(
        400,
        field === "password" ? "Use a password of at least 8 characters." : field === "email" ? "Enter a valid email address." : "Enter your name (at least 2 characters).",
        "bad_signup",
      );
    }
    const live = await rpc<string>("live_sandbox_id");
    const [existing] = await select<{ id: string }>(`profiles?select=id&sandbox_id=${eq(live)}&email=${eq(body.data.email)}`);
    if (existing) throw new PublicError(409, "An account with this email already exists. Sign in instead.", "email_taken");
    const id = randomUUID();
    await insert("profiles", {
      id,
      sandbox_id: live,
      role: body.data.role,
      full_name: body.data.name,
      email: body.data.email,
      initials: initials(body.data.name),
      password_hash: await hashPassword(body.data.password),
    });
    const s: Session = { sid: live, pid: id, role: body.data.role, name: body.data.name, exp: Date.now() + ACCOUNT_DAYS * 86_400_000, demo: false };
    setSessionCookie(res, s);
    res.status(201).json({ role: s.role, name: s.name, home: s.role === "teacher" ? "/teacher" : "/student" });
  } catch (err) {
    next(err);
  }
});

const LoginBody = z.object({ email: z.string().trim().toLowerCase().max(120), password: z.string().max(200) });

accountsRouter.post("/auth/login", async (req, res, next) => {
  try {
    await enforce("loginPerIp", ipHash(req));
    const body = LoginBody.safeParse(req.body);
    if (!body.success) throw new PublicError(400, "Enter your email and password.", "bad_login");
    const live = await rpc<string>("live_sandbox_id");
    const [p] = await select<{ id: string; role: "teacher" | "student"; full_name: string; password_hash: string | null }>(
      `profiles?select=id,role,full_name,password_hash&sandbox_id=${eq(live)}&email=${eq(body.data.email)}`,
    );
    // The same message either way, so the form doesn't reveal which emails have accounts.
    if (!p || !(await verifyPassword(body.data.password, p.password_hash))) {
      throw new PublicError(401, "That email and password don't match an account.", "bad_credentials");
    }
    const s: Session = { sid: live, pid: p.id, role: p.role, name: p.full_name, exp: Date.now() + ACCOUNT_DAYS * 86_400_000, demo: false };
    setSessionCookie(res, s);
    res.json({ role: s.role, name: s.name, home: s.role === "teacher" ? "/teacher" : "/student" });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------- courses with join codes
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const newJoinCode = () => Array.from({ length: 6 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join("");

const CourseBody = z.object({
  code: z.string().trim().min(2).max(20),
  name: z.string().trim().min(2).max(120),
  section: z.string().trim().max(60).optional(),
});

accountsRouter.post("/courses", requireSession("teacher"), async (req, res, next) => {
  try {
    const { sid, pid } = req.session!;
    const body = CourseBody.safeParse(req.body);
    if (!body.success) throw new PublicError(400, "Give the course a code (like CS-101) and a name.", "bad_course");
    for (let attempt = 0; attempt < 5; attempt++) {
      const joinCode = newJoinCode();
      const [clash] = await select<{ id: string }>(`courses?select=id&sandbox_id=${eq(sid)}&join_code=${eq(joinCode)}`);
      if (clash) continue;
      const id = randomUUID();
      await insert("courses", { id, sandbox_id: sid, teacher_id: pid, code: body.data.code, name: body.data.name, section: body.data.section || null, term: "Fall 2026", join_code: joinCode });
      res.status(201).json({ id, joinCode });
      return;
    }
    throw new PublicError(503, "Couldn't create a unique join code. Please try again.", "join_code");
  } catch (err) {
    next(err);
  }
});

const JoinBody = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z2-9]{6}$/) });

accountsRouter.post("/courses/join", requireSession("student"), async (req, res, next) => {
  try {
    const { sid, pid } = req.session!;
    const body = JoinBody.safeParse(req.body);
    if (!body.success) throw new PublicError(400, "A join code has 6 letters and numbers, like PKC7HA.", "bad_code");
    await enforce("joinPerIp", ipHash(req));
    const [c] = await select<{ id: string; code: string; name: string }>(`courses?select=id,code,name&sandbox_id=${eq(sid)}&join_code=${eq(body.data.code)}`);
    if (!c) throw new PublicError(404, "No course has that code. Check it with your teacher.", "no_course");
    await insertIgnoringDuplicates("enrollments", [{ sandbox_id: sid, course_id: c.id, student_id: pid }], "course_id,student_id");
    res.json({ courseId: c.id, code: c.code, name: c.name });
  } catch (err) {
    next(err);
  }
});
