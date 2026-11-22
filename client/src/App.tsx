import { useEffect, useState } from "react";

type Health = {
  status: "ok" | "degraded" | "down";
  checks: Record<"database" | "gemini" | "groq" | "openrouter", "ok" | "not_configured" | "error">;
};

// Hello-world landing (deploy check). Monday's design work replaces this with the real
// landing page: one sentence, the three-step visual, and "Try as teacher" / "Try as student".
export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json() as Promise<Health>)
      .then(setHealth)
      .catch(() => setFailed(true));
  }, []);

  return (
    <main className="page">
      <h1>Socratic AI</h1>
      <p className="tagline">Strong Fundamentals in the Age of AI</p>
      <p className="lead">
        A learning platform where students do their work in one workspace and the AI mentor Ustaad runs a
        short viva on each student's own work, so marks reflect what they understand.
      </p>
      <p className="status" role="status">
        {failed && "Server: not reachable"}
        {!failed && !health && "Checking the server…"}
        {health &&
          `Server: ${health.status} · database ${health.checks.database} · Gemini ${health.checks.gemini} · Groq ${health.checks.groq} · OpenRouter ${health.checks.openrouter}`}
      </p>
      <p className="note">Build in progress (Capital Youth Expo 2026, Track 1: Education).</p>
    </main>
  );
}
