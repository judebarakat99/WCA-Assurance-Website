import { assuranceMap } from "@/lib/domain/cityAssurance.mjs";
import { queueCounts, reviewQueue } from "@/lib/domain/reviewQueue.mjs";
import { getAppliedChanges, getAssessments } from "@/lib/store/assessments";

// Ratios rounded for a compact payload.
const r3 = (x) => Math.round(x * 1000) / 1000;

const rollup = (a) => ({
  assured: r3(a.assured),
  coverage: r3(a.coverage),
  in_scope: a.inScope,
  compliant: a.compliant,
  non_compliant: a["non-compliant"],
  evidence_submitted: a["evidence-submitted"],
  unassessed: a.unassessed,
  needs_attention: a.needsAttention,
});

/**
 * A bounded snapshot of the assurance state shown in the browser: programme
 * roll-up, one entry per stadium, the review queue size and the applied
 * requirement changes. Never credentials or DOM HTML.
 */
export function buildAssistantContext() {
  const records = getAssessments();
  const map = assuranceMap(records);
  const queue = queueCounts(reviewQueue(records));
  return {
    source: "browser-demo",
    as_of: new Date().toISOString().slice(0, 10),
    summary: {
      assured: r3(map.programme.assured),
      ...rollup(map.programme),
      review_queue: queue,
      applied_changes: getAppliedChanges().map((c) => c.scenarioId ?? c),
    },
    venues: map.cities.flatMap((city) =>
      city.stadiums.map((s) => ({
        id: s.id,
        name: s.name,
        city: city.name,
        type: "Stadium",
        completion_year: s.completionYear,
        assurance: rollup(s.assurance),
      })),
    ),
  };
}
