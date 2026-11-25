// Mitigation exposure: how hard it would be to recover each open finding at the
// stadium's current programme stage. The class is a property of the finding
// (one stadium x one requirement), never of the requirement family, and every
// finding is in exactly one of four classes.
//
// Rules, in order:
//   compliant                              -> controlled
//   failing (non-compliant, evidence that  -> critical, material or manageable,
//     misses its criterion, or a declared     from the cost of fixing that kind of
//     value that misses it)                   requirement, moved by how close the
//                                             stadium is to completion; provisional
//                                             criteria are capped at material
//   evidence awaiting review, or declared  -> manageable (the route is a reviewer
//     with evidence pending                    decision or a document)
//   not yet assessed                       -> manageable when the stadium completes
//                                             in 2027 or earlier (the assessment is
//                                             due), otherwise controlled (normal
//                                             delivery controls, not yet in window)
import { stadiumRequirements } from "@/lib/domain/assessment.mjs";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";
import { stadiumAssurance } from "@/lib/domain/cityAssurance.mjs";

export const EXPOSURE = {
  critical: {
    label: "Critical",
    tone: "bad",
    definition: "Late mitigation may require major redesign or rework, or threaten a key milestone.",
  },
  material: {
    label: "Material",
    tone: "warn",
    definition: "Mitigation is achievable but has meaningful cost, procurement or schedule impact.",
  },
  manageable: {
    label: "Manageable",
    tone: "info",
    definition: "A defined mitigation route exists with limited programme impact.",
  },
  controlled: {
    label: "Controlled",
    tone: "good",
    definition: "Compliant, or managed through normal delivery controls.",
  },
};
export const EXPOSURE_ORDER = ["critical", "material", "manageable", "controlled"];
const KEY_BY_LEVEL = ["controlled", "manageable", "material", "critical"];

// What it takes to fix a failing requirement of this kind: seating and pitch
// geometry mean structural rework; lighting is equipment and commissioning.
const FAIL_LEVEL = { Capacity: 3, Pitch: 3, Lighting: 2 };
const NEAR_YEAR = 2027; // completes this year or earlier: little time to recover
const FAR_YEAR = 2032; // completes this year or later: time to recover

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

function isFailing(record) {
  if (!record) return false;
  if (record.status === "non-compliant") return true;
  if (record.status === "evidence-submitted") return record.evidence?.at(-1)?.check === "fail";
  if (record.status === "declared") return record.declared?.check === "fail";
  return false;
}

/** The exposure class of one finding, with the reason it was given. */
export function findingExposure(stadium, row, record) {
  const status = record?.status || "unassessed";
  if (status === "compliant") return { level: "controlled", reason: "Accepted by a reviewer." };
  if (isFailing(record)) {
    const base = FAIL_LEVEL[row.requirement.category] ?? 2;
    const shift = stadium.completionYear <= NEAR_YEAR ? 1 : stadium.completionYear >= FAR_YEAR ? -1 : 0;
    // A provisional criterion (the 2020 lighting baseline) may still change, so it never counts as critical.
    const ceiling = row.applicability.value === "provisional" ? 2 : 3;
    const level = KEY_BY_LEVEL[clamp(base + shift, 1, ceiling)];
    const stage =
      shift > 0
        ? `the stadium completes in ${stadium.completionYear}, so there is little time to recover`
        : shift < 0
          ? `the stadium completes in ${stadium.completionYear}, so there is time to recover`
          : `the stadium completes in ${stadium.completionYear}`;
    return { level, reason: `${row.requirement.category} requirement not met; ${stage}.` };
  }
  if (status === "evidence-submitted") return { level: "manageable", reason: "Evidence is awaiting a reviewer decision." };
  if (status === "declared") return { level: "manageable", reason: "Declared in the bid; evidence still to be submitted." };
  if (stadium.completionYear <= NEAR_YEAR)
    return { level: "manageable", reason: "Not yet assessed and the stadium completes soon." };
  return { level: "controlled", reason: "Not yet in the assessment window; managed through normal delivery controls." };
}

/** Every in-scope finding for a stadium with its class, plus the four counts. */
export function stadiumExposure(stadium, records) {
  const counts = { critical: 0, material: 0, manageable: 0, controlled: 0 };
  const findings = [];
  for (const row of stadiumRequirements(stadium)) {
    if (row.applicability.value === "not-applicable") continue;
    const record = records[row.key];
    const { level, reason } = findingExposure(stadium, row, record);
    counts[level]++;
    findings.push({ row, record, level, reason });
  }
  return { counts, findings, total: findings.length };
}

/** Schedule position, from the exposure counts. */
export function schedulePosition(counts) {
  if (counts.critical > 0) return { key: "off-track", label: "Off track", tone: "bad" };
  if (counts.material > 0) return { key: "at-risk", label: "At risk", tone: "warn" };
  return { key: "on-track", label: "On track", tone: "good" };
}

/** The next gate, from the stadium's delivery status and completion year. */
export function nextGate(stadium) {
  if (stadium.status === "planned") return "Design freeze";
  if (stadium.status === "existing-refurbishment") return stadium.completionYear <= NEAR_YEAR ? "Commissioning" : "Procurement";
  return stadium.completionYear <= 2026 ? "Commissioning" : "Construction";
}

/** The national view: one row per stadium, worst first, plus programme figures. */
export function portfolio(records) {
  const rows = FACILITY_REGISTER.stadiums.map((stadium) => {
    const exposure = stadiumExposure(stadium, records);
    const assurance = stadiumAssurance(stadium, records);
    const city = FACILITY_REGISTER.hostCities.find((c) => c.id === stadium.cityId);
    return {
      stadium,
      cityName: city ? city.name : "",
      assured: assurance.assured,
      awaiting: assurance["evidence-submitted"],
      counts: exposure.counts,
      issues: exposure.counts.critical + exposure.counts.material,
      schedule: schedulePosition(exposure.counts),
      gate: nextGate(stadium),
    };
  });
  rows.sort(
    (a, b) =>
      b.counts.critical - a.counts.critical ||
      b.counts.material - a.counts.material ||
      a.assured - b.assured ||
      a.stadium.name.localeCompare(b.stadium.name),
  );
  const sum = (key) => rows.reduce((t, r) => t + r.counts[key], 0);
  const inScope = rows.reduce((t, r) => t + Object.values(r.counts).reduce((a, b) => a + b, 0), 0);
  const compliant = rows.reduce((t, r) => t + Math.round(r.assured * Object.values(r.counts).reduce((a, b) => a + b, 0)), 0);
  return {
    rows,
    kpis: {
      stadiums: rows.length,
      inScope,
      compliant,
      compliance: inScope ? compliant / inScope : 0,
      atRisk: rows.filter((r) => r.issues > 0).length,
      withCritical: rows.filter((r) => r.counts.critical > 0).length,
      criticalIssues: sum("critical"),
      materialIssues: sum("material"),
      awaitingReview: rows.reduce((t, r) => t + r.awaiting, 0),
      offTrack: rows.filter((r) => r.schedule.key === "off-track").length,
      atRiskOnly: rows.filter((r) => r.schedule.key === "at-risk").length,
    },
  };
}
