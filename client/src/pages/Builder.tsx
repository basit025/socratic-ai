/**
 * Assignment builder: a three-step wizard, Task → Rules → Preview as student (progressive disclosure).
 * The teacher writes test INPUTS and a reference solution; expected answers are computed by running
 * that solution here, for every variant. Each rule is a toggle card explained in one plain sentence.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, ClipboardX, Eye, FlaskConical, Loader2, MessageCircleQuestion, Play, Plus, Shuffle, Sparkles, Timer, Trash2, XCircle } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Button, Card, Chip, ErrorState, Segmented, Skeleton, Toggle, cx } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { formatDue } from "../lib/format";
import { useApi } from "../lib/useApi";
import { runner, useRunnerStatus } from "../runner/runner";

interface Template {
  key: string;
  title: string;
  summary: string;
  instructions: string;
  starterCode: string;
  referenceSolution: string;
  tests: { name: string; call: string }[];
  variants: { param: string; options: string[]; fills: Record<string, Record<string, string>> } | null;
  marks: number;
}

interface BuilderData {
  courses: { id: string; code: string; name: string; section: string | null }[];
  templates: Template[];
}

type Step = 1 | 2 | 3;
type Checked = { status: "idle" } | { status: "checking" } | { status: "error"; message: string } | { status: "ok"; values: Record<string, string>[] }; // per test: option -> repr

const fill = (text: string, fills: Record<string, string> | undefined) => (fills ? text.replace(/\{([a-z_]+)\}/g, (m, k: string) => fills[k] ?? m) : text);

/** Default due date: 3 days from now at 11:59 PM, as a value for <input type="datetime-local">. */
function defaultDue(): string {
  const d = new Date(Date.now() + 3 * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T23:59`;
}

function Brief({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i} className="mb-2 last:mb-0">
          {para.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, j) =>
            part.startsWith("**") ? <strong key={j}>{part.slice(2, -2)}</strong> : part.startsWith("`") ? <code key={j} className="rounded bg-locked-soft px-1 py-0.5 font-mono text-[0.9em]">{part.slice(1, -1)}</code> : part,
          )}
        </p>
      ))}
    </>
  );
}

function RuleCard({ icon: Icon, title, sentence, children }: { icon: typeof ClipboardX; title: string; sentence: string; children: ReactNode }) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="flex max-w-xl gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-action-soft text-action"><Icon className="size-5" aria-hidden /></span>
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-[15px] text-ink-2">{sentence}</p>
        </div>
      </div>
      <div>{children}</div>
    </Card>
  );
}

const field = "w-full rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-[15px] focus:border-action focus:outline-none";
const mono = `${field} font-mono text-sm leading-6`;

export function Builder() {
  const data = useApi<BuilderData>("/teacher/builder");
  const navigate = useNavigate();
  const runnerStatus = useRunnerStatus();
  const [step, setStep] = useState<Step>(1);
  const [courseId, setCourseId] = useState("");
  const [templateKey, setTemplateKey] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [starterCode, setStarterCode] = useState("def solve():\n    pass\n");
  const [reference, setReference] = useState("");
  const [tests, setTests] = useState<{ name: string; call: string }[]>([{ name: "", call: "" }]);
  const [variants, setVariants] = useState<Template["variants"]>(null);
  const [marks, setMarks] = useState(10);
  const [due, setDue] = useState(defaultDue);
  const [checked, setChecked] = useState<Checked>({ status: "idle" });
  const [rules, setRules] = useState({ pasteBlocked: true, workflow: "run_first" as "run_first" | "explain_first", vivaQuestions: 3, vivaSecondsPerQ: 90, vivaWeight: 50, variantsOn: false });
  const [moreOpen, setMoreOpen] = useState(false);
  const [previewOption, setPreviewOption] = useState<string | null>(null);
  const [saving, setSaving] = useState<"draft" | "published" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Create assignment · Socratic AI";
    void runner.preload().catch(() => {});
  }, []);
  useEffect(() => {
    if (data.status === "ready" && !courseId && data.data.courses[0]) setCourseId(data.data.courses[0].id);
  }, [data, courseId]);

  const pickTemplate = (t: Template | null) => {
    setTemplateKey(t?.key ?? "scratch");
    setTitle(t?.title ?? "");
    setInstructions(t?.instructions ?? "");
    setStarterCode(t?.starterCode ?? "def solve():\n    # Write your function here\n    pass\n");
    setReference(t?.referenceSolution ?? "");
    setTests(t ? t.tests.map((x) => ({ ...x })) : [{ name: "", call: "" }]);
    setVariants(t?.variants ?? null);
    setMarks(t?.marks ?? 10);
    setRules((r) => ({ ...r, variantsOn: Boolean(t?.variants) }));
    setPreviewOption(t?.variants?.options[0] ?? null);
    setChecked({ status: "idle" });
  };

  const options = rules.variantsOn && variants ? variants.options : [null];
  const checkTests = async () => {
    setChecked({ status: "checking" });
    const valid = tests.filter((t) => t.name.trim() && t.call.trim());
    if (!reference.trim() || valid.length === 0) {
      setChecked({ status: "error", message: "Add your reference solution and at least one test." });
      return;
    }
    const perTest: Record<string, string>[] = valid.map(() => ({}));
    for (const opt of options) {
      const code = fill(reference, opt != null ? variants?.fills[opt] : undefined);
      const out = await runner.runTests(code, valid.map((t) => t.call));
      if (!out.ok) {
        setChecked({ status: "error", message: `Your reference solution doesn't run${opt ? ` for version "${opt}"` : ""}: ${out.error?.split("\n").at(-1) ?? "error"}` });
        return;
      }
      for (let i = 0; i < valid.length; i++) {
        const r = out.results[i];
        if (!r?.ok) {
          setChecked({ status: "error", message: `Test "${valid[i]!.name}" fails on your own solution${opt ? ` (version "${opt}")` : ""}: ${r?.error ?? "no result"}` });
          return;
        }
        perTest[i]![opt ?? "_"] = r.repr ?? "";
      }
    }
    setTests(valid);
    setChecked({ status: "ok", values: perTest });
  };

  // Editing anything the expected values depend on asks for a fresh check.
  useEffect(() => setChecked((c) => (c.status === "ok" || c.status === "error" ? { status: "idle" } : c)), [reference, tests.length, rules.variantsOn]);

  const taskReady = title.trim().length >= 2 && instructions.trim().length >= 10 && checked.status === "ok";
  const course = data.status === "ready" ? data.data.courses.find((c) => c.id === courseId) : undefined;

  const save = async (status: "draft" | "published") => {
    if (checked.status !== "ok") return;
    setSaving(status);
    setError(null);
    try {
      const payloadTests = tests.map((t, i) => {
        const vals = checked.values[i]!;
        const distinct = new Set(Object.values(vals));
        return { name: t.name.trim(), call: t.call.trim(), expected: rules.variantsOn && distinct.size > 1 ? vals : Object.values(vals)[0]! };
      });
      const r = await api<{ id: string }>("/teacher/assignments", {
        body: {
          courseId,
          title: title.trim(),
          instructions: instructions.trim(),
          starterCode,
          referenceSolution: reference,
          tests: payloadTests,
          variants: rules.variantsOn ? variants : null,
          marks,
          dueAt: new Date(due).toISOString(),
          status,
          rules,
        },
      });
      navigate(`/teacher/assignments/${r.id}?created=${status}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save the assignment.");
      setSaving(null);
    }
  };

  const vivaExample = useMemo(() => {
    const perfectTestsWeakViva = Math.round(marks * ((100 - rules.vivaWeight) + 0.2 * rules.vivaWeight) / 100 * 10) / 10;
    return `A student who passes every test but scores 20/100 in the viva gets ${perfectTestsWeakViva}/${marks}.`;
  }, [marks, rules.vivaWeight]);

  const steps = [
    { n: 1, label: "Task" },
    { n: 2, label: "Rules" },
    { n: 3, label: "Preview as student" },
  ] as const;

  return (
    <AppShell>
      <Link to="/teacher" className="mb-4 inline-flex items-center gap-1.5 font-medium text-action hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> My courses
      </Link>
      <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">Create an assignment</h1>
      <p className="mt-1 text-ink-3">Three short steps. Nothing is visible to students until you publish.</p>

      <ol className="mt-6 mb-6 flex flex-wrap items-center gap-2" aria-label="Builder steps">
        {steps.map((s, i) => (
          <li key={s.n} className="flex items-center gap-2" aria-current={step === s.n ? "step" : undefined}>
            <span className={cx("flex size-8 items-center justify-center rounded-full text-sm font-bold", step > s.n ? "bg-done text-white" : step === s.n ? "bg-action text-white" : "border border-line-strong text-ink-3")}>
              {step > s.n ? <Check className="size-4" aria-hidden /> : s.n}
            </span>
            <span className={cx("font-semibold", step === s.n ? "text-action" : step > s.n ? "text-done" : "text-ink-3")}>{s.label}</span>
            {i < steps.length - 1 && <span className="mx-1 h-px w-8 bg-line-strong sm:w-14" aria-hidden />}
          </li>
        ))}
      </ol>

      {data.status === "loading" && <Skeleton className="h-96" />}
      {data.status === "error" && <ErrorState message={data.message} onRetry={data.reload} />}

      {data.status === "ready" && step === 1 && (
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="font-semibold">Start from a template, or from scratch</h2>
            <p className="text-sm text-ink-3">Templates come with a task, starter code, a reference solution and tests. You can change everything.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.data.templates.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => pickTemplate(t)}
                  aria-pressed={templateKey === t.key}
                  className={cx("rounded-xl border-2 p-4 text-left transition-colors", templateKey === t.key ? "border-action bg-action-soft" : "border-line hover:border-action-line")}
                >
                  <span className="flex items-center justify-between gap-2 font-semibold">
                    {t.title}
                    {t.variants && <Shuffle className="size-4 text-ink-3" aria-label="Has variants" />}
                  </span>
                  <span className="mt-1 block text-sm text-ink-2">{t.summary}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => pickTemplate(null)}
                aria-pressed={templateKey === "scratch"}
                className={cx("flex items-center gap-2 rounded-xl border-2 border-dashed p-4 text-left font-semibold", templateKey === "scratch" ? "border-action bg-action-soft text-action" : "border-line-strong text-ink-2 hover:border-action-line")}
              >
                <Plus className="size-5" aria-hidden /> Start from scratch
              </button>
            </div>
          </Card>

          {templateKey && (
            <>
              <Card className="grid gap-4 p-5 lg:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold">Course</span>
                  <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={field}>
                    {data.data.courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {c.name}
                        {c.section ? ` (${c.section})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold">Title</span>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Cricket Over Tracker" className={field} />
                </label>
                <label className="block lg:col-span-2">
                  <span className="mb-1 block text-sm font-semibold">Task for students</span>
                  <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={5} className={field} />
                  <span className="mt-1 block text-xs text-ink-3">Use **bold** and `code`. {variants ? "Words in {braces} change for each version of the question." : ""}</span>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold">Starter code (students see this)</span>
                  <textarea value={starterCode} onChange={(e) => setStarterCode(e.target.value)} rows={8} spellCheck={false} className={mono} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold">Your reference solution (never shown to students)</span>
                  <textarea value={reference} onChange={(e) => setReference(e.target.value)} rows={8} spellCheck={false} className={mono} />
                </label>
                <div className="grid grid-cols-2 gap-4 lg:col-span-2 lg:grid-cols-4">
                  <label className="block">
                    <span className="mb-1 block text-sm font-semibold">Marks</span>
                    <input type="number" min={1} max={100} value={marks} onChange={(e) => setMarks(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} className={field} />
                  </label>
                  <label className="col-span-1 block lg:col-span-2">
                    <span className="mb-1 block text-sm font-semibold">Due</span>
                    <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className={field} />
                  </label>
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">Hidden tests</h2>
                    <p className="text-sm text-ink-3">Write each test as a call to the student's function. The expected answers come from running your solution, for every version.</p>
                  </div>
                  <Button variant="secondary" icon={checked.status === "checking" ? Loader2 : FlaskConical} onClick={checkTests} disabled={checked.status === "checking" || runnerStatus !== "ready"}>
                    {runnerStatus !== "ready" ? "Preparing the code runner…" : "Check tests against my solution"}
                  </Button>
                </div>
                <ul className="mt-4 space-y-2">
                  {tests.map((t, i) => (
                    <li key={i} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto] sm:items-center">
                      <input aria-label={`Test ${i + 1} name`} value={t.name} onChange={(e) => setTests(tests.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="What it checks, e.g. Empty over" className={field} />
                      <input aria-label={`Test ${i + 1} call`} value={t.call} onChange={(e) => setTests(tests.map((x, j) => (j === i ? { ...x, call: e.target.value } : x)))} placeholder="over_summary([])" spellCheck={false} className={mono} />
                      <div className="flex items-center gap-2">
                        {checked.status === "ok" && checked.values[i] && (
                          <code className="rounded bg-done-soft px-2 py-1 font-mono text-sm text-done" title="Expected answer from your solution">
                            {Object.entries(checked.values[i]!).map(([k, v]) => (k === "_" ? v : `${k}: ${v}`)).join(" · ")}
                          </code>
                        )}
                        <button type="button" onClick={() => setTests(tests.filter((_, j) => j !== i))} disabled={tests.length === 1} aria-label={`Remove test ${i + 1}`} className="flex size-10 items-center justify-center rounded-lg text-ink-3 hover:bg-danger-soft hover:text-danger disabled:opacity-30">
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <Button variant="ghost" icon={Plus} className="mt-2" onClick={() => setTests([...tests, { name: "", call: "" }])} disabled={tests.length >= 20}>
                  Add a test
                </Button>
                {checked.status === "ok" && (
                  <p className="mt-3 flex items-center gap-2 text-done" role="status"><CheckCircle2 className="size-5" aria-hidden /> All {tests.length} tests run on your solution. Expected answers saved.</p>
                )}
                {checked.status === "error" && (
                  <p className="mt-3 flex items-start gap-2 text-danger" role="alert"><XCircle className="mt-0.5 size-5 shrink-0" aria-hidden /> {checked.message}</p>
                )}
              </Card>

              <div className="flex justify-end">
                <Button size="lg" icon={ArrowRight} disabled={!taskReady} onClick={() => setStep(2)} title={taskReady ? undefined : "Add a title and task, then check your tests"}>
                  Next: set the rules
                </Button>
              </div>
              {!taskReady && <p className="text-right text-sm text-ink-3">To continue: add a title and task, then click "Check tests against my solution".</p>}
            </>
          )}
        </div>
      )}

      {data.status === "ready" && step === 2 && (
        <div className="space-y-3">
          <RuleCard icon={ClipboardX} title="Block paste" sentence="Students must type their answer. Paste attempts are blocked, explained to the student, and shown in your report.">
            <Toggle checked={rules.pasteBlocked} onChange={(v) => setRules({ ...rules, pasteBlocked: v })} label="Block paste" />
          </RuleCard>
          <RuleCard icon={Play} title="Order of work" sentence={rules.workflow === "run_first" ? "Run first: students run their code, then explain to Ustaad why it gives that output." : "Explain first: students explain their plan to Ustaad before Run unlocks."}>
            <Segmented label="Order of work" value={rules.workflow} onChange={(v) => setRules({ ...rules, workflow: v })} options={[{ value: "run_first", label: "Run first" }, { value: "explain_first", label: "Explain first" }]} />
          </RuleCard>
          <RuleCard icon={MessageCircleQuestion} title="Viva on their own code" sentence={rules.vivaQuestions ? `After submitting, Ustaad asks ${rules.vivaQuestions} timed questions about the student's own code, ${rules.vivaSecondsPerQ} seconds each.` : "No viva: marks come from the hidden tests only (not recommended)."}>
            <div className="flex flex-wrap items-center gap-2">
              <Segmented label="Viva questions" value={rules.vivaQuestions} onChange={(v) => setRules({ ...rules, vivaQuestions: v })} options={[{ value: 0, label: "Off" }, { value: 3, label: "3 Qs" }, { value: 4, label: "4 Qs" }, { value: 5, label: "5 Qs" }]} />
              {rules.vivaQuestions > 0 && <Segmented label="Seconds per question" value={rules.vivaSecondsPerQ} onChange={(v) => setRules({ ...rules, vivaSecondsPerQ: v })} options={[{ value: 60, label: "60 s" }, { value: 90, label: "90 s" }, { value: 120, label: "120 s" }]} />}
            </div>
          </RuleCard>
          {rules.vivaQuestions > 0 && (
            <RuleCard icon={Timer} title={`Viva counts for ${rules.vivaWeight}% of the marks`} sentence={vivaExample}>
              <input type="range" min={0} max={100} step={10} value={rules.vivaWeight} onChange={(e) => setRules({ ...rules, vivaWeight: Number(e.target.value) })} aria-label="Viva weight" className="w-48 accent-[var(--color-action)]" />
            </RuleCard>
          )}

          <button type="button" onClick={() => setMoreOpen(!moreOpen)} aria-expanded={moreOpen} className="flex min-h-11 items-center gap-2 font-semibold text-action">
            <ChevronDown className={cx("size-5 transition-transform", moreOpen && "rotate-180")} aria-hidden /> More rules
          </button>
          {moreOpen && (
            <RuleCard icon={Shuffle} title="A different version for each student" sentence={variants ? `Each student gets one of ${variants.options.length} versions (${variants.options.join(", ")}), so shared or online answers are wrong.` : "This task has no versions set up. Start from a template with versions to use this."}>
              <Toggle checked={rules.variantsOn} onChange={(v) => variants && setRules({ ...rules, variantsOn: v })} label="Variants" />
            </RuleCard>
          )}

          <div className="flex flex-wrap justify-between gap-3 pt-3">
            <Button variant="secondary" icon={ArrowLeft} onClick={() => setStep(1)}>Back to the task</Button>
            <Button size="lg" icon={Eye} onClick={() => setStep(3)} disabled={rules.variantsOn && checked.status !== "ok"}>Next: preview as student</Button>
          </div>
          {rules.variantsOn && checked.status !== "ok" && <p className="text-right text-sm text-attention">Versions changed the tests: go back and check them again.</p>}
        </div>
      )}

      {data.status === "ready" && step === 3 && (
        <div className="space-y-5">
          <Card className="border-action-line bg-action-soft/50 p-4">
            <p className="flex items-center gap-2 font-medium"><Eye className="size-5 text-action" aria-hidden /> This is what a student in {course?.code} will see.</p>
            {rules.variantsOn && variants && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-ink-2">Show version:</span>
                <Segmented label="Version" value={previewOption ?? variants.options[0]!} onChange={(v) => setPreviewOption(v)} options={variants.options.map((o) => ({ value: o, label: o }))} />
              </div>
            )}
          </Card>
          <Card className="p-6">
            <p className="text-sm font-medium text-ink-3">{course?.code} · {course?.name}</p>
            <h2 className="text-2xl font-bold">{title}</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              <li><Chip tone="attention">{formatDue(new Date(due).toISOString(), true)}</Chip></li>
              <li><Chip tone="locked" icon={null}>{marks} marks</Chip></li>
              {rules.pasteBlocked && <li><Chip tone="locked" icon={ClipboardX}>Paste is off</Chip></li>}
              {rules.vivaQuestions > 0 && <li><Chip tone="action" icon={Timer}>Viva: {rules.vivaQuestions} questions · {rules.vivaSecondsPerQ} s each</Chip></li>}
              {rules.variantsOn && <li><Chip tone="locked" icon={Shuffle}>Your own version of the question</Chip></li>}
            </ul>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 font-semibold">Your task</h3>
                <div className="text-[15px] leading-relaxed text-ink-2">
                  <Brief text={fill(instructions, rules.variantsOn && variants ? variants.fills[previewOption ?? variants.options[0]!] : variants?.fills[variants.options[0]!])} />
                </div>
              </div>
              <div>
                <h3 className="mb-2 font-semibold">Starter code</h3>
                <pre className="overflow-auto rounded-lg border border-line bg-canvas p-3 font-mono text-sm leading-6">{starterCode}</pre>
              </div>
            </div>
            <p className="mt-5 flex items-center gap-2 text-sm text-ink-3"><Sparkles className="size-4" aria-hidden /> Students follow the journey Understand → Write → {rules.workflow === "run_first" ? "Run → Explain" : "Explain → Run"} → Submit + viva, with Ustaad's hints on the side.</p>
          </Card>
          {error && <p role="alert" className="text-danger">{error}</p>}
          <div className="flex flex-wrap justify-between gap-3">
            <Button variant="secondary" icon={ArrowLeft} onClick={() => setStep(2)}>Back to the rules</Button>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" loading={saving === "draft"} disabled={saving !== null} onClick={() => save("draft")}>Save as draft</Button>
              <Button size="lg" icon={Check} loading={saving === "published"} disabled={saving !== null} onClick={() => save("published")}>
                Publish to {course?.code ?? "the course"} (students see it now)
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
