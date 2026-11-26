/**
 * Handwritten work (FR-11, FR-12). One primary action per screen:
 *   task + code word → camera → preview → Ustaad reads the page → viva.
 * The camera is used only to photograph the page, inside Socratic AI (no gallery uploads), and only
 * when the student presses "Open camera". Nothing is recorded.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AlertTriangle, ArrowLeft, ArrowRight, Camera, CheckCircle2, ClipboardX, KeyRound, Loader2, PenLine, RotateCcw, Timer } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Button, Card, Chip, ErrorState, Spinner, Ur, cx } from "../components/ui";
import { Markdown } from "../components/Markdown";
import { Appear, Pop } from "../components/Motion";
import { api, ApiError } from "../lib/api";
import { formatDue } from "../lib/format";

export interface HandwrittenAssignment {
  id: string;
  title: string;
  instructions: string;
  open: boolean;
  dueAt: string | null;
  marks: number;
  course: { code: string; name: string };
  rules: { vivaQuestions: number; vivaSecondsPerQ: number } | null;
}

interface State {
  status: "in_progress" | "submitted" | "viva_in_progress" | "graded";
  codeWord: string | null;
  codeWordFound?: boolean | null;
  transcription?: string;
}

type Stage = "task" | "camera" | "preview" | "reading" | "read";

const MAX_SIDE = 1400; // keeps a page legible and the upload well under 1 MB

export function HandwrittenPage({ assignment: a, submissionId }: { assignment: HandwrittenAssignment; submissionId: string | null }) {
  const navigate = useNavigate();
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("task");
  const [photo, setPhoto] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [result, setResult] = useState<{ codeWordFound: boolean; transcription: string } | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!submissionId) return;
    api<State>(`/submissions/${submissionId}/handwritten`)
      .then(setState)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Couldn't open this assignment."));
  }, [submissionId]);

  const stopCamera = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };
  useEffect(() => stopCamera, []);

  const openCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser can't use a camera. Open Socratic AI on a phone (Chrome or Safari) to photograph your page.");
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      setStage("camera");
      requestAnimationFrame(() => {
        if (video.current && stream.current) {
          video.current.srcObject = stream.current;
          void video.current.play().catch(() => {});
        }
      });
    } catch (e) {
      const name = (e as { name?: string }).name;
      setCameraError(
        name === "NotAllowedError"
          ? "Camera permission was blocked. Allow the camera for this site in your browser settings (the lock icon next to the address), then try again."
          : "No camera was found. Use a phone or a laptop with a camera.",
      );
    }
  };

  const capture = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const scale = Math.min(1, MAX_SIDE / Math.max(v.videoWidth, v.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
    setPhoto(canvas.toDataURL("image/jpeg", 0.8));
    stopCamera();
    setStage("preview");
  };

  const send = async () => {
    if (!photo || !submissionId) return;
    setStage("reading");
    setError(null);
    try {
      const r = await api<{ codeWordFound: boolean; transcription: string }>(`/submissions/${submissionId}/handwritten/photo`, { body: { image: photo } });
      setResult(r);
      setStage("read");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't send your photo. Check your connection and try again.");
      setStage("preview");
    }
  };

  const vivaLine = a.rules && a.rules.vivaQuestions > 0 ? `${a.rules.vivaQuestions} questions, about ${Math.round((a.rules.vivaQuestions * a.rules.vivaSecondsPerQ) / 60)} min` : "a few questions";

  return (
    <AppShell>
      <Link to="/student" className="mb-4 inline-flex items-center gap-1.5 font-medium text-action hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> My courses
      </Link>
      <div className="mb-5">
        <p className="text-sm font-medium text-ink-3">{a.course.code} · {a.course.name}</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{a.title}</h1>
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Rules for this assignment">
          <li><Chip tone={a.open ? "attention" : "locked"}>{formatDue(a.dueAt, a.open)}</Chip></li>
          <li><Chip tone="locked" icon={PenLine}>Handwritten, on paper</Chip></li>
          <li><Chip tone="locked" icon={null}>{a.marks} marks</Chip></li>
          {a.rules && a.rules.vivaQuestions > 0 && <li><Chip tone="action" icon={Timer}>Viva: {vivaLine}</Chip></li>}
          <li><Chip tone="locked" icon={ClipboardX}>Photo inside Socratic AI only</Chip></li>
        </ul>
      </div>

      {!submissionId && <Card className="p-5 text-ink-2">This assignment is closed, so it can't be started any more.</Card>}
      {submissionId && error && !state && <ErrorState message={error} />}
      {submissionId && !state && !error && <Spinner label="Opening the assignment…" />}

      {state && state.status !== "in_progress" && stage !== "read" && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-done-line bg-done-soft p-5">
          <p className="flex items-center gap-2 font-medium text-done"><CheckCircle2 className="size-5" aria-hidden /> Your page is handed in{state.codeWord ? ` (code word ${state.codeWord})` : ""}.</p>
          <Link to={`/student/assignments/${a.id}/viva`} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-action px-4 font-semibold text-white hover:bg-action-hover">
            {state.status === "viva_in_progress" ? "Continue your viva" : "See your results"} <ArrowRight className="size-5" aria-hidden />
          </Link>
        </Card>
      )}

      {state && state.status === "in_progress" && (
        <div className="grid gap-5 lg:grid-cols-12">
          <Card className="p-5 lg:col-span-7">
            <h2 className="mb-2 font-semibold">Your task</h2>
            <Markdown text={a.instructions} className="text-[16px]" />
          </Card>

          <div className="space-y-5 lg:col-span-5">
            {stage === "task" && (
              <Appear>
                <Card className="p-5">
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink-3"><KeyRound className="size-4" aria-hidden /> Your one-time code word</p>
                  <p className="mt-1 font-mono text-[34px] font-bold tracking-wider text-action" aria-live="polite">{state.codeWord ?? "…"}</p>
                  <ol className="mt-4 space-y-2.5 text-[15px] text-ink-2">
                    <li className="flex gap-2.5"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-action text-xs font-bold text-white">1</span> Solve the task on paper, in your own handwriting.</li>
                    <li className="flex gap-2.5"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-action text-xs font-bold text-white">2</span> Write <strong className="font-mono text-ink">{state.codeWord}</strong> at the top of the page. It proves the page was written for this task.</li>
                    <li className="flex gap-2.5"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-action text-xs font-bold text-white">3</span> Photograph the page here. Ustaad reads it, then asks you about it in a short viva.</li>
                  </ol>
                  {cameraError && <p role="alert" className="mt-4 flex gap-2 rounded-lg border border-attention-line bg-attention-soft px-3 py-2.5 text-sm text-ink"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-attention" aria-hidden />{cameraError}</p>}
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <Button size="lg" icon={Camera} onClick={openCamera} disabled={!a.open || !state.codeWord}>Open camera to photograph my page</Button>
                    <Ur>صفحے کی تصویر لیں</Ur>
                  </div>
                  <p className="mt-3 text-xs text-ink-3">The camera only takes this one photo when you press the button. Nothing is recorded, and photos from your gallery aren't accepted.</p>
                </Card>
              </Appear>
            )}

            {stage === "camera" && (
              <Card className="overflow-hidden">
                <div className="relative bg-ink">
                  <video ref={video} playsInline muted className="aspect-[3/4] w-full object-cover sm:aspect-[4/3]" />
                  <div aria-hidden className="pointer-events-none absolute inset-6 rounded-lg border-2 border-dashed border-white/70" />
                  <p className="absolute inset-x-0 top-3 text-center text-sm font-medium text-white drop-shadow">Fit the whole page in the frame, in good light</p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <Button variant="ghost" onClick={() => { stopCamera(); setStage("task"); }}>Cancel</Button>
                  <Button size="lg" icon={Camera} onClick={capture}>Take photo</Button>
                </div>
              </Card>
            )}

            {stage === "preview" && photo && (
              <Card className="overflow-hidden">
                <img src={photo} alt="Your photographed page" className="max-h-[520px] w-full bg-canvas object-contain" />
                <div className="space-y-3 p-4">
                  <p className="text-sm text-ink-2">Can you read every line, and is <strong className="font-mono">{state.codeWord}</strong> visible at the top?</p>
                  {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button variant="secondary" icon={RotateCcw} onClick={() => { setPhoto(null); void openCamera(); }}>Retake</Button>
                    <Button size="lg" icon={ArrowRight} onClick={send}>Use this photo (you can't change it after)</Button>
                  </div>
                </div>
              </Card>
            )}

            {stage === "reading" && (
              <Card className="flex flex-col items-center gap-3 p-8 text-center">
                <Loader2 className="size-8 animate-spin text-action" aria-hidden />
                <p className="font-semibold">Ustaad is reading your page…</p>
                <p className="text-sm text-ink-3">This takes a few seconds. It writes down exactly what you wrote, mistakes included.</p>
              </Card>
            )}
          </div>
        </div>
      )}

      {stage === "read" && result && (
        <Appear>
          <Card className="p-6">
            <p className={cx("flex items-center gap-2 font-semibold", result.codeWordFound ? "text-done" : "text-attention")}>
              <Pop>{result.codeWordFound ? <CheckCircle2 className="size-5" aria-hidden /> : <AlertTriangle className="size-5" aria-hidden />}</Pop>
              {result.codeWordFound ? `Code word ${state?.codeWord} found. Your page is handed in.` : `Your page is handed in, but the code word ${state?.codeWord} wasn't found on it. Your teacher will see this.`}
            </p>
            <h2 className="mt-4 font-semibold">This is what Ustaad read from your page</h2>
            <pre className="mt-2 max-h-80 overflow-auto rounded-lg border border-line bg-canvas p-4 font-sans text-[15px] whitespace-pre-wrap text-ink">{result.transcription}</pre>
            <p className="mt-2 text-sm text-ink-3">Next, Ustaad asks you {vivaLine} about what you wrote. Answer in your own words.</p>
            <Button size="lg" icon={ArrowRight} className="mt-5" onClick={() => navigate(`/student/assignments/${a.id}/viva`)}>Start viva: {vivaLine}</Button>
          </Card>
        </Appear>
      )}
    </AppShell>
  );
}
