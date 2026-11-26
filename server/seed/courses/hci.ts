/** CS-381 Human-Computer Interaction: written by the team from their own lecture slides (Dix, Finlay, Abowd & Beale, chapters 1–4). */
import { closed, draft, open, quiz, weeks, written, type CoursePack } from "./kit.js";

const C = "cs381";

export const hci: CoursePack = {
  course: { key: C, teacher: "sana", code: "CS-381", name: "Human-Computer Interaction", section: "Section A", term: "Fall 2026", joinCode: "HCI2MB", students: [] },
  modules: weeks(C, [
    ["The human: senses and movement", `
### The human as an information processor
Input through the senses, processing and memory, output through movement. Design has to fit all three.

### Vision
- We see **size and depth** using cues (overlap, familiar size), so illusions like **Müller-Lyer** and **Ponzo** fool us: identical lines look different lengths.
- Reading: we recognise word *shapes*; ALL CAPS and long lines slow us down. Contrast and font size matter more on cheap phone screens in sunlight.
- About 8% of men have some colour-blindness, so **never use colour alone** to carry meaning.

### Hearing, touch and movement
- Sound alerts work without looking, but can't be private in a shared room.
- Touch (haptics) confirms a button press on a phone.
- **Fitts' law**: the time to hit a target grows with distance and shrinks with target size. Big, close buttons are faster, which is why tap targets should be at least ~44 px.
`],
    ["The human: memory and reasoning", `
### Three kinds of memory
| Memory | Capacity | Lasts |
| --- | --- | --- |
| Sensory (iconic, echoic, haptic) | large | under a second |
| Short-term (working) | about **7 ± 2** chunks | ~20 seconds without rehearsal |
| Long-term | practically unlimited | years |

### Chunking
\`03001234567\` is hard to hold; **0300-123-4567** is three chunks. Interfaces should group information the same way (card numbers in fours, OTPs in threes).

### Recognition beats recall
Choosing from a menu (recognition) is easier than typing a command from memory (recall). That's why GUIs replaced command lines for most people.

### Reasoning and errors
People reason by analogy and use shortcuts, so design for the mental model users bring, not the one the programmer has.
`],
    ["The computer: devices for interaction", `
### Text entry
- **QWERTY** was designed to stop mechanical typewriters jamming, not for speed; **Dvorak** is faster but rarely used because habits are expensive to change.
- **Phone keypads and T9** predicted words from number keys; today's on-screen keyboards predict and autocorrect, including for Roman Urdu.
- **Handwriting and speech recognition** are natural but error-prone, and speech has privacy and noise problems.

### Pointing
Mouse, touchpad, touchscreen, stylus, eye-gaze. Touch is direct but the finger hides what it touches (the *fat finger* problem).

### Output and the whole system
Screen size, resolution and refresh, but also **network speed and processing**: a slow response feels like a broken interface, so show feedback within ~0.1 s and progress for anything over ~1 s.
`],
    ["The interaction: Norman's model", `
### Seven stages of action
1. Form the **goal**. 2. Form the **intention**. 3. **Specify** the action. 4. **Execute** it. 5. **Perceive** the system state. 6. **Interpret** it. 7. **Evaluate** against the goal.

### Two gulfs
- **Gulf of execution**: the gap between what the user wants to do and the actions the system allows. *"How do I send money to this number?"*
- **Gulf of evaluation**: the gap between the system's state and the user's ability to understand it. *"Did my payment go through or not?"*

> Good design narrows both: visible, well-labelled controls (execution) and clear, immediate feedback (evaluation).

### Example
A student wants to submit an assignment (goal). The button says only "OK" (wide execution gulf). After clicking, nothing changes on screen (wide evaluation gulf). Fix: "Submit (you can't edit after this)" and a confirmation message.
`],
    ["Human error and interaction frameworks", `
### Slips and mistakes
- **Slip**: the right intention, wrong execution (typing 5000 instead of 500, tapping the wrong button). Fix with better layout, larger targets, confirmations and undo.
- **Mistake**: the wrong intention, from a wrong mental model (thinking "Save" also submits). Fix by making the system's model visible.

### Abowd and Beale's framework
Four parts, **User**, **Input**, **System**, **Output**, linked by four translations: articulation, performance, presentation, observation. Problems can be located on a specific translation.

### Ergonomics
The physical side: arrangement of controls, posture, lighting, health (eye strain, RSI), and **colour conventions** (red for stop or danger, green for go), which can differ across cultures.
`],
    ["Usability principles", `
### Three groups of principles
| Group | Means | Examples |
| --- | --- | --- |
| **Learnability** | New users can start quickly | predictability, familiarity, consistency, generalizability |
| **Flexibility** | Many ways to do things | user choice, customization, substitutivity (type or pick a date) |
| **Robustness** | Support for success and recovery | observability, recoverability (undo), responsiveness, task conformance |

### Using them
A good review names the principle, describes the problem and its effect on the user, and suggests a fix:

> *Recoverability*: the fee voucher form clears every field after one wrong CNIC digit, so students retype everything. Keep valid fields and highlight only the wrong one.
`],
    ["Paradigms of interaction", `
### How interaction has changed
Batch processing → **time-sharing** → video displays → **personal computing** → **windows (WIMP)** → **direct manipulation** → hypertext and the web → ubiquitous and mobile computing → conversational AI.

### Key ideas
- **Metaphors** (desktop, folder, shopping cart) borrow knowledge from the real world, but break when stretched too far.
- **Direct manipulation** (Shneiderman): visible objects, rapid reversible actions, immediate feedback, as in dragging a file to a folder.
- **Language vs. action**: typing a command (language) vs. doing it on screen (action). Chat-based AI brings language back as an interface.

> Each new paradigm keeps the best of the last. A good course platform uses direct manipulation for navigation and language (an AI mentor) for help.
`],
  ]),
  assignments: [
    written({
      key: "hci-chunking", course: C, week: 2, title: "Chunking and Memory in a Mobile Wallet", ...closed(4), marks: 10,
      instructions: "Open a mobile wallet or banking app you use (or recall one clearly).\n\nIn **150–250 words**:\n1. Find **two** places where the design helps short-term memory (chunking, recognition instead of recall) and **one** place where it overloads it.\n2. For the overload, say what the user has to hold in mind and for how long.\n3. Propose a redesign that uses chunking or recognition, and explain it with the 7 ± 2 idea.",
    }),
    written({
      key: "hci-gulfs", course: C, week: 4, title: "Gulfs of Execution and Evaluation in a Real App", ...closed(2), marks: 10,
      instructions: "Choose a task in a real Pakistani app or website (paying a utility bill, booking a ride, checking a result, registering a SIM).\n\nIn **150–250 words**:\n1. Walk through Norman's **seven stages** for the task in one line each.\n2. Identify one **gulf of execution** and one **gulf of evaluation**, with what the user sees on screen.\n3. Suggest one design change for each gulf.",
    }),
    quiz({
      key: "hci-quiz", course: C, week: 5, title: "Quiz: The Human and the Interaction", ...open(3, 2), marks: 10,
      instructions: "A short timed quiz on weeks 1–5. One question at a time; you can't go back.",
      quiz: {
        draw: 6, timeLimitMinutes: 6, fullscreen: true,
        questions: [
          { kind: "mcq", prompt: "Roughly how many chunks can short-term memory hold?", options: ["3 ± 1", "7 ± 2", "15 ± 3", "Unlimited"], correct: 1 },
          { kind: "mcq", prompt: "A user means to tap \"Send\" but taps \"Delete\" next to it. This is a:", options: ["Mistake", "Slip", "Gulf of evaluation", "Paradigm shift"], correct: 1 },
          { kind: "mcq", prompt: "A payment app shows no confirmation after paying. Which gulf is wide?", options: ["Execution", "Evaluation", "Neither", "Both equally"], correct: 1 },
          { kind: "mcq", prompt: "Fitts' law says pointing time decreases when the target is:", options: ["Farther and smaller", "Closer and larger", "Brightly coloured", "Animated"], correct: 1 },
          { kind: "mcq", prompt: "Why is recognition easier than recall?", options: ["It uses long-term memory only", "The options are visible, so the user only has to pick", "It is faster to type", "It needs no screen"], correct: 1 },
          { kind: "mcq", prompt: "\"Undo\" mainly supports which usability principle?", options: ["Learnability", "Flexibility", "Recoverability (robustness)", "Familiarity"], correct: 2 },
          { kind: "mcq", prompt: "In Abowd and Beale's framework, the four components are:", options: ["Goal, intention, action, evaluation", "User, input, system, output", "Sense, memory, reason, motor", "Batch, time-sharing, WIMP, web"], correct: 1 },
          { kind: "short", prompt: "Which illusion makes two equal lines look different because of arrow-shaped ends? (Name it.)", accepted: ["Müller-Lyer", "Muller-Lyer", "Mueller-Lyer", "muller lyer", "müller lyer"] },
          { kind: "short", prompt: "How many stages are in Norman's model of interaction? (A number.)", accepted: ["7", "seven"] },
        ],
      },
    }),
    written({
      key: "hci-review", course: C, week: 6, title: "Usability Review of a University Website", ...open(6, 1), marks: 10,
      instructions: "Review your university's (or any Pakistani university's) admissions or student portal page against the three groups of usability principles.\n\nIn **200–300 words**, report **three problems**, one each for **learnability**, **flexibility** and **robustness**. For each, give:\n- the principle it breaks,\n- what happens to a real student because of it,\n- a concrete fix.\n\nEnd with one thing the site does well, and which principle it shows.",
    }),
    written({
      key: "hci-paradigm", course: C, week: 7, title: "Is Chat the Next Paradigm?", ...draft(1), marks: 10,
      instructions: "In **150–250 words**, argue whether conversational AI (chatbots) is a new paradigm of interaction or a return to an old one. Compare it with command lines and with direct manipulation, using at least two of Shneiderman's direct-manipulation properties.",
    }),
  ],
  announcements: [
    { course: C, title: "Usability review is open", body: "Pick a real university website and review it against learnability, flexibility and robustness. Screenshots help you think, but describe what you saw in words: Ustaad's viva will ask about your examples.", postedDaysAgo: 1 },
    { course: C, title: "Quiz on chapters 1–3", body: "Six questions, six minutes: memory, Norman's model, slips and mistakes, and usability principles.", postedDaysAgo: 2 },
    { course: C, title: "This platform is a case study", body: "Notice how Socratic AI labels its buttons (\"Run my code\", \"Submit (you can't edit after this)\"). That's feedforward narrowing the gulf of execution. We'll discuss it in class.", postedDaysAgo: 5 },
  ],
};
