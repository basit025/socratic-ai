# Socratic AI: Strong Fundamentals in the Age of AI

**Live demo: https://socratic-ai-pk.vercel.app** · Health check: [`/api/health`](https://socratic-ai-pk.vercel.app/api/health)

> Status: build in progress (Capital Youth Expo 2026 Hackathon, competition 04-HK, Track 1: Education). Built Nov 16–28, 2026.

Socratic AI is a web-based learning platform where students do assignments and coding labs in one workspace. The workspace records how the work was made, and the AI mentor **Ustaad** then runs a short, timed viva on the student's own work. Teachers get an integrity report: the work, a process replay, flags (evidence, never verdicts) and a viva understanding score.

*We can't stop a student from asking AI. We make sure they can't get marks for work they don't understand.*

## Deployment

**How it's hosted:** a single Vercel project (Hobby plan) plus Supabase (free plan).

- Vercel builds the Vite/React front end (`client/`) and serves it from its CDN.
- The Express API (`server/app.ts`) runs as **one Vercel Function** (`api/index.ts`). `vercel.json` rewrites `/api/*` to it, and every other path serves the React app.
- Functions run in Mumbai (`bom1`), next to the Supabase database.
- Supabase provides Postgres and authentication.
- Student code runs in the browser (Pyodide/WebAssembly), so running code needs no server time.
- Every push to `main` deploys to production; every pull request gets its own preview URL.
- A daily Vercel Cron job (`/api/cron/reset-demo`, 03:00 PKT) clears expired demo sandboxes and is protected by a secret.

**Run it locally** (Node 22):

```bash
npm install
cp .env.example .env.local   # fill in the keys you have; the app runs without them
npm run dev                  # http://localhost:3000 and http://localhost:3000/api/health
npm run lint && npm test && npm run build
```

`GET /api/health` reports whether the database, Gemini, Groq and OpenRouter are reachable, without making a model call.

## Third-party APIs and libraries

Every external service, model and library used in this repository is listed here, as the competition rules require.

| Name | What we use it for | Licence / terms |
| --- | --- | --- |
| [Vercel](https://vercel.com) | Hosting: CDN for the front end, a serverless function for the API, cron | Hobby plan |
| [Supabase](https://supabase.com) | Postgres database and authentication | Free plan |
| [Google Gemini API](https://ai.google.dev) (`gemini-3.1-flash-lite`) | Primary AI model for Ustaad and the viva | Google AI Studio free tier |
| [Groq API](https://groq.com) (`openai/gpt-oss-120b`) | First automatic fallback AI model | Groq free tier |
| [OpenRouter](https://openrouter.ai) | Second automatic fallback AI model (model set in `OPENROUTER_MODEL`) | OpenRouter terms; free or credit-based models |
| [React](https://react.dev) 19 | User interface | MIT |
| [Vite](https://vite.dev) + `@vitejs/plugin-react` | Front-end build and dev server | MIT |
| [Express](https://expressjs.com) 5 | API server | MIT |
| [TypeScript](https://www.typescriptlang.org) | Type checking | Apache-2.0 |
| [tsx](https://tsx.is) | Runs TypeScript in local development | MIT |
| [Vitest](https://vitest.dev) | Unit tests | MIT |
| [Zod](https://zod.dev) | Validates process events and AI responses | MIT |
| [Tailwind CSS](https://tailwindcss.com) 4 | Styling and design tokens | MIT |
| [React Router](https://reactrouter.com) | Page routing | MIT |
| [Lucide](https://lucide.dev) (`lucide-react`) | Icons | ISC |
| [Pyodide](https://pyodide.org) (loaded from the jsDelivr CDN) | Runs students' Python in the browser, inside a Web Worker | MPL-2.0 |
| [Inter](https://rsms.me/inter/) and [JetBrains Mono](https://www.jetbrains.com/lp/mono/) (Google Fonts) | Interface and code fonts | SIL Open Font License |
| [Puppeteer](https://pptr.dev) (`puppeteer-core`) | Browser smoke tests (development only) | Apache-2.0 |
| [Supabase CLI](https://supabase.com/docs/guides/cli) | Applies database migrations (development tool, run with `npx`) | MIT |

### AI coding assistants

The rules allow AI coding assistants as long as they are disclosed. We use:

- **Claude Code** (Anthropic): coding assistant during the build.
- **Google AI Studio**: the team's first prototype (Ustaad mentor, in-browser code runner, report) was generated in AI Studio on Nov 22, 2026, inside the build window. It will be added to this repository as its own commit so the history shows exactly what came from it.

## Team

Five students; names, roles and institutions to be added.
