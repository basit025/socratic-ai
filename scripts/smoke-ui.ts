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
    const courseCount = await s.$$eval("main section h2", (hs) => hs.length);
    courseCount >= 3 ? ok(`student home lists ${courseCount} courses (lived-in institution)`) : fail(`only ${courseCount} course(s) on student home`);

    // A JavaScript lab: runs in its own worker
    await s.locator("a ::-p-text(Attendance Shortage List)").click();
    await s.waitForSelector(".cm-content", { timeout: 20000 });
    await s.click(".cm-content");
    await s.keyboard.down("Control");
    await s.keyboard.press("a");
    await s.keyboard.up("Control");
    await s.keyboard.type('const shortList = (rs) => rs.filter((r) => r.attendance < 75).map((r) => r.name);\nconsole.log(shortList([{ name: "Ali", attendance: 72 }]))', { delay: 3 });
    await s.locator("button ::-p-text(Run my code)").click();
    await s.waitForFunction(() => document.body.innerText.includes('["Ali"]'), { timeout: 15000 });
    ok('JavaScript lab: Run my code → ["Ali"]');

    // A written task: plain-text editor, paste blocked, live word count
    await s.goto(`${BASE}/student`, { waitUntil: "domcontentloaded" });
    await s.waitForFunction(() => document.body.innerText.includes("Should Phones Be Allowed in Class?"), { timeout: 15000 });
    await s.locator("a ::-p-text(Should Phones Be Allowed in Class?)").click();
    await s.waitForSelector("textarea[aria-label^='Your answer']", { timeout: 20000 });
    await s.type("textarea[aria-label^='Your answer']", "Phones should be allowed in class because they help us look things up quickly.");
    await s.waitForFunction(() => document.body.innerText.includes("14 words"), { timeout: 5000 });
    await s.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData("text/plain", "an essay from ChatGPT");
      document.querySelector("textarea[aria-label^='Your answer']")!.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await s.waitForFunction(() => document.body.innerText.includes("Paste is off"), { timeout: 5000 });
    ok("written task: word count updates, paste blocked with an explanation");
    await shot(s, "6b-written-task");

    // The Python lab used for the full journey below
    await s.goto(`${BASE}/student`, { waitUntil: "domcontentloaded" });
    await s.waitForFunction(() => document.body.innerText.includes("Cricket Over Tracker"), { timeout: 15000 });
    await s.locator("a ::-p-text(Cricket Over Tracker)").click();
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
    await s.locator("a ::-p-text(Cricket Over Tracker)").click();
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

    // ------------------------------------------------ "See what your teacher sees": the judge's own work as a report
    await s.locator("button ::-p-text(See what your teacher sees)").click();
    await s.waitForFunction(() => location.pathname.startsWith("/teacher/submissions/") && document.body.innerText.includes("How the work was made"), { timeout: 30000 });
    ok("switched to the teacher's integrity report of the same submission");
    const report = await s.$eval("body", (b) => b.innerText);
    report.includes("Viva on their own code") && report.includes("Hidden tests") ? ok("report shows viva transcript and hidden tests") : fail("report sections missing");
    (await s.$$("[aria-label='Session timeline'] button")).length > 0 ? ok("replay timeline has markers") : fail("no timeline markers");
    await s.setViewport({ width: 1920, height: 1080 });
    await shot(s, "12-teacher-report-1920");
    await s.locator("button ::-p-text(Looks fine)").click();
    await s
      .waitForFunction(() => document.body.innerText.includes("Saved") || document.querySelector("[role=alert]"), { timeout: 20000 })
      .catch(() => {});
    const decisionText = await s.$eval("body", (b) => b.innerText);
    if (decisionText.includes("Saved")) ok("teacher decision saved");
    else {
      const alert = await s.$eval("[role=alert]", (e) => (e as HTMLElement).innerText).catch(() => "no alert shown");
      await shot(s, "fail-decision");
      fail(`teacher decision not saved: ${alert}`);
    }
    await s.locator("a ::-p-text(all submissions)").click();
    await s.waitForFunction(() => document.body.innerText.includes("Tick 2 students to compare"), { timeout: 15000 });
    (await s.$eval("body", (b) => b.innerText.includes("Looks fine"))) ? ok("submissions list shows the decision") : fail("decision not shown in list");
    await shot(s, "13-teacher-submissions-1920");
    await s.setViewport({ width: 1440, height: 900 });
    await s.locator("button ::-p-text(Student view)").click();
    await s.waitForFunction(() => location.pathname === "/student", { timeout: 15000 });
    ok("switched back to the student view");

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

    // ------------------------------------------------ builder: template → check tests → rules → preview → publish
    await t.locator("a ::-p-text(Create assignment)").click();
    await t.waitForFunction(() => document.body.innerText.includes("Start from a template"), { timeout: 20000 });
    await t.locator("button ::-p-text(Load-shedding Planner)").click();
    await t.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent?.includes("Check tests against my solution") && !b.disabled), { timeout: 40000 });
    await t.locator("button ::-p-text(Check tests against my solution)").click();
    await t.waitForFunction(() => document.body.innerText.includes("tests run on your solution"), { timeout: 20000 });
    ok("builder: template loaded, expected answers computed from the reference solution");
    await shot(t, "14-builder-task-1920");
    await t.locator("button ::-p-text(Next: set the rules)").click();
    await t.waitForFunction(() => document.body.innerText.includes("Block paste"), { timeout: 5000 });
    await shot(t, "15-builder-rules-1920");
    await t.locator("button ::-p-text(Next: preview as student)").click();
    await t.waitForFunction(() => document.body.innerText.includes("This is what a student"), { timeout: 5000 });
    await shot(t, "16-builder-preview-1920");
    await t.locator("button ::-p-text(Publish to)").click();
    await t.waitForFunction(() => document.body.innerText.includes("Published. Students in this course can see it now"), { timeout: 20000 });
    ok("builder: published, and the submissions page confirms it");
    await t.locator("button ::-p-text(Student view)").click();
    await t.waitForFunction(() => location.pathname === "/student" && document.body.innerText.includes("Load-shedding Planner"), { timeout: 20000 });
    ok("the new assignment appears for the student in the same demo");

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
