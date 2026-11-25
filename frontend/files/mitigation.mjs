// Mitigation detail for one finding: what to do, who owns it and when it is due.
// The owner roles and the response times are working assumptions of the Venue
// Compliance Hub. Replace OWNER_BY_FAMILY with the authority's workstream owners
// and DUE_DAYS with the agreed response times when they are confirmed.
import { criterionLabel } from "@/lib/domain/fifa-catalogue.mjs";

export const OWNER_BY_FAMILY = {
  Capacity: "Stadium design lead",
  Pitch: "Pitch and turf lead",
  Lighting: "Lighting and electrical lead",
};
const DEFAULT_OWNER = "Stadium delivery team";

// Days from today to resolve a finding, by exposure class.
export const DUE_DAYS = { critical: 14, material: 30, manageable: 60 };

export const ownerFor = (family) => OWNER_BY_FAMILY[family] || DEFAULT_OWNER;

/** Due date as a Date, or null when nothing is due (controlled). */
export function dueDate(level, from = new Date()) {
  const days = DUE_DAYS[level];
  if (!days) return null;
  const d = new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate()));
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export const formatDue = (d) =>
  d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "–";

/** The next step for a finding, from where its assessment stands. */
export function mitigationAction(finding) {
  const { row, record, level } = finding;
  const status = record?.status || "unassessed";
  const target = criterionLabel(row.requirement.criterion).replace(/\d{4,}/g, (n) => Number(n).toLocaleString("en-US"));
  const latest = record?.evidence?.at(-1);
  if (status === "compliant") return "No action. Accepted by a reviewer.";
  if (status === "non-compliant")
    return `Agree a recovery plan with the owner, then resubmit evidence that meets ${target}.`;
  if (status === "evidence-submitted")
    return latest?.check === "fail"
      ? `The submitted value misses ${target}. Reject it and ask for corrected evidence or a design change.`
      : "A reviewer needs to accept or reject the submitted evidence.";
  if (status === "declared")
    return record?.declared?.check === "fail"
      ? `The declared value misses ${target}. Confirm the figure or raise a design change.`
      : "Ask the stadium delivery team for evidence supporting the declared value.";
  return level === "controlled"
    ? "No action yet. Assessment opens later in the delivery programme."
    : "Request evidence from the stadium delivery team and start the assessment.";
}

/** One line on the latest evidence, or null when there is none. */
export function evidenceLine(record) {
  const latest = record?.evidence?.at(-1);
  if (!latest) return record?.declared ? `Declared: ${record.declared.value}` : null;
  const value = latest.value !== "" && latest.value != null ? `value ${latest.value}` : "no value recorded";
  return `${latest.file} · ${value} · ${latest.on}`;
}
