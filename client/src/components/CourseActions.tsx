/** "New course" for teachers and "Join a course" for students (FR-02, FR-03). */
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, Copy, KeyRound, Plus } from "lucide-react";
import { Dialog } from "./Dialog";
import { Button, Card } from "./ui";
import { api, ApiError } from "../lib/api";

const field = "min-h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-[15px] focus:border-action focus:outline-none";

export function NewCourseButton({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [section, setSection] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; joinCode: string } | null>(null);
  const navigate = useNavigate();

  const close = () => {
    setOpen(false);
    if (created) onCreated();
    setCreated(null);
    setCode("");
    setName("");
    setSection("");
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ id: string; joinCode: string }>("/courses", { body: { code, name, section: section || undefined } });
      setCreated(r);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create the course.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="secondary" icon={Plus} onClick={() => setOpen(true)}>New course</Button>
      <Dialog open={open} title={created ? "Course created" : "Create a course"} onClose={close}>
        {created ? (
          <div>
            <p className="flex items-center gap-2 text-done"><CheckCircle2 className="size-5" aria-hidden /> Share this join code with your students:</p>
            <p className="my-4 text-center font-mono text-4xl font-bold tracking-[0.3em]">{created.joinCode}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" icon={Copy} onClick={() => void navigator.clipboard?.writeText(created.joinCode)}>Copy code</Button>
              <Button onClick={() => { close(); navigate(`/teacher/courses/${created.id}`); }}>Open the course</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Code</span>
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CS-102" required minLength={2} maxLength={20} className={field} data-autofocus />
              </label>
              <label className="col-span-2 block">
                <span className="mb-1 block text-sm font-semibold">Name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Object-Oriented Programming" required minLength={2} maxLength={120} className={field} />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Section (optional)</span>
              <input value={section} onChange={(e) => setSection(e.target.value)} placeholder="Section A" maxLength={60} className={field} />
            </label>
            <p className="text-sm text-ink-3">You'll get a 6-character join code to share with your students.</p>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" type="button" onClick={close}>Cancel</Button>
              <Button type="submit" loading={busy}>Create course</Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}

export function JoinCourseCard({ onJoined }: { onJoined: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ code: string; name: string }>("/courses/join", { body: { code } });
      setMsg({ ok: true, text: `You've joined ${r.code} · ${r.name}.` });
      setCode("");
      onJoined();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : "Couldn't join. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <label className="block flex-1">
          <span className="mb-1 flex items-center gap-2 font-semibold"><KeyRound className="size-4 text-ink-3" aria-hidden /> Join a course</span>
          <span className="mb-2 block text-sm text-ink-3">Enter the 6-character code your teacher gave you.</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
            placeholder="PKC7HA"
            aria-label="Course join code"
            className={`${field} max-w-48 font-mono tracking-widest uppercase`}
          />
        </label>
        <Button type="submit" loading={busy} disabled={code.length !== 6}>Join course</Button>
      </form>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`mt-3 text-sm ${msg.ok ? "text-done" : "text-danger"}`}>{msg.text}</p>}
    </Card>
  );
}
