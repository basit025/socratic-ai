/**
 * Puts a course's own lecture slides into the platform, so a lecture opens with the teacher's real deck.
 * Run by an operator on a machine that has the slides (lecture-material/, git-ignored) and LibreOffice,
 * poppler (pdftoppm, pdftotext, pdfunite, pdfinfo) and ImageMagick:
 *
 *   npx tsx scripts/lecture-slides.ts                 # preview project
 *   npx tsx scripts/lecture-slides.ts --production    # production project
 *   npx tsx scripts/lecture-slides.ts --convert-only  # rebuild the images locally, upload nothing
 *
 * Each lecture becomes WebP page images plus a text.json (each page's words, for Ustaad) in the PRIVATE
 * "lecture-slides" bucket, under CODE/wNN-<hash>/. The hash changes when the deck changes, so cached
 * images never go stale. Only the folder name and page count are committed (server/lib/lectureDecks.ts);
 * the slides themselves never enter git. The service key comes from the Supabase CLI (`npx supabase login`)
 * and is never printed.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { REFS, type Target } from "../server/seed/supabaseCli.js";

const BUCKET = "lecture-slides";
const SOURCE = "lecture-material";
const WORK = path.join(tmpdir(), "socratic-lecture-slides");
const MANIFEST = "server/lib/lectureDecks.ts";
const WIDTH = 1600; // px, long side; sharp on a 1080p screen, about 60-120 KB per page as WebP

/** Which files make up each week's deck. A token matches one file in the course's slides folder. */
const COURSES: { code: string; dir: string; weeks: Record<number, string[]> }[] = [
  {
    code: "CS-341",
    dir: "data mining/slides",
    weeks: { 1: ["Topic_01"], 2: ["Topic_02"], 3: ["Topic_03"], 4: ["Topic_04"], 5: ["Topic_05"], 6: ["Topic_06"], 7: ["Topic_07"], 8: ["Topic_08"] },
  },
  {
    code: "CS-201",
    dir: "dsa/slides",
    weeks: {
      1: ["Module_02.1", "Module_02.2", "Module_02.3"],
      2: ["Module_03.1", "Module_03.2"],
      3: ["Module_03.3"],
      4: ["Module_04.1", "Module_04.2"],
      5: ["Module_05.1", "Module_05.2", "Module_05.3"],
      6: ["Module_06.1"],
      7: ["Module_06.2", "Module_06.3", "Module_06.4", "Module_06.5", "Module_06.6"],
      8: ["Module_07.1", "Module_07.2", "Module_07.3"],
      9: ["Module_07.4", "Module_07.5"],
    },
  },
];

function run(cmd: string, args: string[], opts: { cwd?: string } = {}): string {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${(r.stderr || r.stdout || "").slice(-600)}`);
  return r.stdout;
}

function findFile(dir: string, token: string): string {
  const hits = readdirSync(dir).filter((f) => [" ", "_", "("].some((sep) => f.includes(token + sep)));
  if (hits.length !== 1) throw new Error(`${dir}: expected one file for "${token}", found ${hits.length}`);
  return path.join(dir, hits[0]!);
}

/** A PDF for one source file (PowerPoint is converted once and cached). */
function toPdf(file: string): string {
  if (file.toLowerCase().endsWith(".pdf")) return file;
  const out = path.join(WORK, "pdf");
  mkdirSync(out, { recursive: true });
  const pdf = path.join(out, path.basename(file).replace(/\.[^.]+$/, ".pdf"));
  if (!existsSync(pdf)) run("soffice", ["--headless", "--convert-to", "pdf", "--outdir", out, file]);
  return pdf;
}

// Strips private-use glyphs (PowerPoint bullet symbols) and squeezes whitespace.
const clean = (t: string) => t.replace(/[\uE000-\uF8FF]/g, "").replace(/\f/g, " ").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim().slice(0, 1500);

interface Built { code: string; week: number; dir: string; folder: string; count: number }

function buildWeek(code: string, sourceDir: string, week: number, tokens: string[]): Built {
  const pdfs = tokens.map((t) => toPdf(findFile(sourceDir, t)));
  const hash = createHash("sha256");
  for (const p of pdfs) hash.update(readFileSync(p));
  const dir = `${code}/w${String(week).padStart(2, "0")}-${hash.digest("hex").slice(0, 8)}`;
  const folder = path.join(WORK, "out", dir);
  if (existsSync(path.join(folder, "text.json"))) {
    const count = (JSON.parse(readFileSync(path.join(folder, "text.json"), "utf8")) as string[]).length;
    return { code, week, dir, folder, count };
  }
  mkdirSync(folder, { recursive: true });
  let deck = pdfs[0]!;
  if (pdfs.length > 1) {
    deck = path.join(folder, "deck.pdf");
    run("pdfunite", [...pdfs, deck]);
  }
  const count = Number(/Pages:\s+(\d+)/.exec(run("pdfinfo", [deck]))?.[1] ?? 0);
  if (!count) throw new Error(`${dir}: no pages`);
  run("pdftoppm", ["-png", "-scale-to", String(WIDTH), deck, path.join(folder, "p")]);
  run("mogrify", ["-format", "webp", "-quality", "78", "-strip", "p-*.png"], { cwd: folder });
  // pdftoppm pads page numbers to the deck's width (p-1, p-01, p-001); rename to 001.webp, 002.webp, ...
  for (const f of readdirSync(folder).filter((f) => /^p-\d+\.webp$/.test(f))) {
    const n = Number(/\d+/.exec(f)![0]);
    run("mv", [path.join(folder, f), path.join(folder, `${String(n).padStart(3, "0")}.webp`)]);
  }
  run("sh", ["-c", "rm -f p-*.png"], { cwd: folder });
  const texts = Array.from({ length: count }, (_, i) => clean(run("pdftotext", ["-f", String(i + 1), "-l", String(i + 1), deck, "-"])));
  writeFileSync(path.join(folder, "text.json"), JSON.stringify(texts));
  console.log(`  ${dir}: ${count} pages`);
  return { code, week, dir, folder, count };
}

function serviceKey(target: Target): { url: string; key: string } {
  const out = run("npx", ["supabase", "projects", "api-keys", "--project-ref", REFS[target], "-o", "json"]);
  const key = (JSON.parse(out.slice(out.indexOf("["))) as { name: string; api_key: string }[]).find((k) => k.name === "service_role")?.api_key;
  if (!key) throw new Error(`No service_role key found for ${target}`);
  return { url: `https://${REFS[target]}.supabase.co`, key };
}

async function ensureBucket(url: string, key: string) {
  const h = { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" };
  const got = await fetch(`${url}/storage/v1/bucket/${BUCKET}`, { headers: h });
  if (got.ok) return;
  const made = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false, file_size_limit: 2 * 1024 * 1024, allowed_mime_types: ["image/webp", "application/json"] }),
  });
  if (!made.ok) throw new Error(`Could not create the bucket: ${made.status} ${(await made.text()).slice(0, 200)}`);
  console.log(`created private bucket "${BUCKET}"`);
}

async function upload(url: string, key: string, b: Built) {
  const files = readdirSync(b.folder).filter((f) => /^\d{3}\.webp$/.test(f) || f === "text.json");
  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      const f = files[next++]!;
      for (let attempt = 1; ; attempt++) {
        const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${b.dir}/${f}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            apikey: key,
            "Content-Type": f.endsWith(".json") ? "application/json" : "image/webp",
            "cache-control": "max-age=31536000",
            "x-upsert": "true",
          },
          body: readFileSync(path.join(b.folder, f)),
        });
        if (res.ok) break;
        if (attempt >= 3) throw new Error(`upload ${b.dir}/${f} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  console.log(`  uploaded ${b.dir} (${files.length} files)`);
}

function writeManifest(built: Built[]) {
  const decks: Record<string, Record<number, { dir: string; count: number }>> = {};
  for (const b of built) (decks[b.code] ??= {})[b.week] = { dir: b.dir, count: b.count };
  writeFileSync(
    MANIFEST,
    `/**
 * Which lectures have the teacher's own slide deck, and where its pages live in the private "lecture-slides"
 * bucket (CODE/wNN-<hash>/001.webp ... and text.json). Generated by scripts/lecture-slides.ts: don't edit by hand.
 */
export interface LectureDeck {
  dir: string;
  count: number;
}

export const LECTURE_DECKS: Record<string, Record<number, LectureDeck>> = ${JSON.stringify(decks, null, 2)};
`,
  );
  console.log(`wrote ${MANIFEST}`);
}

(async () => {
  const args = process.argv.slice(2);
  const target: Target = args.includes("--production") ? "production" : "preview";
  const convertOnly = args.includes("--convert-only");
  const built: Built[] = [];
  for (const c of COURSES) {
    console.log(`${c.code}: converting`);
    for (const [week, tokens] of Object.entries(c.weeks)) built.push(buildWeek(c.code, path.join(SOURCE, c.dir), Number(week), tokens));
  }
  if (!convertOnly) {
    const { url, key } = serviceKey(target);
    console.log(`uploading to ${target}`);
    await ensureBucket(url, key);
    for (const b of built) await upload(url, key, b);
  }
  writeManifest(built);
  const pages = built.reduce((n, b) => n + b.count, 0);
  console.log(`done: ${built.length} lectures, ${pages} pages${convertOnly ? " (not uploaded)" : ` on ${target}`}`);
})().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
