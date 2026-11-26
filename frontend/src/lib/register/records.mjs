// Turns the compliance register into the assessment records the app uses, and back into CSV.
// Seed records are what every page shows until someone records evidence or a review; those changes
// live in lib/store/assessments and can be exported with exportComplianceCsv().
import { FACILITY_REGISTER, capacityRequirement } from "@/lib/domain/facilities.mjs";
import { CSV_STATUS, REQUIREMENTS, complianceRow, complianceRows, familyById } from "@/lib/register/data.mjs";
import { toCsv } from "@/lib/register/csv.mjs";

const keyOf = (stadiumId, id, version = 1) => `${stadiumId}::${id}@v${version}`;
const stadiumById = (id) => FACILITY_REGISTER.stadiums.find((s) => s.id === id);

function evidenceOf(row) {
  return row.file ? [{ file: row.file, value: row.value, note: "", check: row.check || "needs-review", on: row.on }] : [];
}

/** One assessment record from one register row, or null when nothing is on record. */
export function recordFromRow(row) {
  const mapped = CSV_STATUS[row.status];
  if (!mapped || mapped.status === "unassessed" || mapped.status === "not-applicable") return null;
  const requirement = REQUIREMENTS.find((r) => r.id === row.id);
  const reviewed = mapped.status === "compliant" || mapped.status === "non-compliant";
  const record = {
    facilityId: row.stadiumId,
    requirementId: row.id,
    requirementVersion: 1,
    status: mapped.status,
    partial: Boolean(mapped.partial),
    owner: row.owner,
    comment: row.comments,
    evidence: evidenceOf(row),
    review: reviewed ? { outcome: mapped.status, by: row.by || "Compliance reviewer", on: row.on, note: row.comments } : null,
    history: [],
  };
  if (row.file) record.history.push({ on: row.on, action: `Evidence submitted: ${row.file} (${row.check || "needs-review"})` });
  if (reviewed) record.history.push({ on: row.on, action: `${record.review.by}: ${record.partial ? "partially compliant" : mapped.status}` });
  if (requirement && requirement.id === "STA-0004") {
    const stadium = stadiumById(row.stadiumId);
    const rule = stadium && capacityRequirement(stadium);
    if (stadium && rule) {
      record.declared = {
        value: stadium.grossCapacity,
        check: stadium.grossCapacity >= rule.criterion.value ? "pass" : "fail",
        sourceId: stadium.sourceId,
        page: stadium.page,
      };
    }
  }
  return record;
}

/** Every assessment record in the register, keyed by facility, requirement and version. */
export function recordsFromRegister() {
  const records = {};
  for (const row of complianceRows()) {
    const record = recordFromRow(row);
    if (record) records[keyOf(row.stadiumId, row.id)] = record;
  }
  return records;
}

export const COMPLIANCE_FIELDS = [
  "stadium_id", "id", "status", "value", "unit", "check", "evidence_file", "evidence_on", "reviewed_by", "owner", "comments", "updated_on",
];

function csvStatus(record) {
  if (!record) return null;
  if (record.status === "compliant") return "Compliant";
  if (record.status === "non-compliant") return record.partial ? "Partially compliant" : "Non-compliant";
  if (record.status === "evidence-submitted") return "Evidence submitted";
  return "Not assessed";
}

/**
 * The register as CSV text (the format of data/register/compliance.csv) with the current records applied:
 * every stadium and stadium-level requirement, one row each. Replace compliance.csv with this file and run
 * "npm run register:build" to make evidence and reviews recorded in the app the new seed.
 */
export function complianceCsv(records, requirementVersions = (id) => 1) {
  const out = [];
  for (const base of complianceRows()) {
    const record = records[keyOf(base.stadiumId, base.id, requirementVersions(base.id))] || records[keyOf(base.stadiumId, base.id)];
    const wasNotApplicable = base.status === "Not applicable";
    const latest = record?.evidence?.at(-1);
    const status = wasNotApplicable ? "Not applicable" : csvStatus(record) || "Not assessed";
    out.push({
      stadium_id: base.stadiumId,
      id: base.id,
      status,
      value: latest?.value ?? "",
      unit: base.unit,
      check: latest?.check ?? "",
      evidence_file: latest?.file ?? "",
      evidence_on: latest?.on ?? "",
      reviewed_by: record?.review?.by ?? "",
      owner: record?.owner || base.owner,
      comments: wasNotApplicable ? base.comments : record?.review?.note || record?.comment || "",
      updated_on: record?.history?.at(-1)?.on || latest?.on || base.updated,
    });
  }
  return toCsv(COMPLIANCE_FIELDS, out);
}

const SITE = { stadium: "Stadium", "training-site": "Training site", "fan-festival": "Fan festival", ibc: "IBC" };
const SYMBOL = { min: ">=", max: "<=", eq: "=", gt: ">", gte: ">=", lt: "<", lte: "<=" };
function criterionText(c) {
  if (c.operator === "manual") return c.description;
  if (c.operator === "range") return `${c.minimum}-${c.maximum} ${c.unit}`.trim();
  return `${SYMBOL[c.operator]} ${c.value} ${c.unit}`.trim();
}

export const REQUIREMENT_FIELDS = [
  "id", "chapter", "chapter_name", "section", "requirement", "criterion", "applies_to", "status", "source_page", "evidence_requested", "clause_2034",
];

/** The requirement register as CSV text: one row per check, as the Requirements page lists them. */
export function requirementsCsv() {
  const rows = REQUIREMENTS.map((r) => ({
    id: r.id,
    chapter: r.familyId,
    chapter_name: familyById(r.familyId)?.name || "",
    section: r.section,
    requirement: r.title,
    criterion: criterionText(r.criterion),
    applies_to: SITE[r.appliesTo] || r.appliesTo,
    status: r.applicability === "applicable" ? "Book" : "Working target",
    source_page: r.pdfPage,
    evidence_requested: r.evidenceRequested,
    clause_2034: r.clause2034,
  }));
  return toCsv(REQUIREMENT_FIELDS, rows);
}

export { complianceRow };
