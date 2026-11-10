// Assessment model: one assessment per facility × requirement × version.
// This module is pure: it decides which catalogue requirements apply to a
// facility, evaluates submitted values against a criterion, and summarises a
// facility's assessments. The records themselves live in lib/store/assessments.
import { FIFA_CATALOGUE } from "@/lib/domain/fifa-catalogue.mjs";
import { FACILITY_REGISTER, capacityRequirement } from "@/lib/domain/facilities.mjs";

export const APPLICABILITY = {
  applicable: "Applies",
  provisional: "Provisional",
  "not-applicable": "Not applicable",
};

export const STATUS = {
  unassessed: "Unassessed",
  declared: "Declared",
  "evidence-submitted": "Evidence submitted",
  compliant: "Compliant",
  "non-compliant": "Non-compliant",
};

export const assessmentKey = (facilityId, requirement) => `${facilityId}::${requirement.id}@v${requirement.version}`;

/**
 * Whether a requirement applies to a stadium, and why.
 * - Other asset types' requirements do not apply.
 * - Capacity: only the rule for the stadium's highest match applies.
 * - Lighting: the 2020 Lighting Guide is a provisional 2034 baseline, so its
 *   criteria apply provisionally until the tournament package confirms them.
 * - Everything else that names "All match allocations" applies.
 */
export function stadiumApplicability(stadium, requirement) {
  if (requirement.assetType !== "Stadium")
    return { value: "not-applicable", reason: `${requirement.assetType} requirement` };
  if (requirement.category === "Capacity") {
    const selected = capacityRequirement(stadium);
    return selected?.id === requirement.id
      ? { value: "applicable", reason: `Highest match: ${requirement.condition}` }
      : { value: "not-applicable", reason: `Applies to ${requirement.condition.toLowerCase()} venues` };
  }
  if (requirement.category === "Lighting")
    return {
      value: "provisional",
      reason:
        requirement.authority === "recommendation"
          ? "Recommendation; provisional 2020 lighting baseline"
          : "Provisional 2020 lighting baseline pending the tournament package",
    };
  return { value: "applicable", reason: requirement.condition };
}

/** Catalogue requirements with their applicability for one stadium. */
export function stadiumRequirements(stadium) {
  return FIFA_CATALOGUE.requirements.map((requirement) => ({
    requirement,
    key: assessmentKey(stadium.id, requirement),
    applicability: stadiumApplicability(stadium, requirement),
  }));
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
 * criterion is qualitative (classification, manual, protocol, …) or the value
 * is not a number. A pass or fail is still subject to reviewer decision.
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

/** Seed assessments derived from the register: declared capacities. */
export function seedAssessments() {
  const records = {};
  for (const stadium of FACILITY_REGISTER.stadiums) {
    const requirement = capacityRequirement(stadium);
    if (!requirement) continue;
    records[assessmentKey(stadium.id, requirement)] = {
      facilityId: stadium.id,
      requirementId: requirement.id,
      requirementVersion: requirement.version,
      status: "declared",
      declared: {
        value: stadium.grossCapacity,
        check: evaluate(requirement.criterion, stadium.grossCapacity),
        sourceId: stadium.sourceId,
        page: stadium.page,
      },
      evidence: [],
      review: null,
      history: [{ on: FACILITY_REGISTER.reviewedOn, action: "Declared capacity recorded from the facility register" }],
    };
  }
  return records;
}

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
    byStatus: Object.fromEntries(Object.keys(STATUS).map((s) => [s, count(s)])),
  };
}
