import { test } from "vitest";
import assert from "node:assert/strict";
import { assuranceMap } from "@/lib/domain/cityAssurance.mjs";
import { seedAssessments, stadiumRequirements } from "@/lib/domain/assessment.mjs";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";
import { EVIDENCE_PAGE_NOTE, QUEUE_STATUSES, queueCounts, reviewQueue } from "@/lib/domain/reviewQueue.mjs";

test("the register seed's queue holds every in-scope item awaiting review or not fulfilled", () => {
  const records = seedAssessments();
  let expected = 0;
  for (const s of FACILITY_REGISTER.stadiums)
    for (const r of stadiumRequirements(s))
      if (r.applicability.value !== "not-applicable" && QUEUE_STATUSES.includes(records[r.key]?.status)) expected++;
  assert.equal(reviewQueue(records).length, expected);
  assert.ok(expected > 0);
});

test("queue matches the map's attention counts, overall and per city", () => {
  const records = seedAssessments();
  const map = assuranceMap(records);
  assert.equal(reviewQueue(records).length, map.programme.needsAttention);
  for (const city of map.cities) {
    assert.equal(reviewQueue(records, { cityId: city.id }).length, city.assurance.needsAttention, city.id);
  }
});

test("queue is ordered by delivery year, failed checks first", () => {
  const items = reviewQueue(seedAssessments());
  for (let i = 1; i < items.length; i++) {
    assert.ok(items[i - 1].stadium.completionYear <= items[i].stadium.completionYear);
  }
  const first = items.filter((i) => i.stadium.id === items[0].stadium.id);
  const rank = { fail: 0, "non-compliant": 1, "partially-compliant": 1, "needs-review": 2, pass: 3 };
  for (let i = 1; i < first.length; i++) assert.ok(rank[first[i - 1].reason] <= rank[first[i].reason]);
});

test("status filter and counts", () => {
  const records = seedAssessments();
  const c = queueCounts(reviewQueue(records));
  assert.equal(c["evidence-submitted"] + c["non-compliant"], c.total);
  assert.ok(c.partial > 0 && c.partial <= c["non-compliant"]);
  const notFulfilled = reviewQueue(records, { status: "non-compliant" });
  assert.equal(notFulfilled.length, c["non-compliant"]);
  assert.ok(notFulfilled.every((i) => i.reason === "non-compliant" || i.reason === "partially-compliant"));
});

test("evidence confirmed on the Evidence page comes first, marked new", () => {
  const records = seedAssessments();
  const late = FACILITY_REGISTER.stadiums.reduce((a, b) => (b.completionYear > a.completionYear ? b : a));
  const row = stadiumRequirements(late).find((r) => r.applicability.value !== "not-applicable" && !records[r.key]);
  records[row.key] = {
    facilityId: late.id,
    requirementId: row.requirement.id,
    status: "evidence-submitted",
    evidence: [
      {
        file: "new.pdf",
        value: "",
        note: `${EVIDENCE_PAGE_NOTE}, revision B`,
        check: "needs-review",
        on: "2026-11-26",
      },
    ],
    history: [],
  };
  const items = reviewQueue(records);
  assert.equal(items[0].key, row.key);
  assert.equal(items[0].isNew, true);
  assert.equal(queueCounts(items).new, 1);
});
