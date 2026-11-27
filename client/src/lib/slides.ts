/**
 * Turns a lecture's notes into slides: one slide per "### " section. Text before the first section becomes
 * an opening slide headed with the lecture title. The notes stay the single source; slides are just a view.
 */
export interface Slide {
  heading: string;
  body: string;
}

export function toSlides(title: string, notes: string): Slide[] {
  const slides: Slide[] = [];
  let heading = title;
  let body: string[] = [];
  let inCode = false;
  const flush = () => {
    const text = body.join("\n").trim();
    if (text) slides.push({ heading, body: text });
    body = [];
  };
  for (const line of notes.replace(/\r\n/g, "\n").split("\n")) {
    if (line.trimStart().startsWith("```")) inCode = !inCode;
    const m = !inCode && /^###\s+(.+)$/.exec(line);
    if (m) {
      flush();
      heading = m[1]!.trim();
    } else body.push(line);
  }
  flush();
  return slides;
}

/** About 200 words a minute, never under a minute. */
export function readingMinutes(notes: string): number {
  return Math.max(1, Math.round(notes.split(/\s+/).filter(Boolean).length / 200));
}
