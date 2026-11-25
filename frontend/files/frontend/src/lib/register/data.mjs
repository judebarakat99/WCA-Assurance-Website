// The compliance register: families (the chapters of the FIFA stadium book), requirements and each
// stadium's status per requirement. Read from register.generated.json, which scripts/build-register.mjs
// builds from the CSV files in data/register. Nothing here changes at run time; run-time changes
// (evidence, reviews) live in lib/store/assessments and are exported back to CSV.
import data from "./register.generated.json" with { type: "json" };

export const REGISTER_DATE = data.generatedOn;
export const SOURCES = data.sources;
export const SECTIONS = data.sections;
export const REQUIREMENTS = data.requirements;

const stadiumFamilyIds = new Set(REQUIREMENTS.filter((r) => r.appliesTo === "stadium").map((r) => r.familyId));
export const FAMILIES = data.families.map((f) => ({ ...f, forStadiums: stadiumFamilyIds.has(f.id) }));

export const familyById = (id) => FAMILIES.find((f) => f.id === id) || null;
export const familyByName = (name) => FAMILIES.find((f) => f.name === name) || null;
export const sectionById = (id) => SECTIONS.find((s) => s.id === id) || null;

/** CSV status words, and the status the app stores for each. "Partially compliant" is a not-fulfilled
 *  requirement that is part met: the app keeps it as non-compliant with partial: true. */
export const CSV_STATUS = {
  "Not assessed": { status: "unassessed" },
  "Evidence submitted": { status: "evidence-submitted" },
  Compliant: { status: "compliant" },
  "Partially compliant": { status: "non-compliant", partial: true },
  "Non-compliant": { status: "non-compliant" },
  "Not applicable": { status: "not-applicable" },
};

const rows = data.compliance.map(([stadiumId, id, status, value, unit, check, file, on, by, owner, comments, updated]) => ({
  stadiumId, id, status, value, unit, check, file, on, by, owner, comments, updated,
}));
const byPair = new Map(rows.map((r) => [`${r.stadiumId}::${r.id}`, r]));

/** Every register row (one per stadium and stadium-level requirement). */
export const complianceRows = () => rows;
/** The register row for one stadium and requirement, or null. */
export const complianceRow = (stadiumId, requirementId) => byPair.get(`${stadiumId}::${requirementId}`) || null;
/** Who owns a requirement at a stadium: the register row's owner, else the family's default owner. */
export function ownerOf(stadiumId, requirement) {
  return complianceRow(stadiumId, requirement.id)?.owner || familyById(requirement.familyId)?.defaultOwner || "Stadium delivery team";
}
