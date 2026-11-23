/**
 * Gradebook (FR-24, FR-25): every student × every assignment, average viva per assignment, and who
 * is flagged for a conversation. Cells link to the integrity report. Exports to CSV.
 */
import { useEffect } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Download, Flag } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Button, Card, ErrorState, Skeleton, cx } from "../components/ui";
import { useApi } from "../lib/useApi";

interface Cell {
  submissionId: string;
  status: "in_progress" | "submitted" | "viva_in_progress" | "graded";
  grade: number | null;
  final: boolean;
  viva: number | null;
  flagged: boolean;
  decision: string | null;
}

interface Data {
  course: { id: string; code: string; name: string; section: string | null };
  assignments: { id: string; title: string; status: string; marks: number; handedIn: number; avgViva: number | null; flagged: number }[];
  students: { id: string; name: string; initials: string }[];
  cells: Record<string, Record<string, Cell>>;
  flaggedStudents: string[];
}

function csv(d: Data): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const head = ["Student", ...d.assignments.map((a) => `${a.title} (/${a.marks})`), ...d.assignments.map((a) => `${a.title} viva`)];
  const rows = d.students.map((s) => [
    s.name,
    ...d.assignments.map((a) => {
      const c = d.cells[s.id]?.[a.id];
      return c?.grade != null ? String(c.grade) : c ? (c.status === "in_progress" ? "in progress" : "viva pending") : "";
    }),
    ...d.assignments.map((a) => (d.cells[s.id]?.[a.id]?.viva != null ? String(d.cells[s.id]![a.id]!.viva) : "")),
  ]);
  return [head, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}

export function Gradebook() {
  const { id = "" } = useParams();
  const data = useApi<Data>(`/teacher/courses/${id}/gradebook`);
  const title = data.status === "ready" ? `${data.data.course.code} gradebook` : null;
  useEffect(() => {
    if (title) document.title = `${title} · Socratic AI`;
  }, [title]);

  const download = () => {
    if (data.status !== "ready") return;
    const blob = new Blob([csv(data.data)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${data.data.course.code}-gradebook.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <AppShell>
      <Link to={`/teacher/courses/${id}`} className="mb-4 inline-flex items-center gap-1.5 font-medium text-action hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Back to the course
      </Link>
      {data.status === "loading" && <Skeleton className="h-96" />}
      {data.status === "error" && <ErrorState message={data.message} onRetry={data.reload} />}
      {data.status === "ready" && (
        <>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{data.data.course.code} · {data.data.course.name} gradebook</h1>
              <p className="mt-1 text-ink-3">Suggested marks combine hidden tests and the viva, using each assignment's weighting. Confirm or change any mark in its report.</p>
            </div>
            <Button variant="secondary" icon={Download} onClick={download}>Download CSV</Button>
          </div>

          {data.data.flaggedStudents.length > 0 && (
            <Card className="mb-5 flex flex-wrap items-center gap-2 border-attention-line bg-attention-soft p-4">
              <Flag className="size-5 text-attention" aria-hidden />
              <span className="font-medium">Worth a conversation:</span>
              <span>{data.data.flaggedStudents.join(", ")}</span>
            </Card>
          )}

          {data.data.assignments.length === 0 ? (
            <Card className="p-8 text-center text-ink-3">No published assignments yet. Marks appear here as students submit.</Card>
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-line">
                  <tr>
                    <th scope="col" className="sticky left-0 bg-surface px-4 py-3 font-semibold">Student</th>
                    {data.data.assignments.map((a) => (
                      <th key={a.id} scope="col" className="px-3 py-3 align-bottom font-semibold">
                        <Link to={`/teacher/assignments/${a.id}`} className="hover:text-action">{a.title}</Link>
                        <span className="block text-xs font-normal text-ink-3">
                          {a.handedIn} in · avg viva {a.avgViva ?? "–"}{a.flagged ? ` · ${a.flagged} flagged` : ""}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.data.students.map((s) => (
                    <tr key={s.id}>
                      <th scope="row" className="sticky left-0 bg-surface px-4 py-2.5 font-medium">{s.name}</th>
                      {data.data.assignments.map((a) => {
                        const c = data.data.cells[s.id]?.[a.id];
                        return (
                          <td key={a.id} className="px-3 py-2.5 tabular-nums">
                            {!c ? (
                              <span className="text-ink-3">–</span>
                            ) : c.status === "submitted" || c.status === "graded" ? (
                              <Link to={`/teacher/submissions/${c.submissionId}`} className={cx("inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-action-soft", c.flagged && "bg-attention-soft text-attention")}>
                                {c.flagged && <Flag className="size-3.5" aria-label="Flagged" />}
                                <span className={c.final ? "font-semibold" : ""}>{c.grade ?? "–"}</span>
                                <span className="text-ink-3">/{a.marks}</span>
                              </Link>
                            ) : (
                              <span className="text-ink-3">{c.status === "in_progress" ? "working" : "viva pending"}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
          <p className="mt-3 text-sm text-ink-3">Bold marks are confirmed by you; others are suggested. Flagged cells are worth a look, never proof.</p>
        </>
      )}
    </AppShell>
  );
}
