/** Dates in Pakistan time, written the way a classroom would say them. */
const TZ = "Asia/Karachi";
const DAY = 86_400_000;

const dateFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });

/** Calendar-day difference in Pakistan time (0 = today, 1 = tomorrow, -1 = yesterday). */
export function dayDiff(iso: string, now = Date.now()): number {
  const key = (t: number) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(t); // YYYY-MM-DD
  return Math.round((Date.parse(key(Date.parse(iso))) - Date.parse(key(now))) / DAY);
}

export function formatDateTime(iso: string): string {
  const t = Date.parse(iso);
  return `${dateFmt.format(t)}, ${timeFmt.format(t)}`;
}

/** "Due tomorrow · Wed 25 Nov, 11:59 PM", "Due in 3 days · …", "Closed 10 days ago". */
export function formatDue(iso: string | null, open: boolean, now = Date.now()): string {
  if (!iso) return open ? "No due date" : "Closed";
  const d = dayDiff(iso, now);
  const when = formatDateTime(iso);
  const past = Date.parse(iso) < now;
  if (!open || past) {
    if (d === 0) return `Closed today · ${when}`;
    if (d === -1) return `Closed yesterday · ${when}`;
    return `Closed ${Math.abs(d)} days ago · ${when}`;
  }
  if (d === 0) return `Due today · ${timeFmt.format(Date.parse(iso))}`;
  if (d === 1) return `Due tomorrow · ${when}`;
  return `Due in ${d} days · ${when}`;
}

export function greeting(now = new Date()): string {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hour12: false }).format(now));
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function firstName(fullName: string): string {
  return fullName.split(" ")[0] ?? fullName;
}
