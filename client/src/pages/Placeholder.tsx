import { useEffect } from "react";
import { Link } from "react-router";
import { ArrowLeft, Hammer } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { EmptyState } from "../components/ui";
import { useMe } from "../lib/session";
import { useRunnerStatus } from "../runner/runner";

/** Temporary screen for routes under construction this week. Never shipped at submission. */
export function Placeholder({ title }: { title: string }) {
  const me = useMe();
  const runner = useRunnerStatus();
  useEffect(() => {
    document.title = `${title} · Socratic AI`;
  }, [title]);
  return (
    <AppShell>
      <Link to={me.role === "teacher" ? "/teacher" : "/student"} className="mb-6 inline-flex items-center gap-1.5 font-medium text-action hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Back to my courses
      </Link>
      <EmptyState icon={Hammer} title={`${title} is being built`} body="This screen is next on the build list." />
      {me.role === "student" && (
        <p className="mt-4 text-center text-sm text-ink-3" role="status">
          Code runner: {runner === "ready" ? "ready" : runner === "error" ? "couldn't load" : "preparing…"}
        </p>
      )}
    </AppShell>
  );
}
