// Mitigation detail for one finding: what to do, who owns it and when it is due.
// The owner comes from the compliance register (data/register/compliance.csv, falling back to the
// family's default owner in families.csv). The response times are a working assumption of the Venue
// Compliance Hub: replace DUE_DAYS with the agreed response times when they are confirmed.
import { criterionLabel } from "@/lib/domain/fifa-catalogue.mjs";
import { familyById, ownerOf } from "@/lib/register/data.mjs";

// Days from today to resolve a finding, by exposure class.
export const DUE_DAYS = { critical: 14, material: 30, manageable: 60 };

/** Owner of a requirement at a stadium. */
export const ownerFor = (stadiumId, requirement) => ownerOf(stadiumId, requirement);
/** Default owner of a requirement family. */
export const familyOwner = (familyId) => familyById(familyId)?.defaultOwner || "Stadium delivery team";

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
  const criterion = row.requirement.criterion;
  const target = criterion.operator === "manual" ? "the requirement" : criterionLabel(criterion);
  const latest = record?.evidence?.at(-1);
  if (status === "compliant") return "No action. Accepted by a reviewer.";
  if (status === "non-compliant")
    return record.partial
      ? `Agree the remaining actions with the owner, then resubmit evidence that fully meets ${target}.`
      : `Agree a recovery plan with the owner, then resubmit evidence that meets ${target}.`;
  if (status === "evidence-submitted")
    return latest?.check === "fail"
      ? `The submitted value misses ${target}. Reject it and ask for corrected evidence or a design change.`
      : "A reviewer needs to accept or reject the submitted evidence.";
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
