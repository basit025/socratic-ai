// Browser smoke test: drives headless Chrome through the landing page, both demo roles and the
// Python runner, fails on any console error, and saves screenshots for a visual check.
// Run against a dev server:  npm run dev   then   npm run smoke:ui -- [baseUrl] [screenshotDir]
import puppeteer, { type Page } from "puppeteer-core";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = process.argv[3] ?? "smoke-screens";
const CHROME = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";
mkdirSync(OUT, { recursive: true });

const problems: string[] = [];
const ok = (msg: string) => console.log(`  ok   ${msg}`);
const fail = (msg: string) => {
  problems.push(msg);
  console.log(`  FAIL ${msg}`);
};

function watch(page: Page, label: string) {
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`[${label}] console error: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`[${label}] page error: ${(e as Error).message}`));
}

const shot = (page: Page, name: string) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
  try {
    // ------------------------------------------------ landing + student
    const ctxS = await browser.createBrowserContext();
    const s = await ctxS.newPage();
    watch(s, "student");
    await s.setViewport({ width: 1440, height: 900 });
    const t0 = Date.now();
    await s.goto(BASE, { waitUntil: "domcontentloaded" });
    await s.waitForSelector("h1");
    ok(`landing rendered in ${Date.now() - t0} ms`);
    await shot(s, "1-landing-1440");
    const h1 = await s.$eval("h1", (e) => e.textContent ?? "");
    h1.includes("understand") ? ok(`landing headline: "${h1}"`) : fail(`unexpected headline: ${h1}`);

    const t1 = Date.now();
    await s.locator("button ::-p-text(Try as student)").click();
    await s.waitForFunction(() => location.pathname === "/student" && document.body.innerText.includes("Assalam"), { timeout: 15000 });
    ok(`"Try as student" → student home in ${Date.now() - t1} ms`);
    await s.waitForFunction(() => document.body.innerText.includes("Cricket Over Tracker"), { timeout: 10000 });
    await shot(s, "2-student-home-1440");
    (await s.$eval("body", (b) => b.innerText.includes("Demo data"))) ? ok("Demo data badge visible") : fail("Demo data badge missing");

    // Python runner (exposed on window in dev builds only)
    const ready = await s.evaluate(async () => {
      const r = (window as unknown as { __runner?: { preload(): Promise<void> } }).__runner;
      if (!r) return "no runner on window (production build?)";
      const t = performance.now();
      await r.preload();
      return `ready in ${Math.round(performance.now() - t)} ms`;
    });
    if (ready.startsWith("no runner")) {
      ok("runner checks skipped (production build; run against `npm run dev` to include them)");
    } else {
      ok(`runner ${ready}`);
      const r1 = await s.evaluate(() => (window as any).__runner.run("total = 0\nfor r in [4, 6, 1]:\n    total += r\nprint(total)"));
      r1.ok && r1.output.trim() === "11" ? ok(`run: printed ${r1.output.trim()} in ${r1.durationMs} ms`) : fail(`run result: ${JSON.stringify(r1)}`);
      const r2 = await s.evaluate(() => (window as any).__runner.run("print(1/0)"));
      !r2.ok && /ZeroDivisionError/.test(r2.error ?? "") && !/pyodide|_pyodide/.test(r2.error) ? ok(`error is clean: ${r2.error.split("\n").at(-1)}`) : fail(`error result: ${JSON.stringify(r2)}`);
      const r3 = await s.evaluate(() => (window as any).__runner.run("x = 1"));
      const r4 = await s.evaluate(() => (window as any).__runner.run("print(x)"));
      !r4.ok && /NameError/.test(r4.error ?? "") && r3.ok ? ok("runs are isolated (no leftover variables)") : fail(`isolation: ${JSON.stringify(r4)}`);
      const t2 = Date.now();
      const r5 = await s.evaluate(() => (window as any).__runner.run("while True:\n    pass"));
      r5.timedOut && Date.now() - t2 < 8000 ? ok(`infinite loop stopped after ${Date.now() - t2} ms, page still responsive`) : fail(`infinite loop: ${JSON.stringify(r5)}`);
      const r6 = await s.evaluate(() => (window as any).__runner.run("print('back')"));
      r6.ok && r6.output.trim() === "back" ? ok("runner recovers after a timeout") : fail(`recovery: ${JSON.stringify(r6)}`);
      const r7 = await s.evaluate(() =>
        (window as any).__runner.runTests(
          "def over_summary(balls):\n    t=0\n    b=0\n    for r in balls:\n        t+=r\n        if r>=4: b+=1\n    return (t,b)",
          ["over_summary([1, 4, 0, 6, 2, 1])", "over_summary([])", "over_summary(None)"],
        ),
      );
      const reprs = r7.results?.map((x: { repr?: string; error?: string }) => x.repr ?? `error: ${x.error}`);
      reprs?.[0] === "(14, 2)" && reprs?.[1] === "(0, 0)" && reprs?.[2]?.startsWith("error") ? ok(`hidden-test calls → ${JSON.stringify(reprs)}`) : fail(`tests: ${JSON.stringify(r7)}`);
    }

    // ------------------------------------------------ workspace: a real student session
    await s.goto(`${BASE}/student`, { waitUntil: "domcontentloaded" });
    await s.waitForFunction(() => document.body.innerText.includes("Open assignment") || document.body.innerText.includes("Continue assignment"), { timeout: 15000 });
    await s.locator("a ::-p-text(assignment)").click();
    await s.waitForSelector(".cm-content", { timeout: 20000 });
    ok("workspace opened with the code editor");
    (await s.$eval("nav[aria-label='Your progress on this assignment']", (n) => (n as HTMLElement).innerText.includes("Submit + viva"))) ? ok("journey stepper visible") : fail("stepper missing");
    await s.click(".cm-content");
    await s.keyboard.down("Control");
    await s.keyboard.press("a");
    await s.keyboard.up("Control");
    await s.keyboard.type("over_summary = lambda balls: (sum(balls), len([r for r in balls if r >= 6]))\nprint(over_summary([1, 4, 0, 6, 2, 1]))", { delay: 5 });
    const typed = await s.$eval(".cm-content", (e) => (e as HTMLElement).innerText);
    typed.includes("lambda balls") ? ok("typing recorded in the editor") : fail(`editor text: ${typed.slice(0, 80)}`);
    await s.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData("text/plain", "print('pasted from ChatGPT')");
      document.querySelector(".cm-content")!.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await s.waitForFunction(() => document.body.innerText.includes("Paste is off for this assignment"), { timeout: 5000 });
    (await s.$eval(".cm-content", (e) => (e as HTMLElement).innerText.includes("pasted from ChatGPT"))) ? fail("paste got through") : ok("paste blocked, with an inline explanation");
    await s.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent?.includes("Run my code") && !b.disabled), { timeout: 30000 });
    await s.locator("button ::-p-text(Run my code)").click();
    await s.waitForFunction(() => document.body.innerText.includes("(14, 1)"), { timeout: 15000 });
    ok("Run my code → output (14, 1)");
    await s.waitForFunction(() => /Saved (just now|\d+ s ago)/.test(document.body.innerText), { timeout: 15000 });
    ok("autosaved");
    await shot(s, "6-workspace-1440");
    await s.reload({ waitUntil: "domcontentloaded" });
    await s.waitForSelector(".cm-content", { timeout: 20000 });
    (await s.$eval(".cm-content", (e) => (e as HTMLElement).innerText.includes("lambda balls"))) ? ok("work survives a page reload") : fail("work lost on reload");
    await s.type("#ustaad-input", "Why does my code print 14 for the total?");
    await s.keyboard.press("Enter");
    const t4 = Date.now();
    await s.waitForFunction(() => [...document.querySelectorAll("p")].filter((p) => p.textContent === "Ustaad").length >= 1, { timeout: 40000 });
    ok(`Ustaad replied in ${Date.now() - t4} ms`);
    await s.setViewport({ width: 1920, height: 1080 });
    await shot(s, "7-workspace-ustaad-1920");
    await s.goto(`${BASE}/student`, { waitUntil: "domcontentloaded" });
    await s.waitForFunction(() => document.body.innerText.includes("In progress"), { timeout: 10000 });
    ok('student home now shows "In progress"');

    // ------------------------------------------------ submit → hidden tests → viva → results
    await s.locator("a ::-p-text(Continue assignment)").click();
    await s.waitForSelector(".cm-content", { timeout: 20000 });
    await s.locator("button ::-p-text(Submit (you can't edit after this))").click();
    await s.waitForSelector("[role=dialog]");
    ok("submit asks for confirmation and previews the viva");
    await shot(s, "8-submit-dialog");
    await s.locator("[role=dialog] button ::-p-text(Submit and start the viva)").click();
    await s.waitForFunction(() => location.pathname.endsWith("/viva") && document.body.innerText.includes("Start viva"), { timeout: 40000 });
    const testsChip = await s.$eval("body", (b) => /Hidden tests: (\d+)\/(\d+) passed/.exec(b.innerText)?.[0] ?? "none");
    ok(`hidden tests ran in the browser and were marked on the server: ${testsChip}`);
    await shot(s, "9-viva-intro");
    await s.locator("button ::-p-text(Start viva)").click();
    for (let i = 0; i < 3; i++) {
      await s.waitForSelector("#viva-answer:not([disabled])", { timeout: 40000 });
      await s.waitForFunction((n) => document.body.innerText.includes(`Question ${n} of 3`), { timeout: 40000 }, i + 1);
      if (i === 0) await shot(s, "10-viva-question");
      await s.type("#viva-answer", "It adds every ball's runs to the total, and counts a big hit when the runs are at least the boundary.");
      await s.locator(`button ::-p-text(${i === 2 ? "Finish viva" : "Next question"})`).click();
    }
    await s.waitForFunction(() => document.body.innerText.includes("Submitted. Well done"), { timeout: 60000 });
    const score = await s.$eval("body", (b) => /Viva score\s*(\S+)/.exec(b.innerText)?.[1] ?? "?");
    ok(`viva finished; results screen shows viva score ${score}`);
    await shot(s, "11-viva-results");

    await s.setViewport({ width: 390, height: 844, isMobile: true });
    await s.waitForFunction(() => document.body.innerText.includes("Cricket Over Tracker"), { timeout: 10000 });
    await shot(s, "3-student-home-mobile");

    // ------------------------------------------------ teacher (separate cookie jar)
    const ctxT = await browser.createBrowserContext();
    const t = await ctxT.newPage();
    watch(t, "teacher");
    await t.setViewport({ width: 1920, height: 1080 });
    await t.goto(BASE, { waitUntil: "domcontentloaded" });
    await t.waitForSelector("h1");
    await shot(t, "4-landing-1920");
    const t3 = Date.now();
    await t.locator("button ::-p-text(Try as teacher)").click();
    await t.waitForFunction(() => location.pathname === "/teacher" && document.body.innerText.includes("Cricket Over Tracker"), { timeout: 15000 });
    ok(`"Try as teacher" → teacher home in ${Date.now() - t3} ms`);
    await shot(t, "5-teacher-home-1920");

    // a student can't open teacher pages
    await s.setViewport({ width: 1440, height: 900 });
    await s.goto(`${BASE}/teacher`, { waitUntil: "domcontentloaded" });
    await s.waitForFunction(() => location.pathname !== "/teacher", { timeout: 10000 }).catch(() => {});
    new URL(s.url()).pathname === "/student" ? ok("student sent away from /teacher") : fail(`student reached ${s.url()}`);

    await t.goto(`${BASE}/no-such-page`, { waitUntil: "domcontentloaded" });
    await t.waitForSelector("h1, p", { timeout: 10000 });
    await t.waitForFunction(() => document.body.innerText.length > 20);
    (await t.$eval("body", (b) => b.innerText.includes("doesn't exist"))) ? ok("404 page") : fail("404 page missing");
  } finally {
    await browser.close();
  }

  const realProblems = problems.filter((p) => !p.includes("401")); // /api/me 401 before sign-in is expected
  if (realProblems.length) {
    console.log(`\n${realProblems.length} problem(s):\n${realProblems.map((p) => `  - ${p}`).join("\n")}`);
    process.exit(1);
  }
  console.log(`\nAll checks passed. Screenshots in ${OUT}/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
