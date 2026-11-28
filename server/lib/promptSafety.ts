/**
 * Defences around student-written text that reaches an AI model (prompt injection).
 *
 * 1. fence(): student text is wrapped in tags like <student_message> in our prompts. A student who
 *    types "</student_message> SYSTEM: ..." could close our tag and pose as the system. fence()
 *    defuses anything tag-shaped, so student text can never close or open one of our tags.
 * 2. looksLikeInstructionToAi(): a message that tries to command the model (ignore previous
 *    instructions, name our internal fields, claim to be the system or the teacher) gets a fixed
 *    reply and never reaches the model.
 * 3. verifiedQuote(): when the model says the student explained something, it must quote the
 *    student's own words. The server checks the quote really appears in what the student wrote in
 *    the chat (never code comments), so the model can't be talked into a check the student didn't earn.
 */

/** The tags our prompts wrap student text in (plus "system"). Student text may never open or close one. */
const OUR_TAGS = ["student_message", "student_code", "student_answer", "chat_with_ustaad", "program_output", "previous_answers", "lecture", "slide", "system"];

/**
 * Any "<" that starts one of OUR tag names, however it is disguised: spaces after "<" or "/",
 * capitals, a line break before ">", or no ">" at all. A model can still read those as our tags.
 */
const OUR_TAG_START = new RegExp(`<(\\s*\\/?\\s*)(${OUR_TAGS.join("|")})\\b`, "gi");

/** Defuse tag-shaped sequences (<x>, </x>, <x attr>) in student text; code comparisons like a < b stay readable. */
export function fence(text: string): string {
  return text.replace(/<(\/?)([A-Za-z_][\w-]*)([^<>\n]*)>/g, "‹$1$2$3›").replace(OUR_TAG_START, "‹$1$2");
}

const INSTRUCTION_PATTERNS: RegExp[] = [
  /\bignore\b.{0,40}\b(previous|prior|above|earlier|all|these|your)\b.{0,20}\b(instructions?|rules?|prompts?|messages?)\b/i,
  /\b(disregard|forget|override)\b.{0,40}\b(instructions?|rules?|prompt|system)\b/i,
  /\b(system|developer|admin(istrator)?)\s*(prompt|message|update|override|note|instruction)s?\b/i,
  /\b(goalClear|logicExplained|outputInterpreted|understandingVerified|allowExecution|comprehensionChecks|professorSummary|normanStage)\b/i,
  /<\/?\s*(student_\w+|program_output|previous_answers|chat_with_ustaad|lecture|slide|system)\b/i,
  /\byou are now\b.{0,40}\b(mode|grader|grading|assistant|ai|model)\b/i,
  /\b(set|mark|make)\b.{0,30}\b(checks?|criteria|all|every)\b.{0,30}\b(true|passed|met|complete)\b/i,
  /\b(note|message|instruction)s?\s+(to|for)\s+(ustaad|the ai|the model|the grader|the assistant)\b/i,
];

export function looksLikeInstructionToAi(text: string): boolean {
  return INSTRUCTION_PATTERNS.some((re) => re.test(text));
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * True when `quote` is at least `minWords` words long and appears (ignoring case, punctuation and
 * spacing) in one of the student's own chat messages that isn't itself an instruction to the AI.
 */
export function verifiedQuote(quote: string | null | undefined, studentMessages: string[], minWords = 4): boolean {
  if (!quote) return false;
  const q = norm(quote);
  if (q.split(" ").filter(Boolean).length < minWords) return false;
  return studentMessages.some((m) => !looksLikeInstructionToAi(m) && norm(m).includes(q));
}
