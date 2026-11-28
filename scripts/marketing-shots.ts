/**
 * Real product screenshots for the landing page (client/public/screens/*.webp), taken from a running
 * build with the demo data. Re-run after UI changes:  npx tsx scripts/marketing-shots.ts http://localhost:3000
 * Uses the AI once (a tutor reply on a lecture), so the shot shows a real answer.
 */
import { mkdirSync } from "node:fs";
import puppeteer, { type Page } from "puppeteer-core";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = process.argv[3] ?? "client/public/screens";
mkdirSync(OUT, { recursive: true });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function shot(p: Page, name: string) {
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => window.scrollTo(0, 0));
  await wait(400);
  await p.screenshot({ path: `${OUT}/${name}.webp`, type: "webp", quality: 82 });
  console.log("saved", name);
}

(async () => {
  // CHROME_PATH lets it run on Windows or macOS, e.g. "C:\Program Files\Google\Chrome\Application\chrome.exe".
  const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
  try {
    // ---------------- student
    const s = await b.newPage();
    await s.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await s.goto(BASE, { waitUntil: "domcontentloaded" });
    await s.locator("button ::-p-text(Try as student)").click();
    await s.waitForFunction(() => location.pathname === "/student" && document.querySelectorAll("nav a[href^='/student/courses/']").length > 0, { timeout: 60000 });
    await wait(800);
    await shot(s, "student-home");

    const course = await s.$$eval("nav a[href^='/student/courses/']", (as) => (as.find((a) => a.textContent?.includes("Programming Fundamentals")) as HTMLAnchorElement).href);
    await s.goto(`${course}/lectures/2`, { waitUntil: "domcontentloaded" });
    await s.waitForSelector("section[aria-label='Study with Ustaad']", { timeout: 20000 });
    await s.locator("section[aria-label='Study with Ustaad'] button ::-p-text(Give me a real-life example)").click();
    await s.waitForFunction(() => (document.querySelector("section[aria-label='Study with Ustaad']")?.querySelectorAll(".rounded-tl-md").length ?? 0) >= 1, { timeout: 45000 });
    await wait(600);
    await shot(s, "lecture-ustaad");

    await s.goto(`${course}/assignments`, { waitUntil: "domcontentloaded" });
    await s.waitForSelector("nav[aria-label='Course sections']", { timeout: 20000 });
    await wait(800);
    await shot(s, "course-assignments");

    // ---------------- teacher
    const t = await b.newPage();
    const ctx = await b.createBrowserContext();
    const tp = await ctx.newPage();
    await t.close();
    await tp.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await tp.goto(BASE, { waitUntil: "domcontentloaded" });
    await tp.locator("button ::-p-text(Try as teacher)").click();
    await tp.waitForFunction(() => location.pathname === "/teacher" && document.body.innerText.includes("Cricket Over Tracker"), { timeout: 60000 });
    await wait(800);
    await shot(tp, "teacher-home");
    await tp.locator("a ::-p-text(Cricket Over Tracker)").click();
    await tp.waitForSelector("a[href^='/teacher/submissions/']", { timeout: 20000 });
    await wait(600);
    await shot(tp, "teacher-submissions");
    const reports = await tp.$$eval("a[href^='/teacher/submissions/']", (as) => as.map((a) => (a as HTMLAnchorElement).href));
    await tp.goto(reports[1] ?? reports[0]!, { waitUntil: "domcontentloaded" });
    await tp.waitForFunction(() => document.body.innerText.includes("How the work was made"), { timeout: 20000 });
    await wait(1000);
    await shot(tp, "teacher-report");
  } finally {
    await b.close();
  }
})();
