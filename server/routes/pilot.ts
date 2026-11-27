/**
 * "Book a pilot" from the landing page: an institution asks to try Socratic AI with a real class.
 * Stored server-side only (pilot_requests); rate-limited per network. No session needed.
 */
import { Router } from "express";
import { z } from "zod";
import { insert } from "../lib/db.js";
import { PublicError } from "../lib/errors.js";
import { enforce } from "../lib/limits.js";
import { ipHash } from "../lib/session.js";

export const pilotRouter = Router();

export const PilotBody = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(120),
  email: z.string().trim().max(200).email("Please enter a valid email address."),
  phone: z.string().trim().max(40).optional().transform((v) => v || null),
  institution: z.string().trim().min(2, "Please enter your institution's name.").max(200),
  role: z.enum(["teacher", "head_of_department", "administrator", "student", "other"]),
  students: z.enum(["under_100", "100_500", "500_2000", "over_2000"]).optional().nullable(),
  message: z.string().trim().max(2000).optional().transform((v) => v || null),
  website: z.string().max(0).optional(), // honeypot: people never fill it, bots often do
});

pilotRouter.post("/pilot-requests", async (req, res, next) => {
  try {
    const body = PilotBody.safeParse(req.body);
    if (!body.success) throw new PublicError(400, body.error.issues[0]?.message ?? "Please check the form and try again.", "bad_request");
    const ip = ipHash(req);
    await enforce("pilotPerIp", ip);
    const { website: _bot, ...row } = body.data;
    await insert("pilot_requests", [{ ...row, students: row.students ?? null, ip_hash: ip }]);
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});
