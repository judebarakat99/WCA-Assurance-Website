// Sample assessments for demonstrations. Every record is marked sample: true
// and its evidence file is named "sample_…", so the UI can label it. Values are
// generated deterministically, so the demo looks the same on every machine.
// Stadiums due earlier are further along; nothing here is real evidence.
import { assessmentKey, evaluate, seedAssessments, stadiumRequirements } from "@/lib/domain/assessment.mjs";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";

const SAMPLE_DATE = "2026-11-02";

// Share of in-scope requirements assessed, by stadium completion year.
const PROGRESS = { 2026: 0.85, 2027: 0.7, 2029: 0.45, 2032: 0.3 };

// Small deterministic hash in [0, 1).
function unit(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

// A value that meets (or misses) a numeric criterion, or a stated value otherwise.
function sampleValue(criterion, meets) {
  const ops = { min: 1, gte: 1, gt: 1, max: -1, lte: -1, lt: -1 };
  if (criterion.operator in ops && typeof criterion.value === "number") {
    const dir = ops[criterion.operator] * (meets ? 1 : -1);
    const step = Math.max(Math.abs(criterion.value) * 0.06, criterion.value < 2 ? 0.05 : 1);
    return String(Math.round((criterion.value + dir * step) * 100) / 100);
  }
  if (criterion.operator === "eq") return String(meets ? criterion.value : criterion.value * 0.97);
  if (criterion.operator === "range") return String(meets ? criterion.minimum : criterion.minimum * 0.9);
  return meets ? String(criterion.value ?? "Confirmed") : "Not confirmed";
}

/** Seed records plus generated sample evidence and reviews. */
export function sampleAssessments() {
  const records = seedAssessments();
  for (const stadium of FACILITY_REGISTER.stadiums) {
    const progress = PROGRESS[stadium.completionYear] ?? 0.3;
    for (const row of stadiumRequirements(stadium)) {
      if (row.applicability.value === "not-applicable") continue;
      const key = assessmentKey(stadium.id, row.requirement);
      const r = unit(key);
      if (r >= progress) continue; // stays as it is (unassessed or declared)
      const outcome = r < progress * 0.7 ? "compliant" : r < progress * 0.88 ? "evidence-submitted" : "non-compliant";
      // About a third of the evidence awaiting review misses its criterion.
      const meets = outcome === "compliant" || (outcome === "evidence-submitted" && unit(`${key}#check`) >= 0.35);
      const value = sampleValue(row.requirement.criterion, meets);
      const file = `sample_${row.requirement.id}_${stadium.id}.pdf`;
      const base = records[key] || {
        facilityId: stadium.id,
        requirementId: row.requirement.id,
        requirementVersion: row.requirement.version,
        history: [],
      };
      records[key] = {
        ...base,
        sample: true,
        status: outcome,
        evidence: [{ file, value, note: "Sample data", check: evaluate(row.requirement.criterion, value), on: SAMPLE_DATE }],
        review:
          outcome === "evidence-submitted"
            ? null
            : { outcome, by: "Compliance reviewer (sample)", on: SAMPLE_DATE, note: "Sample data" },
        history: [...base.history, { on: SAMPLE_DATE, action: `Sample: ${outcome}` }],
      };
    }
  }
  return records;
}
