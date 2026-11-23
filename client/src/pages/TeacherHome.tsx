import { useEffect, useState } from "react";
import { Link } from "react-router";
import { BookOpen, Check, Copy, Flag, Inbox, Plus, Table2, Users } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { NewCourseButton } from "../components/CourseActions";
import { Card, Chip, EmptyState, ErrorState, PageHeader, Skeleton, Ur, type ChipTone } from "../components/ui";
import { firstName, formatDue, greeting } from "../lib/format";
import { useMe } from "../lib/session";
import { useApi } from "../lib/useApi";

interface TeacherAssignment {
  id: string;
  title: string;
  type: string;
  status: "draft" | "published" | "closed";
  dueAt: string | null;
  marks: number;
  submitted: number;
  toReview: number;
  flagged: number;
}

interface TeacherHomeData {
  name: string;
  courses: {
    id: string;
    code: string;
    name: string;
    section: string | null;
    term: string | null;
    joinCode: string;
    students: number;
    toReview: number;
    flagged: number;
    assignments: TeacherAssignment[];
  }[];
}

const statusChip: Record<TeacherAssignment["status"], { tone: ChipTone; label: string }> = {
  draft: { tone: "locked", label: "Draft" },
  published: { tone: "action", label: "Open" },
  closed: { tone: "locked", label: "Closed" },
};

function JoinCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard?.writeText(code).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-line px-3 font-mono text-sm hover:border-action"
      title="Students join your course with this code"
    >
      Join code <strong className="tracking-widest">{code}</strong>
      {copied ? <Check className="size-4 text-done" aria-label="Copied" /> : <Copy className="size-4 text-ink-3" aria-hidden />}
    </button>
  );
}

export function TeacherHome() {
  const me = useMe();
  const home = useApi<TeacherHomeData>("/teacher/home");

  useEffect(() => {
    document.title = "My courses · Socratic AI";
  }, []);

  const totals =
    home.status === "ready"
      ? home.data.courses.reduce((t, c) => ({ toReview: t.toReview + c.toReview, flagged: t.flagged + c.flagged }), { toReview: 0, flagged: 0 })
      : null;

  return (
    <AppShell>
      <PageHeader
        title={`${greeting()}, ${firstName(me.name)}`}
        subtitle="Your courses, what needs your attention, and every assignment's integrity report."
        action={
          <div className="flex flex-wrap items-center gap-2">
          <NewCourseButton onCreated={home.reload} />
          <Link to="/teacher/assignments/new" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-action px-4 font-semibold text-white hover:bg-action-hover">
            <Plus className="size-5" aria-hidden />
            Create assignment <Ur>اسائنمنٹ بنائیں</Ur>
          </Link>
          </div>
        }
      />

      {home.status === "loading" && (
        <div className="space-y-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-64" />
        </div>
      )}
      {home.status === "error" && <ErrorState message={home.message} onRetry={home.reload} />}

      {home.status === "ready" && totals && (
        <>
          <div className="mb-8 grid gap-3 sm:grid-cols-2">
            <Card className="flex items-center gap-3 p-4">
              <Inbox className={totals.toReview ? "size-6 text-action" : "size-6 text-done"} aria-hidden />
              <p>
                <span className="block font-semibold">{totals.toReview ? `${totals.toReview} submissions to review` : "No submissions waiting"}</span>
                <span className="block text-sm text-ink-3">Handed in and finished their viva</span>
              </p>
            </Card>
            <Card className="flex items-center gap-3 p-4">
              <Flag className={totals.flagged ? "size-6 text-attention" : "size-6 text-done"} aria-hidden />
              <p>
                <span className="block font-semibold">{totals.flagged ? `${totals.flagged} flagged for a conversation` : "Nothing flagged"}</span>
                <span className="block text-sm text-ink-3">Evidence worth a look, never a verdict</span>
              </p>
            </Card>
          </div>

          {home.data.courses.length === 0 ? (
            <EmptyState icon={Users} title="No courses yet" body="Create your first course and share its join code with your students. It takes about a minute." action={<NewCourseButton onCreated={home.reload} />} />
          ) : (
            <div className="space-y-6">
              {home.data.courses.map((c) => (
                <Card key={c.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
                    <div>
                      <h2 className="text-lg font-semibold">
                        <Link to={`/teacher/courses/${c.id}`} className="hover:text-action">{c.code} · {c.name}</Link>
                      </h2>
                      <p className="text-sm text-ink-3">{[c.section, c.term, `${c.students} students`].filter(Boolean).join(" · ")}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/teacher/courses/${c.id}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-action hover:bg-action-soft"><BookOpen className="size-4" aria-hidden /> Course</Link>
                      <Link to={`/teacher/courses/${c.id}/gradebook`} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-action hover:bg-action-soft"><Table2 className="size-4" aria-hidden /> Gradebook</Link>
                      <JoinCode code={c.joinCode} />
                    </div>
                  </div>
                  {c.assignments.length === 0 ? (
                    <p className="px-5 py-6 text-ink-3">No assignments yet. Create the first one in about 2 minutes.</p>
                  ) : (
                    <ul className="divide-y divide-line">
                      {c.assignments.map((a) => (
                        <li key={a.id}>
                          <Link to={`/teacher/assignments/${a.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-canvas">
                            <span>
                              <span className="block font-medium">{a.title}</span>
                              <span className="block text-sm text-ink-3">
                                {a.status === "draft" ? "Not visible to students yet" : formatDue(a.dueAt, a.status === "published")}
                              </span>
                            </span>
                            <span className="flex flex-wrap items-center gap-2">
                              {a.status !== "draft" && (
                                <span className="text-sm text-ink-3">
                                  {a.submitted}/{c.students} handed in
                                </span>
                              )}
                              {a.flagged > 0 && <Chip tone="attention" icon={Flag}>{a.flagged} flagged</Chip>}
                              <Chip tone={statusChip[a.status].tone}>{statusChip[a.status].label}</Chip>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
