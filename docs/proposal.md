# Socratic AI — Strong Fundamentals in the Age of AI: Project Proposal

Nov 22, 2026 · @Basit

## Summary

**Socratic AI is a course platform where students do their assignments, coding labs and quizzes inside one workspace that records how the work was made and then asks the student to explain it.** A teacher gets a report showing not just the final answer but the process behind it and whether the student understood it. Copy-pasting an AI answer stops being worth it, because the grade depends on the process and the explanation, not only the output.

**Purpose: AI as a tutor, not a ghostwriter.** Socratic AI is not against AI — it uses AI itself, through the Ustaad mentor, to help students learn. It simply makes sure that for the work meant to build a concept, students do the thinking themselves. That protects two things: **fair evaluation**, so honest students aren't graded below those who copy, and **strong fundamentals**, because a student who skips the learning carries weak foundations into later courses, their final project and their first job.

- **Track:** 1 — Education (EdTech).
- **Built on:** the team's existing Socratic AI prototype (Ustaad mentor, in-browser code runner, professor report), extended into a full course system.
- **Core principle:** a browser can't make cheating *impossible* (a student can always use a second phone). Socratic AI makes cheating **pointless**: work done outside the platform leaves no process trail, and an AI-written answer the student doesn't understand fails the explanation check.
- **Why it can win:** every university teacher on the jury is fighting AI-written assignments right now; HEC's draft generative-AI policy says a student can't be punished on an AI-detector report alone, so universities need a way to verify learning instead of guessing. Socratic AI is that way, with a live demo that shows a cheater getting caught.

**Tagline:** *Socratic AI — proof that you learned it.* The AI mentor inside the platform keeps the name **Ustaad**.

## The problem

Take-home assignments no longer prove that a student learned anything, and the tools universities rely on to catch AI-written work don't hold up.

- **AI does the homework.** A student can paste any coding lab or essay prompt into ChatGPT or Gemini and submit a polished answer in minutes. The teacher sees the same output whether the student learned or not.
- **Detectors are unreliable and unfair.** A 2023 Stanford study found AI detectors flagged **61%** of essays by non-native English writers as AI-generated ([Stanford HAI](https://hai.stanford.edu/news/ai-detectors-biased-against-non-native-english-writers)). Nearly all Pakistani students write in a second language, so detector-based policing punishes honest students.
- **Pakistan's regulator is moving, but its rules are hard to enforce.** HEC's draft policy bans presenting AI-generated work as one's own and requires students to declare the tools they used, while saying a student cannot be punished on a detection report alone. An IBA Karachi professor argued in Dawn (Aug 2026) that these rules target things teachers can't observe, and that grades should instead come from work done in controlled settings, oral defences and vivas ([Dawn](https://www.dawn.com/news/2022115)).
- **Vivas work but don't scale.** Teachers already know the fix — ask the student to explain their work — but a teacher with 60 students per section can't run 60 vivas for every weekly lab.
- **AI literacy is now mandatory.** HEC made an AI course compulsory in all degree programmes from Fall 2026 ([Dawn](https://www.dawn.com/news/1974380)), so every university is rethinking how it assesses work in an AI world.

**Socratic AI's answer:** move graded work into a workspace where the process is visible, and automate the viva with an AI that questions each student about *their own* work.

## What the Socratic AI prototype already does

The prototype (built in Google AI Studio, files dated Nov 22, inside the hackathon's build window) is a strong core: it already runs code in the browser and verifies understanding through a Socratic chat. What it lacks is everything around a single session — courses, teachers, persistence and integrity controls.

| Area | Already built | Missing for Socratic AI |
| --- | --- | --- |
| Code workspace | Editor with starter code; runs Python (Pyodide), JavaScript and HTML/CSS in the browser; shows output and errors | Paste blocking, process recording, hidden test cases |
| AI mentor "Ustaad" | Gemini 3.1 Flash-Lite, server-side; never writes solution code; replies in Roman Urdu + English; maps each step to Don Norman's seven stages of action | Personalised "what if" questions about the student's own code; a scored viva at submission |
| Workflows | Run-first (run, then explain output) and explain-first (explain logic to unlock Run) | Teacher chooses the mode per assignment |
| Professor report | Checklist (goal clear, logic explained, output interpreted, understanding verified) plus an AI summary, copyable as text | Saved per student, process replay, integrity flags, gradebook |
| Assignments | Seven built-in examples with Pakistani context (chai bill splitter, cricket over tracker, rickshaw fare) | Teacher-created assignments, quizzes, written and handwritten work |
| Users and data | Student name stored in the browser only | Accounts, roles (student / teacher), courses, enrolment, a database |

**Keep:** the Ustaad prompt design, the structured JSON response schema, both workflows, Pyodide execution and the Pakistani-context assignments. **Build next:** the course system, the integrity layer and the teacher dashboard described below.

## Core idea: verify the learning, not just the answer

Socratic AI stacks three layers. Any single layer can be beaten; beating all three takes more effort than doing the work honestly.

1. **Controlled workspace — make outside help awkward.** Graded work happens inside Socratic AI: paste is blocked in answer fields, the question can't be copied out, leaving the tab is logged, each student gets their own variant of the question, and quizzes are timed. Handwritten work is photographed inside Socratic AI with a one-time code word written on the page.
2. **Process evidence — make the journey visible.** Socratic AI records how the answer grew: typing in bursts, edits, deletions, each code run and its error, time spent. A teacher can replay it. Honest work looks messy and gradual; copied work appears as one long, error-free burst with no runs.
3. **Explain-to-verify — the automated viva.** At submission, Ustaad asks the student 3–5 short questions about *their own* answer: "Why did you start `total_runs` at 0?", "What prints if the list is empty?", "Change line 4 so it counts only boundaries — what would you write?" Questions are generated from the student's actual code and output, so they can't be prepared in advance.

**What the teacher receives:** one integrity report per submission — the work, a replay timeline, any flags, the viva transcript with an understanding score, and an AI-written summary. **Socratic AI never declares a student guilty.** It shows evidence; the teacher decides. This matches HEC's draft rule that no student is punished on a detector report alone.

## Users and roles

Two roles carry the MVP; the third is a roadmap item.

| Role | Who | What they do in Socratic AI |
| --- | --- | --- |
| **Teacher** | University or college instructor (CS labs first) | Creates a course, invites students with a join code, builds assignments and quizzes, sets integrity rules per assignment, reviews integrity reports and replays, grades |
| **Student** | Undergraduate or intermediate student | Joins a course, works on assignments inside the workspace, chats with Ustaad for hints, completes the viva, sees feedback and grades |
| **Admin** (roadmap) | Department head or university IT | Manages teachers and courses across a department, sees department-level integrity trends |

**Primary persona for the pitch:** Ma'am Sana teaches CS-101 to 3 sections of 60 students at a public university in Rawalpindi. Since 2024 most lab submissions look perfect, but students can't explain them in exams. She can't run 180 vivas a week. Socratic AI runs them for her and shows her which students need a real conversation.

## Functional requirements

Thirty requirements in eight modules; **MVP** items are what the Nov 28 build must ship, **Stretch** items only if the team is ahead.

| ID | Module | Requirement | Priority |
| --- | --- | --- | --- |
| FR-01 | Accounts | Sign up / log in with email and password; role chosen as student or teacher | MVP |
| FR-02 | Courses | Teacher creates a course (name, code, section) and gets a 6-character join code | MVP |
| FR-03 | Courses | Student joins a course with the code and sees its assignments, deadlines and grades | MVP |
| FR-04 | Assignment builder | Teacher creates an assignment of type **code**, **written** or **handwritten**, with instructions, deadline and marks | MVP |
| FR-05 | Assignment builder | For code: language (Python / JavaScript / HTML), starter code, expected output, and hidden test cases | MVP |
| FR-06 | Assignment builder | Integrity rules per assignment: paste allowed or blocked; workflow run-first or explain-first; viva required (number of questions); time limit; question variants on or off | MVP |
| FR-07 | Assignment builder | Question variants: teacher marks parameters (numbers, names, list values) that change per student, so two students never get the identical prompt | MVP |
| FR-08 | Code workspace | Editor with run button; Python via Pyodide, JavaScript and HTML in a sandboxed iframe (from prototype) | MVP |
| FR-09 | Code workspace | Hidden tests run on submit; results feed the auto-grade | MVP |
| FR-10 | Written workspace | Plain-text editor for short written answers with word count, same integrity rules as code | MVP |
| FR-11 | Handwritten work | Student photographs pages using the in-app camera only (no gallery upload); each session shows a one-time code word the student must write at the top of the page | MVP |
| FR-12 | Handwritten work | AI reads the photo, checks the code word is present, and makes the content available to the viva and the teacher | MVP |
| FR-13 | Quizzes | Timed quizzes with MCQ and short-answer questions, randomised order and per-student variants, one question at a time | MVP |
| FR-14 | Integrity sensor | Block paste, copy, right-click and drag-drop inside answer fields and on the question text when the rule is on | MVP |
| FR-15 | Integrity sensor | Log process events with timestamps: keystroke batches, deletions, paste attempts, runs and errors, tab/window focus loss, fullscreen exit | MVP |
| FR-16 | Integrity sensor | Request fullscreen for quizzes; show a warning and log the event when the student leaves | MVP |
| FR-17 | Ustaad mentor | Socratic hint chat during work that never gives solution code (from prototype); hint use is logged and visible to the teacher | MVP |
| FR-18 | Automated viva | On submit, Ustaad asks 3–5 questions generated from the student's own code, output, or handwritten text: explain a line, predict output for a changed input, modify the code verbally | MVP |
| FR-19 | Automated viva | Viva is timed per question (e.g. 90 s) with paste blocked; answers can be typed or spoken (speech-to-text) | MVP (typed) / Stretch (voice) |
| FR-20 | Automated viva | Ustaad scores understanding 0–100 with a rubric (goal, logic, output prediction, modification) and writes a teacher summary | MVP |
| FR-21 | Integrity report | Per submission: final work, test results, viva transcript and score, process timeline, flags, AI summary | MVP |
| FR-22 | Integrity report | Process replay: teacher scrubs a timeline and watches the code or text being written, with runs and paste attempts marked | MVP |
| FR-23 | Integrity report | Rule-based flags (not verdicts): large instant insertions, typing far faster than the student's own baseline, long focus loss before a burst, no runs before a correct submission, low viva score with a perfect answer | MVP |
| FR-24 | Gradebook | Suggested grade = auto-test marks + viva score weighting set by the teacher; teacher can override with a comment | MVP |
| FR-25 | Gradebook | Course dashboard: submissions per assignment, average viva score, students flagged for a follow-up conversation | MVP |
| FR-26 | Feedback | Student sees grade, test results and Ustaad's feedback on what to revise | MVP |
| FR-27 | Similarity | Compare code between students in the same course to surface near-identical submissions | Stretch |
| FR-28 | Lab mode | Optional Safe Exam Browser configuration for supervised lab exams on university computers | Stretch |
| FR-29 | Voice and language | Ustaad viva by voice in Urdu or English | Stretch |
| FR-30 | Export | Export gradebook to CSV and LMS (Google Classroom, Moodle) | Stretch |

## Integrity controls: what a browser can and cannot enforce

No website can lock a student's computer or stop them using a phone beside it, so "foolproof" must not be promised. Each control below raises the cost of cheating; the viva is what makes the remaining cheating fail.

| Control | What it stops | How a determined student gets around it | What catches that |
| --- | --- | --- | --- |
| Paste and drag-drop blocked in answer fields | Pasting ChatGPT output | Retyping the AI answer from a phone | Process replay shows steady, error-free typing with no runs or edits; viva questions about the code |
| Question text can't be copied or right-clicked | Copying the prompt into ChatGPT | Photographing the screen with a phone, or retyping the prompt | Per-student variants make shared answers wrong; viva |
| Tab, window and fullscreen tracking | Switching to an AI tab unnoticed | A second device | Logged focus loss before a big burst raises a flag; viva |
| Timed quizzes, one question at a time | Leisurely lookup of every answer | Fast lookup on a phone | Short time limits; variants; viva for short answers |
| In-app camera + one-time code word on handwritten pages | Uploading old or someone else's pages, or printed AI text | Copying an AI answer by hand onto paper | Viva about the handwritten answer |
| Per-student question variants | Sharing answers between students | Each student asks AI for their own variant | Viva |
| **Automated viva on the student's own work** | Submitting work the student doesn't understand | Using AI live to answer viva questions | Short per-question timer, paste blocked, follow-up questions that build on the previous answer; teacher sees the transcript |
| Safe Exam Browser in labs (stretch) | Other apps and websites on lab computers | A personal phone in the lab | Human invigilator |

**The honest pitch line:** "We can't stop a student from asking AI. We make sure they can't get marks for work they don't understand."

**What Socratic AI deliberately does not do:**

- **No AI-text detector.** Detectors misjudge non-native writers; Socratic AI grades evidence and understanding instead.
- **No webcam surveillance in the MVP.** It raises privacy concerns, fails on weak internet and old laptops, and adds little that the viva doesn't already cover. It can be a teacher-enabled option later.
- **No automatic penalties.** Flags only prompt the teacher to look; the teacher decides.

### The phone problem: what if the student uses ChatGPT on a second phone?

This is the hardest case and the one judges will ask about first. Socratic AI can't block a phone, so it makes the phone useless for earning marks:

1. **Retyping leaves a fingerprint.** Honest work alternates typing, running, failing and fixing. Retyped AI code arrives as one steady, error-free burst with no runs or edits, often right after a long focus loss. Process replay shows this and raises a flag (evidence, not proof).
2. **The viva is the real defence.** Questions are about the student's own code, timed at about 90 seconds each with paste blocked, and each builds on the previous answer. There isn't time to type every question into a phone, read the answer and retype it.
3. **Variants make shared or online answers wrong.**
4. **The viva carries marks.** The teacher sets the weighting (for example 50% tests, 50% viva). A perfect answer with a weak viva scores low automatically, and flagged students get a short in-person viva. High-stakes exams use lab mode with an invigilator.

If a student copies from AI and then studies the code until they can genuinely pass the viva, they have learned the material — which is the purpose of the assignment.

## Non-functional requirements

| ID | Quality | Requirement |
| --- | --- | --- |
| NFR-01 | Fairness | No grade or flag is based on an AI-detector score; every flag shows the evidence behind it; the teacher makes every decision |
| NFR-02 | Privacy | Students are told on every graded assignment that the process is recorded; only teachers of that course see replays; keystroke logs are deleted after the term (configurable); no webcam or microphone use unless the student starts a voice viva |
| NFR-03 | Low bandwidth | Code runs in the browser (Pyodide), so running code needs no server round-trip; process events are batched every 10 s; the workspace stays usable on a 3G connection |
| NFR-04 | Reliability | Work autosaves every 10 s and on every run; a dropped connection never loses work; AI calls retry on transient errors (from prototype) |
| NFR-05 | Security | Hidden test cases and answer keys never reach the browser; API keys stay server-side; role checks on every endpoint; students can't see other students' work |
| NFR-06 | Integrity of logs | Process events are timestamped by the server on receipt and stored append-only, so a student can't edit their own history |
| NFR-07 | Performance | Ustaad replies in under 5 s at the 90th percentile; the teacher report loads in under 3 s |
| NFR-08 | Accessibility | WCAG AA contrast and keyboard navigation (from prototype); viva timers can be extended per student for documented disabilities |
| NFR-09 | Language | Ustaad answers in Roman Urdu + English, matching the student (from prototype); UI in English with Urdu labels for key actions |
| NFR-10 | Cost | One graded submission with a 5-question viva uses a handful of calls to a low-cost model (Gemini Flash-Lite in the prototype); estimate and show cost per student per term in the pitch after measuring it during testing |
| NFR-11 | Learnability | A first-time student completes a submission and viva without instructions in under 5 minutes (test with 5 students) |

## Interface and interaction design

**Goal: anyone who opens Socratic AI should understand within five seconds where they are, what they can do, and what happens next — without reading a feature list.** The prototype falls short of this: its top menu mixes product screens with project documents ("Norman HCI", "Requirements"), it uses 49 extra-small text labels, and its main screen shows setup controls, editor, output and chat at once on a 12-column grid, so a newcomer can't tell where to start.

The redesign follows three of the most widely used references in human-computer interaction:

- **Don Norman, *The Design of Everyday Things*** (revised edition, 2013) — discoverability, affordances, signifiers, constraints, mapping, feedback and conceptual models. The prototype already borrows Norman's seven stages of action, so this keeps one consistent story.
- **Jakob Nielsen's 10 usability heuristics** (Nielsen Norman Group, last reviewed January 2024).
- **Ben Shneiderman's Eight Golden Rules**, from *Designing the User Interface* (6th edition, 2016).

### How each principle shapes the product

| Principle (source) | Applied in Socratic AI |
| --- | --- |
| **Conceptual model and discoverability** (Norman) | Every assignment is shown as a five-step journey: **Understand → Write → Run → Explain → Submit + viva**. The stepper is always on screen, so students see the whole process — including the viva — before they start. It explains what the platform does without listing features. |
| **Signifiers** (Norman) | One primary button per screen, labelled with a verb: "Run my code", "Start viva", "Submit". Locked steps show a dashed outline and say why ("Run your code first"). |
| **Mapping** (Norman) | Steps run left to right in the order of work; output sits directly under the code that produced it; Ustaad sits beside the work it talks about. |
| **Feedback / visibility of system status** (Norman; Nielsen 1; Shneiderman 3) | "Saved 3 s ago"; a clear result banner after each run; a visible timer ring during the viva; the teacher sees a count of new submissions on their home screen. |
| **Constraints / error prevention** (Norman; Nielsen 5; Shneiderman 5) | Paste is blocked with an explanation at the point of action ("Paste is off: type your answer"), never silently. Submit stays disabled until the code has run. A confirmation warns that the viva can't be paused. |
| **Match with the real world** (Nielsen 2) | Words from Pakistani classrooms: Course, Assignment, Marks, Viva, Due date. No internal jargon such as "Norman stage 6" in the student view. |
| **Recognition rather than recall** (Nielsen 6; Shneiderman 8) | The assignment's rules appear as chips at the top (Due Fri 11:59 PM · Paste off · Viva: 3 Qs); the task brief is one click away on every step. |
| **Minimalist design** (Nielsen 8) | Remove "Norman HCI" and "Requirements" from the product menu (they belong in the pitch deck). Advanced teacher rules sit behind "More rules" (progressive disclosure). |
| **Closure** (Shneiderman 4) | A clear end screen: "Submitted ✓ · Viva score 82 · Your teacher will review it." |
| **User control and reversal** (Nielsen 3; Shneiderman 6, 7) | Undo in the editor; teachers save assignments as drafts and can "Preview as student" before publishing. |
| **Consistency** (Nielsen 4; Shneiderman 1) | One colour meaning everywhere: blue = action, green = done, amber = needs attention, grey = locked or upcoming. Always paired with an icon and words, never colour alone. |
| **Universal usability** (Shneiderman 2) | 16 px body text, 44 px minimum tap targets, WCAG AA contrast, keyboard navigation, Roman Urdu support, works on laptops and tablets. |
| **Help and documentation** (Nielsen 10) | A three-card first-run tour per role, and empty states that teach ("No assignments yet — create your first one in about 2 minutes"). |

### Student workspace

&#91;embedded content: Student workspace wireframe · journey stepper, rules chips, one primary action\]

The student always sees their position in the journey, the rules that apply, and exactly one highlighted next action. Each step changes only the right-hand panel and the primary button: Run shows output, Explain opens Ustaad's questions, and Submit opens the viva.

### Screen list

| Screen | Role | What it must make obvious at first look |
| --- | --- | --- |
| Home | Student | Courses as cards, each showing the next assignment, its due date and a status chip (Not started / In progress / Submitted / Graded) |
| Workspace | Student | The five-step journey, the rules chips, one primary action (wireframe above) |
| Viva | Student | One question at a time, progress dots (1 of 3), a timer ring, a large answer box; nothing else on screen |
| Results | Student | Marks, test results, viva score and Ustaad's "what to revise next" |
| Home | Teacher | Courses with "needs attention" counts (new submissions, flagged work) and a single "Create assignment" button |
| Assignment builder | Teacher | A three-step wizard: **Task → Rules → Preview as student**. Each rule is a toggle card explained in one plain sentence ("Block paste — students must type their answer") |
| Submissions | Teacher | One row per student with status, test score, viva score and flag chips; sortable so flagged work rises to the top |
| Integrity report | Teacher | The replay timeline with coloured markers (runs, errors, paste attempts, focus loss), the viva transcript, and two clear decisions: "Looks fine" or "Talk to student" |

### Visual design system

- **Components:** Tailwind (already in the prototype) with shadcn/ui, which is built on accessible Radix primitives, so dialogs, tabs and toggles behave correctly with keyboard and screen readers.
- **Type:** Inter for English, Noto Nastaliq Urdu for Urdu labels; 16 px body, 14 px secondary, nothing below 12 px.
- **Layout:** generous white space, cards with clear headings, a maximum of three regions per screen.
- **Motion:** the prototype's `motion` library only for feedback (step completed, result appeared), never decoration.

### Testing the interface (Thursday afternoon)

- **Five-second test** with 5 students and 1 teacher: show a screen for five seconds, then ask "What is this page for, and what would you do first?"
- **First-click test:** "Submit your assignment" — is the first click correct?
- **Target:** a first-time student reaches their first code run in under 60 seconds with no instructions. Put the result on a slide; it is direct evidence for the UI/UX criterion.

## A lived-in demo platform

**When a judge opens the live link, Socratic AI should look like a platform a real department has used for half a term, not a blank demo.** The prototype starts with a name box and a list of sample tasks; the deployed version opens on a populated institution with courses, material, past submissions and teacher reports that anyone can explore.

### What is seeded

| Item | Amount | Detail |
| --- | --- | --- |
| Institution | 1 | A clearly fictional demo institution (for example "Pothohar Institute of Computing — Demo"); never a real university's name or logo |
| Teachers | 3 | Each with their own courses and a profile |
| Courses | 4 | CS-101 Programming Fundamentals (Python) · WEB-102 Web Development (JavaScript, HTML) · CS-201 Data Structures (Python) · ENG-101 Communication Skills (written and handwritten work) |
| Weekly modules | 6 per course | Week title, short lecture notes written by the team, an example, and links to the week's assignment and quiz |
| Assignments | 5–6 per course (about 22 total) | Pakistani-context tasks extending the prototype's set: chai bill splitter, cricket over tracker, rickshaw fare, load-shedding schedule, bus-route timetable, exam-result calculator; each with hidden tests and integrity rules |
| Quizzes | 2 per course | 8–10 questions each with variants |
| Students | 30 per course | Fictional names and initials avatars; no real people |
| Past submissions | About 400 | Mostly honest, some deliberately copied, each with a process timeline, viva transcript, scores, flags and teacher decisions |
| Announcements | 3–4 per course | Deadline reminders, a viva-policy note, a lab schedule |

### Making it believable and explorable

- **One-click demo logins** on the landing page: "Try as teacher" and "Try as student", plus the credentials in the README. The demo data resets every night, and a "Reset demo" button lets a judge start over.
- **Real process data, not invented timelines.** Team members record genuine sessions — some honest, some retyping ChatGPT answers — and the seed script reuses those recorded event logs across demo students, so every replay looks authentic.
- **Dates move with the calendar.** Deadlines are stored relative to today ("due in 3 days", "submitted last Tuesday"), so the platform never looks stale when a judge opens it in December.
- **Every screen has data, and one screen doesn't.** All seeded courses are full; one empty "New course" shows the creation flow and the teaching empty states.
- **No placeholder text anywhere:** no lorem ipsum, "test123" or "Student 1". Content is written by the team in plain English and Roman Urdu.
- **Repeatable seed script** (`seed.ts`) that rebuilds everything from scratch in under a minute, so a broken database before the finale is a one-command fix.

### Honesty rule for the pitch

Seeded activity is **demo data** and is labelled as such in the app (a small "Demo data" badge) and in the pitch. Only the honest-vs-copied test with real students on Thursday is presented as a result. Mixing the two would undermine the platform's whole message about authentic work.

**Who and when:** the research-and-pitch teammate writes course material, assignments and quiz questions Monday to Wednesday in parallel with the build; the back-end teammate writes the seed script on Wednesday; the team records the real sessions on Thursday morning, before the user test.

## System architecture

Students work in the browser, which also runs their code; the server stores the evidence, hides the answer keys and runs the viva through the AI model.

&#91;embedded content: Asal architecture · browser, server, AI model, database, teacher dashboard\]

The highlighted parts are new compared with the prototype: the integrity sensor batches events to the server every 10 seconds, the event log timestamps and stores them append-only, and the viva-and-report service turns code, output, events and viva answers into the teacher's integrity report.

**Suggested stack (extends the prototype):** React + Vite + Tailwind front end; Express (Node) API; Supabase for Postgres, authentication and image storage; Pyodide and sandboxed iframes for running code; Gemini Flash-Lite on Google's free tier (already wired in) for Ustaad, viva scoring and reading handwritten pages, with Groq's free tier as automatic fallback; Monaco or CodeMirror editor with paste interception; deployed on Vercel or Cloud Run.

### AI model decision

**Decided: Gemini Flash-Lite on the Google AI Studio free tier as the main model, Groq's free tier as automatic backup.** Both are free, so the team can test and record the demo without paying.

|  | Main: Gemini Flash-Lite | Backup: Groq |
| --- | --- | --- |
| Why | Already in the prototype; free of charge; handles structured JSON and Roman Urdu with English | Very fast replies (good on video); free speech-to-text (Whisper) for the voice viva stretch goal |
| Models | `gemini-3.1-flash-lite` (avoid the larger Flash models: Gemini 3.8 Flash's free tier allows only about 20 requests a day) | `openai/gpt-oss-120b` or `qwen3.8-27b` (about 30 requests per minute, 1,000 per day); `whisper-large-v3` |
| Limits | Not published; check the project's rate-limit page in AI Studio on Monday | Check console.groq.com limits page on Monday |
| Caution | Free-tier content is used to improve Google's products: use only demo data and team test sessions; move to the paid tier before real students use it | Limits apply per organisation |

**Implementation rules:**

1. One `llm.ts` provider layer; the provider is chosen by an environment variable, and any rate-limit (429) error from Gemini falls back to Groq automatically.
2. Separate API keys and projects for development and for the demo, so a week of testing doesn't use up demo-day quota.
3. Gemini's daily limit resets at midnight Pacific time, which is **1 PM in Pakistan**; avoid heavy testing on the morning of a recording or the finale.
4. The seed script generates viva transcripts and summaries once and stores them, so seeded demo data never calls the AI.
5. Record a backup video of the live demo in case the venue network or an API fails.
6. List both providers and all models in the README, as the rulebook requires.

## Data model

Ten tables cover the MVP; the event table is the one that makes Socratic AI different from an ordinary course portal.

| Entity | Key fields | Notes |
| --- | --- | --- |
| User | id, name, email, role (student / teacher) | Auth handled by Supabase |
| Course | id, teacher\_id, name, section, join\_code |  |
| Enrollment | course\_id, student\_id, joined\_at |  |
| Assignment | id, course\_id, type (code / written / handwritten / quiz), title, instructions, deadline, marks, language, starter\_code |  |
| IntegrityRules | assignment\_id, paste\_blocked, workflow (run\_first / explain\_first), viva\_questions, viva\_seconds\_per\_q, time\_limit, variants\_on, viva\_weight | One row per assignment |
| Variant | assignment\_id, student\_id, parameters (JSON), rendered\_prompt, hidden\_tests | Generated when the student opens the assignment |
| Submission | id, assignment\_id, student\_id, content (code / text / image URL), output, test\_results, submitted\_at, suggested\_grade, final\_grade, teacher\_comment |  |
| ProcessEvent | id, submission\_id, type (keys / delete / paste\_attempt / run / error / focus\_lost / focus\_back / fullscreen\_exit), payload (JSON), client\_time, server\_time | Append-only; server\_time set on receipt |
| VivaSession | submission\_id, questions and answers (JSON), per-question time, rubric scores, understanding\_score, summary |  |
| Flag | submission\_id, rule, evidence (event range), severity, teacher\_status (open / dismissed / followed up) | Flags are prompts for the teacher, never penalties |

## Hackathon MVP, demo and build plan

Scope the demo to **one CS-101 course** with three Python assignments, one handwritten assignment and one quiz. A narrow product that works flawlessly beats a wide one that breaks on stage.

**Demo script (about 2 minutes of the 5-minute pitch):**

1. **Teacher sets up:** Ma'am Sana creates the "Cricket Over Tracker" assignment with paste blocked, run-first workflow, a 3-question viva and variants on.
2. **Honest student:** types, runs, hits an error, fixes it, submits, and answers the viva well.
3. **Cheating student:** tries to paste ChatGPT code — blocked. Retypes it from a phone, submits a perfect answer, then freezes on the viva: "What prints if the list is empty?"
4. **Teacher report:** side by side, the honest student's messy replay and 85/100 viva versus the cheater's single error-free burst after a 3-minute focus loss and 20/100 viva, with a flag prompting a follow-up conversation.

**Roles for five people:**

1. **Lead / AI** — viva question generation and scoring, Ustaad prompts, report summary; drives Claude Code.
2. **Front end (student)** — workspace, paste interception, integrity sensor, camera capture, quiz player.
3. **Front end (teacher)** — course and assignment builder, replay timeline, gradebook.
4. **Back end** — Supabase schema, auth, event log, variants, autograder with hidden tests.
5. **Research, testing and pitch** — test with 5–10 real students and 1–2 teachers, measure viva accuracy, deck, video, README.

**Schedule: four build days, then two days only for the pitch.** Features freeze on Thursday night; Friday and Saturday are reserved for the demo video, deck, README and submission. Only bug fixes that break the demo are allowed after Thursday.

| Day | Focus | Goal | Done when |
| --- | --- | --- | --- |
| Mon Nov 23 | Build | Move the prototype into a public repo; Supabase schema and auth; CLAUDE.md spec; UI design system (colours, type, components) and the new screen layouts from the design section | Teacher and student can log in; course join works in the new UI |
| Tue Nov 24 | Build | Assignment builder with integrity rules; student workspace with the journey stepper; paste blocking; event logging | A teacher-made assignment opens in the workspace and logs events |
| Wed Nov 25 | Build | Automated viva at submission; hidden tests; per-student variants | A submission produces a viva score and test result |
| Thu Nov 26 | Build + test | Teacher report with replay and flags; run the honest-vs-copied test with 10 students and 1–2 teachers in the afternoon; fix what confuses them; **feature freeze at night** | Full honest-vs-cheater demo runs end to end; measured result recorded |
| Fri Nov 27 | Pitch | Write the 5-minute pitch script; record and edit the 2-minute demo video; seed clean demo data; record a backup run of the live demo | Video under 2:00 exported; demo data ready |
| Sat Nov 28 | Pitch + submit | Finish the deck; write the README (every API, library and model disclosed); rehearse; submit repo, live link, video and deck **by 8 PM** | Submission confirmed before the 11:59 PM deadline |
| Nov 29 – Dec 1 | Rehearse | Rehearse the pitch 10+ times; drill the Q&A answers; test the demo on the venue setup if possible | Pitch runs in 4:45 or less |

**Thursday is the riskiest day:** it holds both the last feature and the user test. If Wednesday's viva isn't working by Wednesday night, cut handwritten work and quizzes from the demo rather than squeezing Friday.

**The measurement that wins the technical score:** have 10 students each submit one honest solution and one copied from ChatGPT, then report how often the viva score and flags correctly separated them (for example, "the viva identified 17 of 20 copied submissions; no honest submission was flagged").

## Rubric fit and judge Q&A

Socratic AI's strongest card is viability: teachers already want this and already run vivas by hand, so the platform automates an existing practice rather than asking anyone to change.

| Criterion | Expected | How Socratic AI earns it |
| --- | --- | --- |
| Innovation & Creativity | High | Verifies learning through process evidence and an automated viva instead of guessing with AI detectors |
| Technical Execution | High | Real course system, in-browser code execution, event logging, AI-generated personalised vivas, and a measured honest-vs-copied result |
| Real-World Impact & Viability | High | Every university faces AI-written work; aligns with HEC's draft rule against detector-only punishment; teachers are motivated users |
| Presentation & UX | High | The honest-vs-cheater demo and the side-by-side replay are easy to follow and memorable |

**Questions judges will ask:**

| Question | Answer |
| --- | --- |
| "What if the student uses ChatGPT on a phone?" | We can't block a phone; we make it useless. Retyping shows in the replay, variants make shared answers wrong, and the timed viva on the student's own code decides most of the grade. |
| "Isn't this an AI detector? Those are unreliable." | No. We never judge whether text looks AI-written. We check whether the student understands their own work, and the teacher makes every decision. |
| "Isn't recording keystrokes invasive?" | Only graded work inside Socratic AI is recorded, students are told each time, only their teacher sees it, and logs are deleted after the term. No webcam. |
| "Can't AI answer the viva too?" | Questions are timed, paste-blocked and build on the previous answer, so outside help is too slow; low-scoring students also get a short in-person check. |
| "How is this different from Google Classroom, Moodle or Turnitin?" | They collect or check the final file. Socratic AI shows how the work was made and whether the student can explain it. |
| "Who would pay or adopt it?" | Universities and colleges, starting with CS departments, where AI copying is most visible; teachers can start free with one course. |
| "Did you build this during the hackathon?" | Yes. The Socratic AI core was started on Nov 22 and everything else was built Nov 23–28; the commit history shows it. |

**Limits we state openly (no web platform can solve these):**

- **Someone else does the work and the viva** while logged in as the student. There is no identity check without a webcam or ID verification; graded exams use lab mode with an invigilator, and flagged students get a short in-person viva.
- **AI overlay apps on the same computer**, which show answers in an invisible window (interview-cheating apps of this kind already exist). A website can't see other programs; lab mode and in-person checks cover this.
- **Long-term learning gains** need a full semester of data; the hackathon test only shows that the platform separates honest from copied work.
- **University-wide rollout** (LMS integration, IT setup, institutional approval) is roadmap, not hackathon scope.

**Partly covered, so prepare careful answers:** AI used live during the viva (timers and follow-ups slow it down; a voice viva helps more); false flags on honest students who draft elsewhere or freeze in the viva (flags are prompts, never penalties); fairness of AI viva scoring (fixed rubric, teacher override, agreement measured against a real teacher); students with only a phone (coding labs assume a laptop or lab computer).

## Open questions

- [ ] **Inspiration project:** add the link to the Claude hackathon project the team cited, credit it in the pitch and README, and list what Socratic AI adds beyond it.
- [ ] **Track:** confirm the team is registered under Track 1 (Education).
- [ ] **AI model:** decided — Gemini Flash-Lite on the free tier with Groq as automatic fallback (see AI model decision); both disclosed in the README.
- [ ] **Originality:** confirm when the Socratic AI prototype was started (files are dated Nov 22) and move it into a public repo so the commit history covers the build window.
- [ ] **Test users:** line up 10 students and 1–2 teachers for Nov 26–27 testing.

## Sources

- [HEC's new rules on student AI use won't work — Dawn, Aug 2026](https://www.dawn.com/news/2022115)
- [HEC makes AI course mandatory for all degree programmes from 2026 — Dawn](https://www.dawn.com/news/1974380)
- [HEC Framework on Generative AI — Higher Education Commission](https://www.hec.gov.pk//english/policies/Pages/Framework-GenAI.aspx)
- [AI detectors biased against non-native English writers — Stanford HAI](https://hai.stanford.edu/news/ai-detectors-biased-against-non-native-english-writers)
