/**
 * One lecture: the teacher's own slide deck when there is one, key-point slides made from the notes, the notes
 * themselves, the work set for it, and the way to the next one. Arrow keys move between slides.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Maximize2, Minimize2, Presentation, ScrollText } from "lucide-react";
import { Markdown } from "../components/Markdown";
import { Button, Card, Chip, ErrorState, Segmented, Skeleton, cx, type ChipTone } from "../components/ui";
import { courseStyle } from "../lib/courseStyle";
import { toSlides } from "../lib/slides";
import { kindOf } from "../lib/student";
import { useApi } from "../lib/useApi";
import { PracticeQuiz, StudyChat } from "../components/StudyPanel";

/**
 * A slide never needs scrolling: it is as wide as the column allows, but never taller than the window minus the
 * top bar, the course tabs and the slide controls (12.25rem); the width shrinks to keep the slide's shape.
 * scroll-mt-32 parks it just under the sticky top bar and tabs when it is scrolled into view.
 */
const FIT_4_3 = "mx-auto aspect-[4/3] w-full max-w-[calc((100dvh-12.25rem)*4/3)] scroll-mt-32";
const FIT_16_9 = "mx-auto aspect-[16/10] w-full scroll-mt-32 sm:aspect-video sm:max-w-[calc((100dvh-12.25rem)*16/9)]";

export interface LectureWeek {
  week: number;
  title: string;
  notes: string;
  /** Pages in the teacher's own slide deck (0 or missing: none). */
  slides?: number;
}

interface Task {
  id: string;
  title: string;
  type: string;
  meta: string;
  chip: { tone: ChipTone; label: string };
  to: string;
}

export function LectureView({
  course, lecture, prev, next, base, tasks,
}: {
  course: { id: string; code: string; name: string; teacher: string };
  lecture: LectureWeek;
  prev: LectureWeek | null;
  next: LectureWeek | null;
  base: string;
  tasks: Task[];
}) {
  const cs = courseStyle(course.code);
  const slides = useMemo(() => toSlides(lecture.title, lecture.notes), [lecture]);
  const deckCount = lecture.slides ?? 0;
  const deck = useApi<{ pages: { url: string; text: string }[] }>(deckCount > 0 ? `/courses/${course.id}/lectures/${lecture.week}/slides` : null);
  const pages = deck.status === "ready" ? deck.data.pages : [];
  const [mode, setMode] = useState<"deck" | "slides" | "notes">(deckCount > 0 ? "deck" : "slides");
  const total = mode === "deck" ? Math.max(1, pages.length || deckCount) : slides.length + 1; // key points: + the title slide
  const [i, setI] = useState(0);
  const [full, setFull] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const thumbs = useRef<HTMLOListElement>(null);

  useEffect(() => setMode(deckCount > 0 ? "deck" : "slides"), [lecture.week, deckCount]);
  // Opening a lecture (or switching to slides) on a short laptop screen: bring the whole slide and its buttons into view.
  useEffect(() => {
    if (mode === "notes") return;
    const t = setTimeout(() => {
      const el = stage.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.top < 112 || r.bottom + 64 > window.innerHeight) el.scrollIntoView({ block: "start" });
    }, 60);
    return () => clearTimeout(t);
  }, [lecture.week, mode]);
  useEffect(() => setI(0), [lecture.week, mode]);
  // Fetch the next page ahead of time, and keep the current thumbnail in view.
  useEffect(() => {
    if (mode !== "deck") return;
    const nextPage = pages[i + 1];
    if (nextPage) new Image().src = nextPage.url;
    // Scroll only the strip sideways (scrollIntoView would also move the page).
    const strip = thumbs.current;
    const thumb = strip?.querySelector<HTMLElement>(`[data-thumb="${i}"]`);
    if (strip && thumb) strip.scrollTo({ left: thumb.offsetLeft - strip.clientWidth / 2 + thumb.clientWidth / 2, behavior: "smooth" });
  }, [mode, i, pages]);
  useEffect(() => {
    if (mode === "notes") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /input|textarea|select/i.test(t.tagName)) return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || (e.key === " " && full)) {
        e.preventDefault();
        setI((n) => Math.min(total - 1, n + 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setI((n) => Math.max(0, n - 1));
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mode, total, full]);
  useEffect(() => {
    const onFs = () => setFull(document.fullscreenElement === stage.current && !!stage.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stage.current?.requestFullscreen?.().catch(() => {});
  };

  const slide = mode === "slides" && i > 0 ? (slides[i - 1] ?? null) : null;
  const page = mode === "deck" ? (pages[i] ?? null) : null;

  const controls = (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Button variant="secondary" icon={ChevronLeft} disabled={i === 0} onClick={() => setI(i - 1)}>Previous</Button>
      <Button icon={ChevronRight} disabled={i >= total - 1} onClick={() => setI(i + 1)} className="flex-row-reverse">Next slide</Button>
      <span className="px-2 text-sm text-ink-3 tabular-nums">Slide {i + 1} of {total} · use ← → keys</span>
      <Button variant="ghost" icon={Maximize2} onClick={toggleFull} className="ml-auto">Full screen</Button>
    </div>
  );
  const exitFull = full && (
    <button
      type="button"
      onClick={toggleFull}
      title="Exit full screen (Esc)"
      className={cx(
        "absolute top-3 right-3 flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold",
        mode === "deck" ? "bg-white/15 text-white hover:bg-white/25" : "bg-ink/10 text-ink hover:bg-ink/20",
      )}
      aria-label="Exit full screen"
    >
      <Minimize2 className="size-4" aria-hidden /> Exit full screen
    </button>
  );

  return (
    <div>
      <Link to={`${base}/courses/${course.id}/lectures`} className="mb-3 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-action hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> All lectures
      </Link>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: cs.text }}>Lecture {lecture.week}</p>
          <h2 className="text-2xl font-bold tracking-tight">{lecture.title}</h2>
          <p className="mt-0.5 text-sm text-ink-3">{deckCount || slides.length + 1} slides · {course.teacher}</p>
        </div>
        <Segmented
          label="View the lecture as"
          value={mode}
          onChange={setMode}
          options={
            deckCount > 0
              ? [
                  { value: "deck", label: "Slides" },
                  { value: "slides", label: "Key points" },
                  { value: "notes", label: "Notes" },
                ]
              : [
                  { value: "slides", label: "Slides" },
                  { value: "notes", label: "Notes" },
                ]
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="min-w-0">
          {mode === "deck" ? (
            <>
              <div
                ref={stage}
                className={cx("relative overflow-hidden rounded-xl border border-line bg-locked-soft shadow-sm", full ? "flex items-center justify-center !rounded-none bg-scrim" : FIT_4_3)}
                aria-roledescription="slide"
                aria-label={`Slide ${i + 1} of ${total}`}
              >
                {deck.status === "loading" && <Skeleton className="absolute inset-0 !rounded-none" />}
                {deck.status === "error" && (
                  <div className="flex h-full items-center justify-center p-6">
                    <ErrorState message="The slides didn't load. Check your connection and try again, or read the key points meanwhile." onRetry={deck.reload} />
                  </div>
                )}
                {page && (
                  <img
                    key={page.url}
                    src={page.url}
                    alt={`Slide ${i + 1}: ${page.text.split("\n")[0] || lecture.title}`}
                    draggable={false}
                    className="h-full w-full object-contain"
                  />
                )}
                {exitFull}
              </div>
              {controls}
              {pages.length > 0 && (
                <ol ref={thumbs} className="relative mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Slides">
                  {pages.map((p, n) => (
                    <li key={p.url} data-thumb={n}>
                      <button
                        type="button"
                        onClick={() => setI(n)}
                        aria-current={n === i ? "true" : undefined}
                        aria-label={`Slide ${n + 1}`}
                        className={cx("relative block w-28 shrink-0 overflow-hidden rounded-lg border-2", n === i ? "border-action" : "border-line hover:border-line-strong")}
                      >
                        <img src={p.url} loading="lazy" alt="" className="aspect-[4/3] w-full bg-locked-soft object-cover" />
                        <span className="absolute bottom-1 left-1 rounded bg-surface/90 px-1.5 text-xs font-semibold text-ink-2 tabular-nums">{n + 1}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </>
          ) : mode === "slides" ? (
            <>
              <div
                ref={stage}
                className={cx("relative overflow-hidden rounded-xl border border-line bg-surface shadow-sm", full ? "flex flex-col justify-center !rounded-none p-[6vh_8vw]" : FIT_16_9)}
                aria-roledescription="slide"
                aria-label={`Slide ${i + 1} of ${total}`}
              >
                {slide == null ? (
                  <div className="flex h-full flex-col justify-end p-6 text-white sm:p-10" style={{ backgroundColor: cs.color }}>
                    <svg aria-hidden className="absolute inset-0 h-full w-full opacity-[0.12]" preserveAspectRatio="xMidYMid slice" viewBox="0 0 160 90">
                      <circle cx="140" cy="12" r="38" fill="#fff" />
                      <circle cx="98" cy="96" r="28" fill="#fff" />
                    </svg>
                    <p className="relative text-sm font-semibold tracking-wide opacity-90 sm:text-base">{course.code} · {course.name}</p>
                    <p className="relative mt-2 text-sm font-medium opacity-90 sm:text-lg">Lecture {lecture.week}</p>
                    <h3 className="relative text-2xl leading-tight font-bold sm:text-4xl xl:text-5xl">{lecture.title}</h3>
                    <p className="relative mt-3 text-sm opacity-90 sm:text-base">{course.teacher}</p>
                  </div>
                ) : (
                  <div className={cx("flex h-full flex-col", !full && "p-5 sm:p-8 xl:p-10")}>
                    <div className="mb-4 flex items-center gap-3">
                      <span className="h-7 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: cs.color }} aria-hidden />
                      <h3 className="text-xl font-bold tracking-tight text-ink sm:text-2xl xl:text-3xl">{slide.heading}</h3>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                      <Markdown text={slide.body} variant="slide" />
                    </div>
                    <p className="mt-3 flex justify-between text-xs text-ink-3">
                      <span>{course.code} · Lecture {lecture.week}</span>
                      <span className="tabular-nums">{i + 1} / {total}</span>
                    </p>
                  </div>
                )}
                {exitFull}
              </div>

              {controls}
              <ol className="mt-3 flex gap-1.5 overflow-x-auto pb-1" aria-label="Slides">
                {[lecture.title, ...slides.map((s) => s.heading)].map((h, n) => (
                  <li key={n}>
                    <button
                      type="button"
                      onClick={() => setI(n)}
                      aria-current={n === i ? "true" : undefined}
                      title={h}
                      className={cx("min-h-11 w-36 shrink-0 truncate rounded-lg border px-2.5 text-left text-xs font-medium", n === i ? "border-action bg-action-soft text-action" : "border-line bg-surface text-ink-2 hover:border-line-strong")}
                    >
                      <span className="tabular-nums text-ink-3">{n + 1}.</span> {h}
                    </button>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <Card className="p-5 sm:p-8">
              <Markdown text={lecture.notes} className="max-w-3xl text-base" />
            </Card>
          )}

          <PracticeQuiz courseId={course.id} week={lecture.week} lectureTitle={lecture.title} />

          <nav className="mt-6 grid gap-3 sm:grid-cols-2" aria-label="Other lectures">
            {prev ? (
              <Link to={`${base}/courses/${course.id}/lectures/${prev.week}`} className="group rounded-xl border border-line bg-surface p-4 hover:border-action">
                <span className="flex items-center gap-1 text-sm text-ink-3"><ArrowLeft className="size-4" aria-hidden /> Previous lecture</span>
                <span className="block font-semibold group-hover:text-action">{prev.week}. {prev.title}</span>
              </Link>
            ) : <span />}
            {next && (
              <Link to={`${base}/courses/${course.id}/lectures/${next.week}`} className="group rounded-xl border border-line bg-surface p-4 text-right hover:border-action">
                <span className="flex items-center justify-end gap-1 text-sm text-ink-3">Next lecture <ArrowRight className="size-4" aria-hidden /></span>
                <span className="block font-semibold group-hover:text-action">{next.week}. {next.title}</span>
              </Link>
            )}
          </nav>
        </div>

        <aside className="space-y-4">
          <StudyChat
            courseId={course.id}
            courseCode={course.code}
            week={lecture.week}
            lectureTitle={lecture.title}
            getSlide={() =>
              page ? { heading: `Slide ${i + 1} of ${total} in the teacher's deck`, body: page.text || "(This slide is mostly a picture or diagram.)" } : slide
            }
            className="h-[calc(100dvh-12.25rem)] min-h-[26rem] max-h-[42rem]"
          />
          <Card className="overflow-hidden">
            <h3 className="flex items-center gap-2 border-b border-line px-4 py-3 font-semibold">
              <Presentation className="size-5 text-ink-3" aria-hidden /> Work for this lecture
            </h3>
            {tasks.length === 0 ? (
              <p className="px-4 py-4 text-sm text-ink-3">No assignment or quiz is set for this lecture. Use the notes to revise.</p>
            ) : (
              <ul className="divide-y divide-line">
                {tasks.map((t) => {
                  const k = kindOf(t.type);
                  return (
                    <li key={t.id}>
                      <Link to={t.to} className="block px-4 py-3 hover:bg-canvas">
                        <span className="flex items-center gap-2 text-xs font-medium text-ink-3"><k.icon className="size-3.5" aria-hidden /> {k.label}</span>
                        <span className="block font-medium">{t.title}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                          <Chip tone={t.chip.tone}>{t.chip.label}</Chip> {t.meta}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card className="p-4">
            <p className="flex items-center gap-2 font-semibold"><ScrollText className="size-5 text-ink-3" aria-hidden /> In this lecture</p>
            <ol className="mt-2 space-y-1 text-sm text-ink-2">
              {slides.map((s, n) => (
                <li key={n}>
                  <button type="button" onClick={() => { setMode("slides"); setI(n + 1); }} className="min-h-8 text-left hover:text-action hover:underline">
                    {n + 1}. {s.heading}
                  </button>
                </li>
              ))}
            </ol>
          </Card>
        </aside>
      </div>
    </div>
  );
}
