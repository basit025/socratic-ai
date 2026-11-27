# HCI audit: what gives value, what is only a feature

Done on 2026-11-27 against a local build (`npm run dev`, preview database, real Gemini), driven by hand in Chrome. Path walked: landing → Try as student → Cricket Over Tracker → write, run, ask Ustaad, submit, viva → "See what your teacher sees" → class submissions list. Not walked yet: timed quiz, written answer, handwritten upload, assignment builder, gradebook.

Each finding says what was seen, so it can be checked again. Tasks that fix them are in `docs/backlog.md`.

## 1. What works and gives real value

| Seen | Why it matters |
| --- | --- |
| Landing explains itself in one sentence and offers Try as teacher / Try as student. A private sandbox opened in about 1 s, no sign-up. | Passes the five-second test. A visitor reaches real screens immediately. |
| Health check: database, Gemini, Groq, OpenRouter all `ok`. | The AI is real, not canned. |
| Code ran in the browser in 27 ms; output `(14, 2)` shown with "Ran without errors". | Clear feedback, no install. |
| Ustaad answered in about 5 s, without giving code, and ended with a question. | Does what the mentor promises. |
| Submit dialog lists exactly what happens next (code locked, hidden tests, 3 questions, can't pause). | Good feedforward before an irreversible step. |
| Viva questions were about **my own** code (`if r >= 4:`), a prediction, and a modification. Score 90/100 with a reason per answer. | This is the core idea, and it works. |
| Teacher report: tests, viva, suggested mark, time, runs, a replay, flags as sentences with "Show me". It flagged my machine-typed code ("45 characters per second, roughly 15× a typical student's pace"). | The flag was correct. The report reads as a story, and the teacher decides. |
| No console errors on the pages walked. | |

## 2. Where it is only a feature, or hurts trust

1. **The demo class is visibly cloned.** In the Cricket Over Tracker list, Bilal, Danish and Mahnoor have identical rows (35/100, 6.8/10, 2 flags), and Ali, Fatima, Kinza and Usman share another (65/100, 8.3/10, 3 flags). One simulated session is reused under several names (`alsoAs` in `server/seed/sessions/*.json`). All 93 session files are AI-simulated; none is a real person. A teacher or investor sees fabricated-looking data within 10 seconds.
2. **"Explain before you run" is decided only in the browser.** `runUnlocked` is React state (`client/src/pages/Workspace.tsx`). The server takes `hasRun` from the request body (`server/routes/workspace.ts`), and the submit route (`server/routes/viva.ts`) never checks that Ustaad approved anything. The lock is a suggestion, not a rule.
3. **The "Explain" step turns green after any one message.** I sent one sentence and the stepper marked Explain done. The step adds no check; it is decoration.
4. **The understanding check is typed text.** A student can read an answer from a second laptop or phone and type it in. Voice answers (spoken live, timed, with a follow-up built on the answer) are the mechanism that closes this; see backlog T03.
5. ~~**Two primary buttons at once.**~~ *Corrected during T07:* "Run my code" is a secondary (white) button, so only one blue button shows on arrival. This finding was wrong.
6. **The next-step bar scrolls away.** Once the student scrolls to the editor, the stepper and Submit button are off screen, with nothing to show what comes next.
7. **The viva starts with a silent 10-second spinner.** Nothing says that Ustaad is writing questions from the code.
8. ~~**The viva timer keeps running while Ustaad scores.**~~ *Corrected during T08:* the countdown runs only while a question is on screen and freezes while Ustaad reads. The numbers I saw had ticked down while I was taking screenshots. This finding was wrong.
9. **Predictable question.** Question 2 was `over_summary([])`, the same case the student had already explained in chat and the exact example printed on the landing page.
10. **Ustaad over-praises.** "Your logic is spot on and handles the empty list case perfectly. You have clearly understood…" after one sentence. Praise before checking weakens the mentor.
11. **Noise on the student home.** "9+" notifications and 30 items in the panel on first visit; course title shown twice in the assignment header (breadcrumb and kicker).
12. **Copy says "No microphone".** True today, but it must change when voice answers ship.

## 3. Decisions taken for the demo

- **No sign-in for the demo.** One click opens a private sandbox as student or teacher; this already exists and stays. The "Sign in" link stays only for real classes.
- **Names:** Socratic AI is the system; Ustaad is the agent.
