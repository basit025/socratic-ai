/**
 * One assignment's submissions: a row per student, flagged work first. Tick two rows to compare
 * them side by side.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ArrowLeft, CheckCircle2, Columns2, Flag, Users } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Button, Card, Chip, EmptyState, ErrorState, Skeleton, type ChipTone } from "../components/ui";
import { formatDue } from "../lib/format";
import { useApi } from "../lib/useApi";

interface Row {
  student: { id: string; name: string; initials: string };
  submission: {
    id: string;
    status: "in_progress" | "submitted" | "viva_in_progress" | "graded";
    testsPassed: number | null;
    testsTotal: number | null;
    vivaScore: number | null;
    grade: number | null;
    decision: "looks_fine" | "talk_to_student" | null;
    openFlags: { rule: string; severity: "low" | "medium" | "high"; message: string }[];
  } | null;
}

interface Data {
  assignment: {
    id: string;
    title: string;
    status: "draft" | "published" | "closed";
    dueAt: string | null;
    marks: number;
    course: { code: string; name: string; section: string | null };
    rules: { pasteBlocked: boolean; vivaQuestions: number; vivaSecondsPerQ: number; vivaWeight: number; variantsOn: boolean } | null;
  };
  rows: Row[];
}

export function statusOf(r: Row): { tone: ChipTone; label: string } {
  const s = r.submission;
  if (!s) return { tone: "locked", label: "Not started" };
  if (s.status === "in_progress") return { tone: "attention", label: "Working on it" };
  if (s.status === "viva_in_progress") return { tone: "attention", label: "Viva not finished" };
  if (s.decision === "talk_to_student") return { tone: "attention", label: "Talk to student" };
  if (s.status === "graded") return { tone: "done", label: "Marked" };
  if (s.decision === "looks_fine") return { tone: "done", label: "Looks fine" };
  return { tone: "action", label: "Ready to review" };
}

export function TeacherAssignment() {
  const { id = "" } = useParams();
  const data = useApi<Data>(`/teacher/assignments/${id}`);
  const navigate = useNavigate();
  const [picked, setPicked] = useState<string[]>([]);
  const [params] = useSearchParams();
  const created = params.get("created");

  const title = data.status === "ready" ? data.data.assignment.title : null;
  useEffect(() => {
    if (title) document.title = `${title} · Submissions · Socratic AI`;
  }, [title]);

  const toggle = (sid: string) => setPicked((p) => (p.includes(sid) ? p.filter((x) => x !== sid) : [...p.slice(-1), sid]));

  return (
    <AppShell>
      <Link to="/teacher" className="mb-4 inline-flex items-center gap-1.5 font-medium text-action hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> My courses
      </Link>
      {data.status === "loading" && <Skeleton className="h-96" />}
      {data.status === "error" && <ErrorState message={data.message} onRetry={data.reload} />}
      {data.status === "ready" && (
        <>
          {created && (
            <Card className="mb-5 flex items-center gap-3 border-done-line bg-done-soft p-4" >
              <CheckCircle2 className="size-6 text-done" aria-hidden />
              <p className="font-medium text-done" role="status">
                {created === "published" ? "Published. Students in this course can see it now, and their work will appear below." : "Saved as a draft. Students can't see it yet."}
              </p>
            </Card>
          )}
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-ink-3">
                {data.data.assignment.course.code} · {data.data.assignment.course.name}
              </p>
              <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{data.data.assignment.title}</h1>
              <p className="mt-1 text-ink-3">
                {data.data.assignment.status === "draft" ? "Draft: not visible to students" : formatDue(data.data.assignment.dueAt, data.data.assignment.status === "published")}
                {data.data.assignment.rules && ` · Viva ${data.data.assignment.rules.vivaQuestions} questions, ${data.data.assignment.rules.vivaWeight}% of marks`}
                {data.data.assignment.rules?.pasteBlocked && " · Paste off"}
                {data.data.assignment.rules?.variantsOn && " · Variants on"}
              </p>
            </div>
            <Button icon={Columns2} disabled={picked.length !== 2} onClick={() => navigate(`/teacher/submissions/${picked[0]}?compare=${picked[1]}`)}>
              {picked.length === 2 ? "Compare side by side" : `Tick 2 students to compare (${picked.length}/2)`}
            </Button>
          </div>

          {data.data.rows.length === 0 ? (
            <EmptyState icon={Users} title="No students yet" body="Share the course join code. Students appear here as soon as they join." />
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="border-b border-line text-sm text-ink-3">
                  <tr>
                    <th className="w-12 px-4 py-3 font-medium"><span className="sr-only">Compare</span></th>
                    <th className="px-2 py-3 font-medium">Student</th>
                    <th className="px-2 py-3 font-medium">Status</th>
                    <th className="px-2 py-3 font-medium">Hidden tests</th>
                    <th className="px-2 py-3 font-medium">Viva</th>
                    <th className="px-2 py-3 font-medium">Flags</th>
                    <th className="px-4 py-3 text-right font-medium">Mark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.data.rows.map((r) => {
                    const st = statusOf(r);
                    const s = r.submission;
                    const reviewable = s && (s.status === "submitted" || s.status === "graded");
                    return (
                      <tr key={r.student.id} className={reviewable ? "cursor-pointer hover:bg-canvas" : ""} onClick={() => reviewable && navigate(`/teacher/submissions/${s.id}`)}>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          {reviewable && (
                            <input
                              type="checkbox"
                              checked={picked.includes(s.id)}
                              onChange={() => toggle(s.id)}
                              aria-label={`Compare ${r.student.name}`}
                              className="size-5 accent-[var(--color-action)]"
                            />
                          )}
                        </td>
                        <td className="px-2 py-3">
                          <span className="flex items-center gap-2.5">
                            <span aria-hidden className="flex size-8 items-center justify-center rounded-full bg-locked-soft text-xs font-semibold text-ink-2">
                              {r.student.initials}
                            </span>
                            {reviewable ? (
                              <Link to={`/teacher/submissions/${s.id}`} className="font-medium hover:text-action" onClick={(e) => e.stopPropagation()}>
                                {r.student.name}
                              </Link>
                            ) : (
                              <span className="font-medium">{r.student.name}</span>
                            )}
                          </span>
                        </td>
                        <td className="px-2 py-3"><Chip tone={st.tone}>{st.label}</Chip></td>
                        <td className="px-2 py-3 tabular-nums">{s?.testsTotal ? `${s.testsPassed}/${s.testsTotal}` : <span className="text-ink-3">–</span>}</td>
                        <td className="px-2 py-3 tabular-nums">
                          {s?.vivaScore != null ? <span className={s.vivaScore < 50 ? "font-semibold text-attention" : ""}>{s.vivaScore}/100</span> : <span className="text-ink-3">–</span>}
                        </td>
                        <td className="px-2 py-3">
                          {s && s.openFlags.length > 0 ? (
                            <span title={s.openFlags.map((f) => f.message).join("\n")}>
                              <Chip tone="attention" icon={Flag}>
                                {s.openFlags.length} to look at
                              </Chip>
                            </span>
                          ) : (
                            <span className="text-ink-3">–</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{s?.grade != null ? `${s.grade}/${data.data.assignment.marks}` : <span className="text-ink-3">–</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
          <p className="mt-3 text-sm text-ink-3">Flags are evidence to look at, never verdicts. Open a submission to see its replay and viva, then decide.</p>
        </>
      )}
    </AppShell>
  );
}
