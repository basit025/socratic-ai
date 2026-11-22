import type { NextFunction, Request, Response } from "express";
import { forbidden, unauthorized } from "./errors.js";
import { getSession, type Session } from "./session.js";

declare module "express-serve-static-core" {
  interface Request {
    session?: Session;
  }
}

/** Requires a valid session (optionally a specific role) and attaches it as req.session. */
export function requireSession(role?: Session["role"]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const s = getSession(req);
    if (!s) return next(unauthorized());
    if (role && s.role !== role) return next(forbidden());
    req.session = s;
    next();
  };
}
