/** One canonical text form for JavaScript values: used by the browser runner AND the seed, so expected and actual always match. */
export function repr(v: unknown): string {
  if (typeof v === "string") return JSON.stringify(v);
  if (v === undefined) return "undefined";
  if (typeof v === "number" || typeof v === "boolean" || v === null || typeof v === "bigint") return String(v);
  if (typeof v === "function") return "[function]";
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
