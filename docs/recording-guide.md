# Recording real sessions for the demo data

The demo's past submissions (the class a judge sees after "Try as teacher") come **only from real sessions recorded by real people**: the team and friends. Each one is then shown under a fictional classmate's name ("Bilal Ahmed", "Fatima Noor"…). Nothing is invented: that's what makes the replays, flags and vivas believable, and honest.

These recordings are also the raw material for the video and the screening panel.

## Where to record

Use the **recording link** (all three assignments are open there, and it uses the test database, not the live one):

**https://socratic-ai-git-recording-abdulbasitawan003-9809s-projects.vercel.app**

Use a laptop or PC (not a phone) and Chrome or Edge.

## What to record (about 10 sessions in total)

| # | Assignment | Who | How to work |
| --- | --- | --- | --- |
| 1–3 | Cricket Over Tracker | 3 different people | **Honest.** Solve it yourself. It's fine to make mistakes, run the code, read errors, fix them, ask Ustaad for a hint. |
| 4–6 | Cricket Over Tracker | 3 different people who **haven't seen the solution** | **Copier.** Ask ChatGPT (on your phone) for the answer, then retype it from the phone. Try pasting once (it will be blocked). Don't run the code before submitting. Answer the viva honestly: if you don't know, say so. |
| 7–9 | Chai Bill Splitter | 3 people | **Honest**, as above. |
| 10 | Rickshaw Fare Estimator | 1 person | **Honest.** This one is "explain first": explain your plan to Ustaad before you can run. |

Each person should start a **new demo** for each session (so they become a fresh student).

## Steps for one session (5–10 minutes)

1. Open the recording link → **Try as student**.
2. Open the assignment from the table above and work on it **as described** (honest or copier).
3. Click **Submit** → the hidden tests run → do the **viva** (3 questions). Answer in your own words, English or Roman Urdu.
4. On the results screen, click **See what your teacher sees**.
5. **Copy the address from the browser bar.** It ends in `/teacher/submissions/` followed by a long code. That code is the submission id.
6. Send it to Basit with: which row of the table it was (1–10) and whether it was honest or copier.

## What not to do

- Don't fake an "honest" session by pasting: the point is genuine behaviour.
- Don't coach the copiers on the viva questions.
- Don't use real student names anywhere: the platform shows fictional names.

## What happens next (Basit / Claude)

For each submission id:

```bash
npm run session:export -- --submission <id> --as <classmate> --label <row>-<honest|copier>-<assignment> --days-ago 1
npm run seed                    # preview
npm run seed -- --production    # live demo, once all sessions are in
```

Classmate keys: `bilal`, `hamza`, `fatima`, `zainab`, `usman`, `mahnoor`, `ali`, `sara`, `omar`.

After the last recording, reseed preview **without** `--recording`, so the normal deadlines come back.
