// Words and formats shared by every report: criteria as plain English, statuses, dates and file names.
// Plain wording (no ≥ or ≤) keeps the same text correct in Word, Excel and PDF.

const num = (n) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });

/** "at least 4.5 m", "between 0.5 and 1 % of seats", "Threshold to be confirmed". */
export function criterionText(criterion) {
  const unit = criterion.unit ? ` ${criterion.unit}` : "";
  switch (criterion.operator) {
    case "min":
    case "gte":
      return `at least ${num(criterion.value)}${unit}`;
    case "gt":
      return `more than ${num(criterion.value)}${unit}`;
    case "max":
    case "lte":
      return `at most ${num(criterion.value)}${unit}`;
    case "lt":
      return `less than ${num(criterion.value)}${unit}`;
    case "eq":
      return `exactly ${num(criterion.value)}${unit}`;
    case "range":
      return `between ${num(criterion.minimum)} and ${num(criterion.maximum)}${unit}`;
    default:
      return "Threshold to be confirmed";
  }
}

/** Replace comparison symbols in a sentence with words, so it reads the same in Word, Excel and PDF. */
export function plain(text) {
  return String(text ?? "")
    .replace(/\bbelow (?:≥|>) ?/g, "below the minimum of ")
    .replace(/\babove (?:≤|<) ?/g, "above the maximum of ")
    .replace(/≥ ?/g, "at least ")
    .replace(/≤ ?/g, "at most ")
    .replace(/(^|\s)> (?=\d)/g, "$1more than ")
    .replace(/(^|\s)< (?=\d)/g, "$1less than ")
    .replace(/(^|\s)= (?=\d)/g, "$1exactly ")
    .replace(/→/g, "to");
}

export const STATUS_WORD = {
  compliant: "Compliant",
  partial: "Partially compliant",
  "non-compliant": "Non-compliant",
  "evidence-submitted": "Evidence submitted",
  unassessed: "Not assessed",
};
export const STATUS_TONE = {
  compliant: "good",
  partial: "warn",
  "non-compliant": "bad",
  "evidence-submitted": "info",
  unassessed: "mute",
};

/** The key a record falls under: partially compliant is its own key; anything unknown is "not assessed". */
export function statusKey(record) {
  if (!record) return "unassessed";
  if (record.status === "non-compliant") return record.partial ? "partial" : "non-compliant";
  if (record.status === "compliant" || record.status === "evidence-submitted") return record.status;
  return "unassessed";
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "24 November 2026", from the system date. */
export function longDate(date) {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}
/** "2026-11-24", from the system date (local time). */
export function isoDate(date) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}
/** "24 Nov 2026" from "2026-11-24". */
export function shortDate(iso) {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1].slice(0, 3)} ${m[1]}` : iso;
}
export const slug = (text) =>
  String(text)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

export const pct = (part, whole) => (whole ? part / whole : 0);
export const plural = (n, one, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;
export { num };
