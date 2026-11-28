/**
 * Each course gets its own colour and icon, so students recognise a course at a glance in the sidebar,
 * on cards and on to-do items. Every colour passes WCAG AA with white text.
 */
import {
  BookOpenText, Boxes, Code2, Cpu, Database, Globe, GraduationCap, MessagesSquare, MousePointerClick, Network, Search, type LucideIcon,
} from "lucide-react";

const PALETTE = ["#1d4ed8", "#047857", "#6d28d9", "#be123c", "#0f766e", "#4338ca", "#c2410c", "#0e7490", "#a21caf", "#b45309"] as const;

const KNOWN: Record<string, { color: string; icon: LucideIcon }> = {
  "CS-101": { color: "#1d4ed8", icon: Code2 },
  "WEB-102": { color: "#c2410c", icon: Globe },
  "CS-201": { color: "#047857", icon: Network },
  "ENG-101": { color: "#be123c", icon: BookOpenText },
  "CS-211": { color: "#6d28d9", icon: Boxes },
  "CS-341": { color: "#0f766e", icon: Database },
  "CS-352": { color: "#4338ca", icon: Search },
  "CS-381": { color: "#a21caf", icon: MousePointerClick },
  "CS-461": { color: "#0e7490", icon: MessagesSquare },
  "CS-372": { color: "#b45309", icon: Cpu },
};

function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/**
 * color: solid backgrounds with white text. text: the same colour for words and icons on the page; in dark mode it is
 * mixed towards white (--course-lift in index.css) so it stays readable on the dark surface.
 */
export function courseStyle(code: string): { color: string; text: string; soft: string; line: string; icon: LucideIcon } {
  const k = KNOWN[code];
  const color: string = k?.color ?? PALETTE[hash(code) % PALETTE.length]!;
  return { color, text: `color-mix(in srgb, ${color}, #fff var(--course-lift, 0%))`, soft: `${color}12`, line: `${color}40`, icon: k?.icon ?? GraduationCap };
}
