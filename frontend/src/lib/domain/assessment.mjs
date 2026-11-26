// Assessment model: one assessment per facility × requirement × version.
// This module is pure: it decides which register requirements apply to a
// facility, evaluates submitted values against a criterion, and summarises a
// facility's assessments. The seed records come from the compliance register
// (data/register); changes made in the app live in lib/store/assessments.
import { CAPACITY_REQUIREMENT, capacityRequirement } from "@/lib/domain/facilities.mjs";
import { currentRequirements } from "@/lib/domain/requirementVersions.mjs";
import { complianceRow } from "@/lib/register/data.mjs";
import { recordsFromRegister } from "@/lib/register/records.mjs";

export const APPLICABILITY = {
  applicable: "Applies",
  provisional: "Provisional",
  "not-applicable": "Not applicable",
};

// "Partially compliant" is stored as non-compliant with partial: true, so every count of
// fulfilled and not fulfilled requirements adds up the same way on every page.
export const STATUS = {
  unassessed: "Not assessed",
  declared: "Declared",
  "evidence-submitted": "Evidence submitted",
  compliant: "Compliant",
  "non-compliant": "Non-compliant",
};

export const assessmentKey = (facilityId, requirement) => `${facilityId}::${requirement.id}@v${requirement.version}`;

/**
 * Whether a requirement applies to a stadium, and why.
 * - Requirements for other asset types (training sites, fan festivals, the IBC) do not apply.
 * - The register can mark a requirement not applicable to one stadium.
 * - Requirements with a stated threshold apply; the rest are provisional until the 2034 clause is confirmed.
 */
export function stadiumApplicability(stadium, requirement) {
  if (!requirement.appliesTo.includes("stadium"))
    return { value: "not-applicable", reason: `${requirement.assetType} requirement` };
  const row = complianceRow(stadium.id, requirement.id);
  if (row?.status === "Not applicable")
    return { value: "not-applicable", reason: row.comments || "Not applicable to this stadium" };
  return requirement.applicability === "applicable"
    ? { value: "applicable", reason: "FIFA guidance with a stated threshold" }
    : { value: "provisional", reason: "2034 clause to be confirmed; FIFA published guidance" };
}

/** Current requirements (after any applied changes), resolved and with their applicability for one stadium. */
export function stadiumRequirements(stadium, requirements = currentRequirements()) {
  return requirements.map((raw) => {
    // Capacity (STA-0004): the threshold follows the stadium's highest match, as in the facility register.
    const requirement = raw.id === CAPACITY_REQUIREMENT ? capacityRequirement(stadium, raw) : raw;
    return {
      requirement,
      key: assessmentKey(stadium.id, requirement),
      applicability: stadiumApplicability(stadium, requirement),
    };
  });
}

const NUMERIC = {
  min: (v, c) => v >= c,
  gte: (v, c) => v >= c,
  gt: (v, c) => v > c,
  max: (v, c) => v <= c,
  lte: (v, c) => v <= c,
  lt: (v, c) => v < c,
  eq: (v, c) => Math.abs(v - c) < 1e-9,
};

/**
 * Check a submitted value against a criterion.
 * Returns "pass" | "fail" for numeric criteria, or "needs-review" when the
 * criterion is qualitative or the value is not a number. A pass or fail is
 * still subject to reviewer decision.
 */
export function evaluate(criterion, value) {
  const test = NUMERIC[criterion.operator];
  if (criterion.operator === "range") {
    const n = Number(value);
    if (!Number.isFinite(n)) return "needs-review";
    return n >= criterion.minimum && n <= criterion.maximum ? "pass" : "fail";
  }
  if (!test) return "needs-review";
  const n = Number(value);
  if (value === "" || value == null || !Number.isFinite(n)) return "needs-review";
  return test(n, criterion.value) ? "pass" : "fail";
}

/** The records in the compliance register: what every page shows before anything is changed. */
export const seedAssessments = recordsFromRegister;

/** Counts for a facility: what applies and how far assessment has got. */
export function facilitySummary(rows, records) {
  const inScope = rows.filter((r) => r.applicability.value !== "not-applicable");
  const status = (r) => records[r.key]?.status || "unassessed";
  const count = (s) => inScope.filter((r) => status(r) === s).length;
  const assessed = inScope.length - count("unassessed");
  return {
    inScope: inScope.length,
    applicable: inScope.filter((r) => r.applicability.value === "applicable").length,
    provisional: inScope.filter((r) => r.applicability.value === "provisional").length,
    assessed,
    coverage: inScope.length ? assessed / inScope.length : 0,
    partial: inScope.filter((r) => status(r) === "non-compliant" && records[r.key]?.partial).length,
    byStatus: Object.fromEntries(Object.keys(STATUS).map((s) => [s, count(s)])),
  };
}
