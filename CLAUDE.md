# CLAUDE.md: Socratic AI

Socratic AI: **Strong Fundamentals in the Age of AI.** A web-based learning platform for Pakistani universities and colleges where students do assignments, coding labs and quizzes in one workspace. The workspace records how the work was made, and the AI mentor **Ustaad** runs a short, timed viva on the student's own work. Teachers get an integrity report (work, process replay, flags, viva score).

Built for the **Capital Youth Expo 2026 Hackathon (04-HK), Track 1: Education.** The full spec is in `docs/proposal.md`; it is the source of truth. If code and the proposal disagree, ask before choosing.

## Hard rules (break one = disqualification or lost points)

- **Originality:** all core logic is written between **Nov 16 and Nov 28, 2026**. No pasting in pre-built projects or cloned products. Commit small and often; the history is our evidence.
- **Disclosure:** every external API, model, library and UI kit goes in `README.md` (section "Third-party APIs and libraries"). Update it in the same commit that adds a dependency.
- **Freeze:** our feature freeze is **Thursday Nov 26, end of day**. Official freeze is the deadline (Nov 28, 11:59 PM PKT); after that only minor environment/config fixes are allowed. Fri–Sat are for video, deck and submission only.
- **Never fabricate:** no invented metrics, quotes or "users". Seeded content shows a visible **"Demo data"** badge.
- **Secrets:** API keys live only in Vercel (type Secret) and in each developer's git-ignored `.env.local`; operator-only values in git-ignored `.env.ops`. Never commit `.env*` files (except `.env.example`), never print a key in logs or tool output, never pass one in a URL query string.
  - Two automatic guards: the **pre-commit hook** (`scripts/check-secrets.sh`, installed by `npm install` via `core.hooksPath=.githooks`) blocks env files and key-shaped strings; **GitHub push protection** is on for the repo. Never bypass with `--no-verify` except for a proven false positive.
  - Only `VITE_`-prefixed variables reach the browser bundle; none of them may hold a secret.
- **No AI-text detection, no webcam, no automatic penalties.** Flags are evidence for the teacher, never verdicts.

## Judging criteria (25% each): build so each is visible

1. **Innovation:** verify learning (process + viva), don't detect AI.
2. **Technical execution:** the live link works end to end, is stable, and integrates AI properly.
3. **Impact and viability:** real teachers' problem; HEC-aligned; cheap to run.
4. **Presentation and UI/UX:** understandable at first look; a demo that tells a story.

## The demo path: must always work

1. Teacher creates "Cricket Over Tracker" with paste blocked, run-first, a 3-question viva and variants on.
2. Honest student: types, runs, hits an error, fixes it, submits, passes the viva.
3. Cheating student: paste is blocked, retypes from a phone, submits a perfect answer, fails the viva.
4. Teacher: side-by-side reports with replays, flags and viva scores.

Before any merge that touches these flows, run through the path manually on the deployed build.

## Scope (in priority order)

**MVP (team decision, Nov 23: keep the full proposal scope), built in this priority order:**
1. **Demo path first:** accounts and roles; courses and join codes; assignment builder with integrity rules and per-student variants; code workspace (Python via Pyodide, JS and HTML in a sandboxed iframe); paste/copy/drag blocking; process event logging; Ustaad hints; automated viva with rubric scoring; hidden tests; integrity report with replay and rule-based flags; gradebook; student results; seed script with demo data; one-click demo logins.
2. **Then:** written answers (FR-10); timed quizzes with fullscreen tracking (FR-13, FR-16); handwritten capture with code word + AI reading (FR-11, FR-12).

**Rules for priority 2:** work starts only after the demo path runs end to end on the live link. Each feature stays behind a feature flag (off in production) until it works end to end, so a half-built feature never shows a judge a dead end. **Tripwire (from the proposal):** if the viva isn't working by Wednesday night, priority-2 features stay off for the demo; Friday is never used for feature work.
**Canonical facts (use exactly these everywhere: README, GitHub About, page metadata, video, deck):**
- Name and tagline: **Socratic AI: Strong Fundamentals in the Age of AI**
- One-line description: "A learning platform where students do their work in one workspace and the AI mentor Ustaad runs a short viva on each student's own work, so marks reflect what they understand."
- Live URL: **https://socratic-ai-pk.vercel.app** · Repo: **https://github.com/basit025/socratic-ai**
- Event: Capital Youth Expo 2026 Hackathon (04-HK), Track 1: Education
- Pitch line: "We can't stop a student from asking AI. We make sure they can't get marks for work they don't understand."
If any of these change, update all of the places above in the same commit (GitHub About via `gh api -X PATCH repos/basit025/socratic-ai`).

**Naming:** in the UI, README, video and deck, call it a **"learning platform"** (or "web platform"). Never call it a "portal", and never call it an "app" unless the installable PWA ships.
**If time allows:** installable PWA (web manifest + icons, so students can use "Add to Home screen" on Android; no offline mode needed); voice viva.
**Out of scope:** native Android/iOS app, public API for other LMSs (roadmap only), webcam proctoring, AI-text detectors, LMS export, Safe Exam Browser, admin role, payments.

## Stack and structure

- Front end: React 19 + Vite + TypeScript (strict) + Tailwind 4 + shadcn/ui (Radix). Editor: CodeMirror or Monaco with paste interception.
- Back end: Express (Node, TypeScript). Database, auth and storage: Supabase (Postgres).
- AI: `server/llm.ts` is the **only** module that calls a model.
  - **Fallback chain: Gemini → Groq → OpenRouter.** Primary: Google Gemini `gemini-3.1-flash-lite`. Backup 1: Groq `openai/gpt-oss-120b` (also Whisper for the voice viva). Backup 2: OpenRouter, model set by `OPENROUTER_MODEL` (must support structured outputs).
  - `LLM_PROVIDER` picks the first provider. On a 429, 5xx or timeout: retry once, then move to the next configured provider in the chain; a provider that returned 429, a repeated 5xx or a timeout is skipped for 60 s (if every provider is cooling down, all are tried anyway). Providers with no key are skipped.
  - **Key policy:** one account per provider per environment (Production = R1's accounts, Preview = one teammate's accounts, local = each developer's own accounts). Never rotate keys from several accounts of the same provider to multiply free quota: it breaks the providers' terms (Google's API terms forbid circumventing limits) and risks a ban during judging. If quota runs short, add paid credit instead.
  - All model output uses structured JSON validated against a schema (zod); on invalid JSON, retry once, then show a friendly error. Never crash the workspace.
  - Separate keys for development and demo (`GEMINI_API_KEY`, `GROQ_API_KEY`, set per environment). Gemini's free daily quota resets at midnight Pacific = **1 PM PKT**.
- Deploy: **one Vercel project (Hobby) + Supabase (free)**. See "Deployment" below. **Never use Render's free tier** (it sleeps after 15 min and takes about a minute to wake).

```
/api/index.ts    Vercel Function entry: re-exports the Express app (nothing else lives here)
/client          Vite + React app (index.html, src/, public/); builds to client/dist
/server          Express API: app.ts (exported, never listens), routes/, lib/, llm.ts, integrity/, viva/
/server/dev.ts   local only: mounts the API + Vite dev server on :3000
/server/seed     seed.ts + content/ (courses, assignments, recorded event logs)
/docs            proposal.md, design notes, pitch assets
vercel.json      build, rewrites, region, cron
```

- Server imports use NodeNext style with `.js` extensions (`import x from "./lib/health.js"`), which tsx and Vercel both resolve to the `.ts` file.
- Keep **TypeScript on 5.x**: Vercel's function builder uses the JS compiler API that TypeScript 7 (native) does not ship.

## Deployment

**Hosting:** one Vercel project on the free Hobby plan, plus Supabase on the free plan. Production URL: `https://socratic-ai-pk.vercel.app` is the only URL used in the README, video and deck.

- **Front end:** Vercel builds the Vite app (`npm run build` → `client/dist`) and serves it from its CDN. `express.static()` is never used in production.
- **API:** the Express app in `server/app.ts` is exported (`export default app`), never started with `app.listen()`. `api/index.ts` re-exports it as **one Vercel Function**; `vercel.json` rewrites `/api/(.*)` to it, and Express routes on the original path (`/api/health`, ...). All other paths fall back to `index.html` (SPA).
- **Region:** functions run in `bom1` (Mumbai). Create both Supabase projects in **South Asia (Mumbai)** so each API→DB round-trip stays short.
- **Database and auth:** Supabase Postgres + Auth. Two Supabase projects, both Mumbai (`ap-south-1`): **production** `socratic-ai-prod` (ref `szenspgxfjrynhtwhixm`, demo data the judges see) and **preview** `socratic-ai-preview` (ref `eksckojfihwirwdgdrfc`, PR previews and local work). A preview build must never write to the production database.
- **Server-only database access:** the browser never talks to Postgres. Every table has RLS on with **no policies** and no grants to `anon`/`authenticated`; only `service_role` (the Express API, via `server/lib/db.ts`) can read or write, and the API enforces roles on every endpoint. Never add a policy or grant for `anon`/`authenticated` without team agreement.
- **Migrations:** SQL files in `supabase/migrations/`, applied in order, **preview first, then production**: `npx supabase db query --remote=<ref> --yes -f supabase/migrations/<file>.sql` (needs `npx supabase login`). Never edit a migration that has been applied; add a new one. After applying, test as `service_role` through the REST API, not only through the CLI (the CLI's admin connection hides missing grants).
- **Code runner:** Pyodide loads from the jsDelivr CDN in the browser, inside a Web Worker, so running student code costs no server time and an infinite loop can never freeze the page.

### Team and git flow (decided Nov 23: solo build)
- **One builder:** R1 (Basit) with Claude Code writes all code. Teammates do **no code**: course content (in the plain formats under `content/`), Thursday's test, recorded sessions, research, video and deck.
- Claude works on a branch per feature, opens a PR, checks the Vercel preview link, then merges. Basit reviews previews for product and UI decisions.
- Judges' Q&A answer for "who built what": one engineer building with an AI coding assistant (disclosed in the README); four teammates on research, content, user testing, video and pitch.
- Every push to `main` deploys to production; every pull request gets a Vercel preview URL for teammates to test.
- Work on branches, open a PR, test on the preview URL, then merge. Only tested work merges to `main`, and `main` is always deployable.
- `npm run lint && npm test && npm run build` must pass before every merge.

### Environment variables (Vercel project settings, never in code)
Listed in `.env.example`. Set separately for **Production** and **Preview**; local work uses `.env.local` (git-ignored).

| Variable | Where it's used | Production vs Preview |
| --- | --- | --- |
| `GEMINI_API_KEY` | server only | **different keys** (separate Google Cloud projects) |
| `GROQ_API_KEY` | server only | **different keys** |
| `OPENROUTER_API_KEY` | server only | **different keys** (different accounts) |
| `OPENROUTER_MODEL` | server only | same model id in both |
| `LLM_PROVIDER` | server only | `gemini` in both |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | browser + server | production vs preview Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only**; never sent to the browser, never `VITE_`-prefixed | production vs preview Supabase project |
| `CRON_SECRET` | server only (cron auth) | Production only (cron runs only on production) |

Only variables prefixed `VITE_` reach the browser bundle. Never give the service-role key or any AI key that prefix.

### Endpoints that protect the live link
- **`GET /api/health`** reports `database`, `gemini`, `groq`, `openrouter` as `ok | not_configured | error`, plus `status` (`ok`, `degraded` = an AI provider is down, `down` = the database is down, HTTP 503). It is cheap: no model generation (the AI checks are model-metadata GETs), results cached 60 s per instance, no secrets in the output.
- **`GET /api/cron/reset-demo`**, called by Vercel Cron at `0 22 * * *` UTC (**03:00 PKT**; Hobby runs cron at most once a day and may fire up to 59 min late). It returns 401 unless `Authorization` is exactly `Bearer ${CRON_SECRET}` (constant-time compare). It deletes expired demo sandboxes, and the daily database activity keeps the free Supabase project from pausing (Supabase pauses after 7 days of low activity).

### Private demo sandboxes (Try as teacher / Try as student)
- Each click creates a fresh sandbox with a temporary demo identity. Visitors never collide or see each other's changes; sandboxes expire, and the nightly reset deletes them.
- Creating a sandbox takes **under 2 s** and **never calls an AI model**.
- Design (implemented in the schema): **every row has a `sandbox_id`** (`seed` = demo template, `live` = real accounts such as Thursday's test, `demo` = one per click, with `expires_at`). Creating a demo sandbox copies the small rows (courses, assignments, submissions, flags, vivas) with new ids, and **shares the heavy, immutable event logs** through `submissions.event_source_id` instead of copying them. Every API query filters by the caller's `sandbox_id`. Deleting a sandbox cascades everything inside it.

### Protecting the AI quota
- Rate-limit AI calls per sandbox and per IP, with a friendly message when a limit is hit. Counters live in Postgres (serverless instances share no memory).
- Gemini 429/5xx → retry once → Groq → OpenRouter, automatically (in `server/llm.ts`).
- Seeded submissions use pre-generated viva transcripts and summaries; seeding never calls a model.

### Performance and stability
- The landing page loads fast on normal Pakistani 4G: small initial bundle, hashed assets cached immutably, no blocking third-party scripts on the landing page.
- Pyodide preloads in the background after the first screen renders and shows "Preparing the code runner…". The page never freezes.
- Express has a global error handler (`server/app.ts`): JSON errors, no stack traces to the browser, the function never left in a bad state.
- No console errors in production.

### Freeze and rollback
- At submission (Nov 28) tag the submitted commit `v1.0-submission` and record its deployment URL in `docs/submission.md`.
- After that, only environment and config changes are allowed.
- If a deploy breaks, use Vercel's **Instant Rollback** to return to the tagged build.

## Key domain rules

- **Process events** (`keys`, `delete`, `paste_attempt`, `run`, `error`, `focus_lost`, `focus_back`, `fullscreen_exit`, `snapshot`, `submit`) follow the **frozen format** in `docs/event-format.md` / `shared/events.ts` (zod; shared by browser and server) and are rebuilt by `shared/replay.ts`. They are batched from the client every 10 s, **timestamped by the server**, idempotent on `(submission_id, seq)`, and stored append-only: a database trigger refuses every update, and refuses deletes except inside `reset_demo()`.
- **Flags** (rule-based, each stores the event range as evidence): large instant insertion; typing much faster than the student's own baseline; long focus loss followed by a burst; correct submission with no prior runs; perfect tests with viva score < 50.
- **Viva:** 3–5 questions generated from the student's own code, output or text: explain a line, predict output for a changed input, describe a modification. About 90 s per question, paste blocked, each question may build on the previous answer. Score 0–100 against a rubric (goal, logic, output prediction, modification) plus a 1–2 sentence teacher summary.
- **Ustaad never writes solution code.** Replies are short and end with one question; Roman Urdu + English, matching the student. Keep the prototype's prompt and its seven-stage mapping.
- **Hidden tests run in the browser (team decision, Nov 23), but answer keys never reach it:** test *inputs* are sent only after the student clicks Submit and the code is locked and stored on the server; the browser runs them in the Pyodide worker and sends back the raw outputs; the **server** compares them with the expected outputs, which never leave the server. Judges' Q&A answer: "Tests run on the student's machine, so the server stays cheap; the expected answers never leave our server, the submitted code is locked first, and the teacher can re-run it."

## UI/UX rules: understandable at first look

The site must explain itself in five seconds **without a feature list**. Follow Norman, Nielsen, Shneiderman and Krug (see `docs/proposal.md`, section "Interface and interaction design").

**Why this matters:** judges are people. First impressions form in about 50 ms, attractive interfaces are judged easier to use, and easy-to-process things feel more trustworthy. Clarity raises every score, not just UI/UX.

**The test for every screen:** without help, a first-time user can (1) say what the screen is for, (2) see what to do next, (3) **predict what a click will do before clicking** (feedforward), and (4) see right away what changed (feedback). If any answer is "no", the screen is not done.

- **Feedforward labels:** buttons state the outcome ("Run my code", "Start viva: 3 questions, about 5 min", "Submit (you can't edit after this)"). Before a consequential step, show a one-line preview of what happens next.
- **Conceptual model, repeated everywhere:** work here → teacher sees how it was made → Ustaad asks about it → marks for what you understand.
- **Progressive disclosure:** few choices at a time; advanced assignment settings collapsed by default.
- **Teacher report as a story:** timeline first; flags as plain sentences, each with "Show me", which jumps to that moment in the replay.
- **Judge's cold 60 seconds:** the landing page shows one sentence on what Socratic AI is, a three-step visual of how it works, and "Try as teacher" / "Try as student". No sign-up and no empty screens in the first minute.
- **Journey stepper** on every assignment: Understand → Write → Run → Explain → Submit + viva. Always visible; locked steps say why.
- **One primary action per screen**, labelled with a verb ("Run my code", "Start viva", "Submit").
- **Rules chips** at the top of each assignment (due date, paste off, viva length).
- **Feedback for everything:** "Saved 3 s ago", run results, viva timer ring, inline explanation when paste is blocked (never silent).
- **Colour language:** blue = action, green = done, amber = needs attention, grey = locked or upcoming. Always icon + text, never colour alone.
- **Words from the classroom:** Course, Assignment, Marks, Viva, Due. No internal jargon in the UI (no "Norman stage 6" for students).
- Max three regions per screen; generous spacing; 16 px body, never below 12 px; 44 px tap targets; WCAG AA contrast; keyboard navigation.
- Every screen has loading, empty (teaching) and error states. No lorem ipsum, "test123" or "Student 1" anywhere.
- Fonts: Inter; Noto Nastaliq Urdu for Urdu labels. Motion only for feedback (`motion` library), never decoration.
- Remove the prototype's "Norman HCI" and "Requirements" tabs from the product UI.

## Demo-readiness and video-readiness

- The UI must look excellent at **1920×1080** at 100% and 125% zoom: no overflow, no cut-off text, no console errors.
- `?recording=1` hides dev-only elements and any debug badges, except "Demo data".
- Seed data: a fictional institution ("Pothohar Institute of Computing: Demo"), 3 teachers, 4 courses (CS-101, WEB-102, CS-201, ENG-101), 6 weekly modules each, about 22 assignments, 30 fictional students per course, about 400 past submissions reusing **real recorded team sessions**, and announcements. **Dates are relative to today.** One empty "New course" shows the creation flow.
- `npm run seed` rebuilds everything in under a minute and **never calls an AI model**. Past submissions come ONLY from real recorded sessions in `server/seed/sessions/*.json` (saved with `npm run session:export`, see `docs/recording-guide.md`), shown under fictional classmates' names, with flags and grades recomputed by the current rules. Never write or edit session files by hand; simulated test sessions must never be committed.
- Landing page: "Try as teacher" and "Try as student" one-click logins; nightly reset; a "Reset demo" button.

## Commands

```
npm install
npm run dev        # client + server on http://localhost:3000 (reads .env.local)
npm run lint       # tsc --noEmit (server + client); eslint to be added; must pass before every commit
npm test           # unit tests: flags, viva JSON parsing, variants, grading
npm run seed       # rebuild the demo seed on preview (add -- --production for prod); never calls AI
npm run build
npm run smoke:llm  # one tiny live call to each AI provider (uses .env.local)
npm run smoke:ui -- http://localhost:3000   # headless Chrome: landing, both roles, runner, full student session incl. viva; fails on console errors
npm run session:export -- --submission <id> --as <classmate> --label <name>   # save a REAL recorded session for the seed
npm run seed -- --recording   # preview only: all assignments open, for recording sessions (docs/recording-guide.md)
npm run e2e:viva -- http://localhost:3000   # API + real AI: simulated honest vs copier through submit, tests, viva, grade, flags (engineering check, never a pitch result)
```

## Definition of done (every feature)

1. Works on the deployed build, not just locally.
2. Has loading, empty and error states, and passes the five-second test and the predict-before-click test (a new student or teacher knows what to do and what will happen).
3. Unit tests for any logic (integrity flags, scoring, variants, parsing).
4. README updated if a dependency was added.
5. Committed with a clear message; demo path re-checked if touched.

## Schedule

- **Mon Nov 23:** **live deploy first (hello world + `/api/health` on the production URL) before anything else**; then repo, schema, auth, design system, new layouts.
- **Tue Nov 24:** assignment builder, workspace + stepper, paste blocking, event logging.
- **Wed Nov 25:** viva, hidden tests, variants, seed script; written answers if the demo path is done.
- **Thu Nov 26:** teacher report + replay + flags; quizzes and handwritten only if the demo path is solid (behind flags); real test with 10 students and 1–2 teachers; **feature freeze at night**.
- **Fri Nov 27:** video (script, record, edit), demo data check, backup recording.
- **Sat Nov 28:** deck, README, rehearsal; **submit by 8 PM** (repo, live link, ≤ 2-min video, deck); tag `v1.0-submission`.
