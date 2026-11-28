/**
 * The teacher's own slide decks (see scripts/lecture-slides.ts). Pages live in the PRIVATE "lecture-slides"
 * bucket; the browser only ever gets short-lived signed links, and only after the API has checked that the
 * caller teaches or takes the course. Each page's text comes along so Ustaad can explain the slide on screen.
 */
import { LECTURE_DECKS, type LectureDeck } from "./lectureDecks.js";

const BUCKET = "lecture-slides";
const LINK_SECONDS = 4 * 60 * 60;
const CACHE_MS = 3 * 60 * 60 * 1000; // reuse links for 3 h (they last 4 h), so the browser can cache the images

export interface SlidePage {
  url: string;
  text: string;
}

/** The deck for a course's lecture, if the teacher has added one. */
export function deckFor(courseCode: string, week: number): LectureDeck | null {
  return LECTURE_DECKS[courseCode]?.[week] ?? null;
}

function config() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Storage is not configured.");
  return { url: url.replace(/\/$/, ""), key };
}

export const pagePath = (deck: LectureDeck, n: number) => `${deck.dir}/${String(n).padStart(3, "0")}.webp`;

const cache = new Map<string, { at: number; pages: SlidePage[] }>();

export async function deckPages(deck: LectureDeck, now = Date.now()): Promise<SlidePage[]> {
  const hit = cache.get(deck.dir);
  if (hit && now - hit.at < CACHE_MS) return hit.pages;
  const { url, key } = config();
  const auth = { Authorization: `Bearer ${key}`, apikey: key };
  const paths = Array.from({ length: deck.count }, (_, i) => pagePath(deck, i + 1));
  const [signed, texts] = await Promise.all([
    fetch(`${url}/storage/v1/object/sign/${BUCKET}`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: LINK_SECONDS, paths }),
      signal: AbortSignal.timeout(10_000),
    }),
    fetch(`${url}/storage/v1/object/${BUCKET}/${deck.dir}/text.json`, { headers: auth, signal: AbortSignal.timeout(10_000) }),
  ]);
  if (!signed.ok) throw new Error(`signing slide links failed: ${signed.status}`);
  const links = (await signed.json()) as { path: string; signedURL?: string | null; error?: string | null }[];
  const words = texts.ok ? ((await texts.json()) as unknown) : [];
  const textList = Array.isArray(words) ? words.map((w) => (typeof w === "string" ? w : "")) : [];
  const byPath = new Map(links.map((l) => [l.path, l.signedURL]));
  const pages = paths.map((p, i) => {
    const s = byPath.get(p);
    if (!s) throw new Error(`no signed link for ${p}`);
    return { url: `${url}/storage/v1${s}`, text: textList[i] ?? "" };
  });
  cache.set(deck.dir, { at: now, pages });
  return pages;
}
