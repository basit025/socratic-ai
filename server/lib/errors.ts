/** An error whose message is safe to show to the user. The global handler sends `publicMessage` with `status`. */
export class PublicError extends Error {
  constructor(
    readonly status: number,
    readonly publicMessage: string,
    readonly code?: string,
  ) {
    super(publicMessage);
  }
}

export const unauthorized = () => new PublicError(401, "Your demo session has ended. Start again from the home page.", "no_session");
export const forbidden = () => new PublicError(403, "This page is for a different role.", "wrong_role");
export const notFound = (what = "That item") => new PublicError(404, `${what} wasn't found.`, "not_found");
export const tooMany = (msg: string) => new PublicError(429, msg, "rate_limited");
