// Review queue: every in-scope assessment that needs a person, across all
// stadiums. Two kinds:
//  - evidence submitted, waiting for a reviewer's decision;
//  - non-compliant, waiting for the facility to remediate and resubmit.
// Ordered by delivery date (earliest stadium first), then by what the
// evidence suggests: a failed check is most likely to end non-compliant.
import { stadiumRequirements } from "@/lib/domain/assessment.mjs";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";

export const QUEUE_STATUSES = ["evidence-submitted", "non-compliant"];

// Lower is more urgent within a stadium.
const RANK = { fail: 0, "non-compliant": 1, "needs-review": 2, pass: 3 };

export const QUEUE_REASON = {
  fail: "Evidence is below the criterion",
  "needs-review": "Evidence needs a reviewer's judgement",
  pass: "Evidence meets the criterion; confirm",
  "non-compliant": "Non-compliant; waiting for new evidence",
};

/** Why an item is in the queue: "fail" | "needs-review" | "pass" | "non-compliant". */
function reasonOf(record) {
  if (record.status === "non-compliant") return "non-compliant";
  return record.evidence.at(-1)?.check || "needs-review";
}

/**
 * Items needing attention, filtered. Every filter is optional:
 * cityId, category, year (stadiums due complete by then), status
 * ("evidence-submitted", "non-compliant", or "reopened": back in review
 * because a requirement change made compliant evidence fail).
 */
export function reviewQueue(records, { cityId = null, category = null, year = null, status = null } = {}) {
  const cities = Object.fromEntries(FACILITY_REGISTER.hostCities.map((c) => [c.id, c]));
  const items = [];
  for (const stadium of FACILITY_REGISTER.stadiums) {
    if (cityId && stadium.cityId !== cityId) continue;
    if (year && stadium.completionYear > year) continue;
    for (const row of stadiumRequirements(stadium)) {
      if (row.applicability.value === "not-applicable") continue;
      if (category && row.requirement.category !== category) continue;
      const record = records[row.key];
      if (!record || !QUEUE_STATUSES.includes(record.status)) continue;
      if (status === "reopened" ? !(record.reopenedBy && record.status === "evidence-submitted") : status && record.status !== status)
        continue;
      const reason = reasonOf(record);
      items.push({
        key: row.key,
        stadium,
        city: cities[stadium.cityId],
        requirement: row.requirement,
        applicability: row.applicability,
        record,
        evidence: record.evidence.at(-1) || null,
        reason,
        reopenedBy: record.status === "evidence-submitted" ? record.reopenedBy || null : null,
      });
    }
  }
  items.sort(
    (a, b) =>
      a.stadium.completionYear - b.stadium.completionYear ||
      RANK[a.reason] - RANK[b.reason] ||
      a.stadium.name.localeCompare(b.stadium.name) ||
      a.requirement.id.localeCompare(b.requirement.id),
  );
  return items;
}

/** Counts by kind for a list of queue items. */
export function queueCounts(items) {
  const c = { total: items.length, "evidence-submitted": 0, "non-compliant": 0, fail: 0 };
  for (const i of items) {
    c[i.record.status]++;
    if (i.reason === "fail") c.fail++;
  }
  return c;
}
