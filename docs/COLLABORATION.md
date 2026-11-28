# Working together: the last 20 hours

This guide is for two people coding Socratic AI at the same time: **Basit** (with Claude Code) and **Hammad**. It covers the final stretch before the Saturday-night submission.

The goal: both of us ship fast, `main` never breaks, and the product looks like **one** team built it.

---

## 1. The five rules (read these even if you skip the rest)

1. **Claim before you code.** Post one line in the team chat before starting: *"Taking: teacher gradebook redesign. Files: `Gradebook.tsx`, `server/routes/teacher.ts`."* Then open a **draft PR** within 30 minutes, so the other person can see which files you're touching.
2. **Small PRs, merged within a few hours.** One feature per branch. A PR that stays open overnight means conflicts. Aim for under about 400 changed lines.
3. **Pull `main` often.** Run `git pull --rebase origin main` at least every hour, and always right before opening or merging a PR.
4. **Never push to `main` directly.** Branch, PR, check the Vercel preview, then merge. `main` deploys to production on every merge, so judges can see whatever is on it.
5. **Use the existing building blocks.** Use the components, colours and patterns listed in section 4. Don't invent new ones. This is what keeps the product looking consistent.

---

## 2. Who owns what

Each area has **one owner**. The owner can change anything in their area without asking. To change a file in someone else's area, ask first in chat; a 10-second message saves an hour of conflict.

| Area | Owner | Main files |
| --- | --- | --- |
| Instructor side: teacher home, teacher course tabs, assignment builder, gradebook, submissions list, integrity report | **Hammad** | `client/src/pages/TeacherHome.tsx`, `Builder.tsx`, `Gradebook.tsx`, `TeacherAssignment.tsx`, `Report.tsx`, `server/routes/teacher.ts` |
| Student side: home, course pages, lectures, calendar, marks, workspace, quiz, viva | **Basit** | `StudentHome.tsx`, `CoursePage.tsx` (student parts), `LectureView.tsx`, `Workspace.tsx`, `Quiz.tsx`, `Viva.tsx`, `server/routes/home.ts`, `workspace.ts`, `quiz.ts`, `viva.ts` |
| AI (Ustaad, viva, study tutor) | **Basit** | `server/llm.ts`, `server/ustaad.ts`, `server/study.ts`, `server/viva.ts`, `server/routes/study.ts` |
| Landing page, sign-in, seed data and course content | **Basit** | `Landing.tsx`, `SignIn.tsx`, `server/seed/**` |

This split is a proposal; change it in chat if it doesn't suit you, then update this table.

### Shared "hot" files: one change at a time

Everyone touches these files, so they cause most conflicts. Change them in a **small, separate PR**, say so in chat, and merge it quickly so the other person can pull it.

- `client/src/main.tsx` (routes)
- `client/src/components/Shell.tsx` (sidebar, top bar)
- `client/src/components/ui.tsx` (Button, Card, Chip, …)
- `client/src/index.css` (colour tokens)
- `client/src/lib/*.ts` (shared types and helpers)
- `client/src/pages/CoursePage.tsx` (shared by both roles: Basit edits the student parts, Hammad the teacher parts; agree before restructuring it)
- `server/app.ts` (router list)
- `supabase/migrations/*` (see section 6)
- `package.json`, `package-lock.json` (new dependencies; also update the README's third-party list)
- `scripts/smoke-ui.ts`

**Adding a route or a router?** Add only your one line to `main.tsx` or `app.ts`. If you both add lines in the same place, the conflict is trivial: keep both lines.

---

## 3. The git workflow, step by step

```bash
# Start of a task
git switch main && git pull
git switch -c feat/teacher-gradebook          # feat/, fix/ or docs/ + a short name
npm install                                    # also installs the secret-scanning pre-commit hook

# While working: commit small and often (the history is our originality evidence)
git add -A && git commit -m "Gradebook: sticky first column and per-student totals"
git pull --rebase origin main                  # every hour
git push -u origin feat/teacher-gradebook      # the first push; open a DRAFT PR now
gh pr create --draft --fill

# Ready to merge
npm run lint && npm test && npm run build      # all three must pass
git pull --rebase origin main && git push --force-with-lease
gh pr ready
# Wait for the Vercel preview, open it, and click through what you changed
gh pr merge --merge --delete-branch
```

- **Force-push only your own branch, and only with `--force-with-lease`.** Never force-push `main`.
- **Commit messages** describe the change in plain words ("Builder: quiz questions from a lecture"), not "fix" or "update".
- **Review:** if the other person is free, ask for a 5-minute look at the preview link. If not, you may merge your own PR once the checks pass and you've tested the preview. Post "merged #NN" in chat.

### When a rebase conflicts

1. Open the conflicted file and keep **both** changes where possible (routes, imports and list items almost always merge cleanly by keeping both).
2. If it's the other person's area, keep their version and re-apply your change on top. If you're unsure, ask.
3. Run `npm run lint` before `git rebase --continue`.

### If `main` breaks production

Revert first, investigate after: `gh pr revert <number>` (or `git revert -m 1 <merge-commit>` on a branch with a PR). Vercel's **Instant Rollback** also works from the dashboard. Tell the other person straight away.

---

## 4. Keeping the product consistent

The product should feel like one platform. Before building a screen, open a similar existing screen and copy its structure.

### Layout and components (`client/src/components/`)

| Need | Use | Don't |
| --- | --- | --- |
| A page | `<AppShell>` (or `<Page>`) inside the `Shell`, plus `<PageHeader title subtitle action>` | A custom header, logo or page width |
| Buttons | `<Button variant="primary\|secondary\|ghost" icon={…}>` | `<button className="bg-blue-…">` |
| Boxes | `<Card>` | New shadows or borders |
| Status labels | `<Chip tone="action\|done\|attention\|locked\|danger">` | Coloured text alone |
| Tabs or toggles | `<Segmented>`, or the course-tab pattern in `CoursePage.tsx` | A new tab component |
| Loading, empty and error states | `<Skeleton>`, `<EmptyState>`, `<ErrorState onRetry>` | A blank screen or a bare spinner |
| Dialogs | `<Dialog>` | `window.confirm` |
| Data from the API | `useApi(path)` or `api()` from `lib/api.ts` | `fetch` directly |
| Course colours and icons | `courseStyle(code)` from `lib/courseStyle.ts` | Hard-coded colours per course |
| Dates | `formatDue`, `formatDay`, `formatTime`, `timeAgo` from `lib/format.ts` (Pakistan time) | `toLocaleString()` |

### Colours

Use only the tokens in `index.css`: `action` (blue: do something), `done` (green), `attention` (amber), `locked` (grey), `danger` (red), and `ink`, `ink-2`, `ink-3`, `line`, `canvas`, `surface`. **No raw hex colours or Tailwind palette colours** (like `bg-blue-600`) in product screens. Always pair colour with an icon or text.

### Words

- Classroom words only: Course, Lecture, Assignment, Quiz, Marks, Viva, Due. No developer jargon on screen.
- Buttons say what will happen: "Publish assignment", "Confirm mark", not "Submit" or "OK".
- **Don't use "demo" or "sample" anywhere in the product** (decision, Nov 28): it should read as a real platform. The disclosure that the seeded institution is fictional lives in the README.
- It's a "learning platform", never a "portal". Ustaad is the AI's name, and Ustaad never writes solution code.

### Server patterns (`server/`)

- Every route: `requireSession("teacher" | "student")`, then validate the body with **zod**, then **filter every query by the caller's `sandbox_id`** (and their profile id where relevant). Throw `PublicError(status, "friendly message")` for anything the user should read.
- **Only `server/llm.ts` calls an AI model.** Call `generateJson({ purpose, system, messages, schema, … })`, and call `enforceAi(sid, ipHash(req))` first.
- Server imports end in `.js` (`import { x } from "../lib/db.js"`).
- Logic worth testing (scoring, flags, parsing, prompts) goes in a plain module with a `*.test.ts` next to it (`npm test`).

---

## 5. Using Claude Code (both of us)

- `CLAUDE.md` in the repo is the shared rulebook for every Claude session. Keep it up to date in the same PR when a rule changes.
- Start each session with: *"Pull main first. I'm Hammad, I own the instructor side (see docs/COLLABORATION.md); don't edit files outside my area without asking me."*
- Ask Claude to open a **draft PR early** and to run `npm run lint && npm test && npm run build` before marking it ready.
- Claude's memory is per machine; anything both Claudes must know goes in `CLAUDE.md` or this file.

---

## 6. Database, environment and production data

- **Migrations:** one person at a time. Say "writing a migration" in chat first. The file name is the next timestamp number (`supabase/migrations/2026112800000N_name.sql`). Apply it to **preview first** (`npx supabase db query --remote=eksckojfihwirwdgdrfc --yes -f <file>`), test, then to production (`szenspgxfjrynhtwhixm`) **just before** merging the PR that needs it. Never edit an applied migration.
- **Seed:** only Basit runs `npm run seed -- --production`, and only after telling the other person. Preview seeding is fine for anyone, but say so (it resets the preview data).
- **Secrets:** your `.env.local` comes from Basit over a private channel (never GitHub, never a group chat). Never commit `.env*` files. The pre-commit hook blocks key-shaped strings; don't bypass it with `--no-verify`.
- Local runs use the **preview** database and preview AI keys, never production.

---

## 7. Timeline to submission

| When (PKT) | What |
| --- | --- |
| Now to Saturday about 6 PM | Feature work in small PRs, both of us in parallel |
| Saturday 6 PM | **Feature freeze.** Only bug fixes and copy changes after this. |
| Saturday 6 PM to 9 PM | Full run-through on production (`npm run smoke:ui -- https://socratic-ai-pk.vercel.app`), screenshots for the deck, final fixes |
| Saturday 9 PM | Tag `v1.0-submission`, fill in `docs/submission.md` |
| Saturday before 11:59 PM | Submit |

Before every merge that touches a demo-path flow (builder, workspace, viva, report), run the browser test against the preview URL:

```bash
npm run smoke:ui -- <vercel-preview-url> /tmp/smoke
```

---

## 8. Quick checklist before you merge

- [ ] Rebased on the latest `main`
- [ ] `npm run lint && npm test && npm run build` pass
- [ ] Clicked through the change on the Vercel preview (desktop, and a phone width)
- [ ] Loading, empty and error states exist
- [ ] Only existing components and colour tokens used; no "demo" wording
- [ ] New dependency? README "Third-party APIs and libraries" updated
- [ ] Posted "merged #NN" in chat
