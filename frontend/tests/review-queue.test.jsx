import { test } from "vitest";
import assert from "node:assert/strict";
import { assuranceMap } from "@/lib/domain/cityAssurance.mjs";
import { seedAssessments } from "@/lib/domain/assessment.mjs";
import { queueCounts, reviewQueue } from "@/lib/domain/reviewQueue.mjs";
import { sampleAssessments } from "@/lib/domain/sampleAssessments.mjs";

test("declared-only data has an empty queue", () => {
  assert.equal(reviewQueue(seedAssessments()).length, 0);
});

test("queue matches the map's attention counts, overall and per city", () => {
  const records = sampleAssessments();
  const map = assuranceMap(records);
  assert.equal(reviewQueue(records).length, map.programme.needsAttention);
  for (const city of map.cities) {
    assert.equal(reviewQueue(records, { cityId: city.id }).length, city.assurance.needsAttention, city.id);
  }
  const y2027 = assuranceMap(records, "Pitch", 2027);
  assert.equal(reviewQueue(records, { category: "Pitch", year: 2027 }).length, y2027.programme.needsAttention);
});

test("queue is ordered by delivery year, failed checks first", () => {
  const items = reviewQueue(sampleAssessments());
  for (let i = 1; i < items.length; i++) {
    assert.ok(items[i - 1].stadium.completionYear <= items[i].stadium.completionYear);
  }
  const first2026 = items.filter((i) => i.stadium.id === items[0].stadium.id);
  const rank = { fail: 0, "non-compliant": 1, "needs-review": 2, pass: 3 };
  for (let i = 1; i < first2026.length; i++) assert.ok(rank[first2026[i - 1].reason] <= rank[first2026[i].reason]);
});

test("status filter and counts", () => {
  const records = sampleAssessments();
  const all = reviewQueue(records);
  const c = queueCounts(all);
  assert.equal(c["evidence-submitted"] + c["non-compliant"], c.total);
  assert.ok(c.fail > 0 && c.fail < c["evidence-submitted"]); // sample has some failing evidence
  assert.equal(reviewQueue(records, { status: "non-compliant" }).length, c["non-compliant"]);
  assert.ok(reviewQueue(records, { status: "non-compliant" }).every((i) => i.reason === "non-compliant"));
});
