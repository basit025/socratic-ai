// Saves ONE real recorded session (a submission made by a real person) as a JSON file the seed
// loads into the demo data, under a fictional classmate's name.
//
//   npm run session:export -- --submission <id> --as bilal --label copier-retyped-1 [--from preview] [--days-ago 2] [--note "..."]
//
// Find the submission id in the teacher's report URL (/teacher/submissions/<id>).
import { exportSession } from "../server/seed/exportSession.js";
import { students } from "../server/seed/content.js";
import type { Target } from "../server/seed/supabaseCli.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

const submission = arg("submission");
const as = arg("as");
const label = arg("label");
const classmates = students.filter((s) => !s.email).map((s) => s.key);
if (!submission || !/^[0-9a-f-]{36}$/i.test(submission) || !as || !label || !/^[a-z0-9-]+$/.test(label) || !classmates.includes(as)) {
  console.error("Usage: npm run session:export -- --submission <uuid> --as <classmate> --label <kebab-case-name> [--from preview|production] [--days-ago N] [--note \"...\"]");
  console.error(`Classmates: ${classmates.join(", ")}`);
  process.exit(1);
}
const r = exportSession({ submissionId: submission, as, label, from: (arg("from") ?? "preview") as Target, daysAgo: Number(arg("days-ago") ?? 1), note: arg("note") });
console.log(`Saved ${r.file}: ${r.events} events, viva ${r.viva ?? "none"}, tests ${r.tests}. Run "npm run seed" to load it.`);
