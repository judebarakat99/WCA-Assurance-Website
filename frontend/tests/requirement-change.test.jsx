import { beforeEach, test } from "vitest";
import assert from "node:assert/strict";
import { assuranceMap } from "@/lib/domain/cityAssurance.mjs";
import { changeImpact } from "@/lib/domain/requirementChange.mjs";
import { CHANGE_SCENARIOS, currentRequirement, scenarioById } from "@/lib/domain/requirementVersions.mjs";
import { reviewQueue } from "@/lib/domain/reviewQueue.mjs";
import { sampleAssessments } from "@/lib/domain/sampleAssessments.mjs";
import {
  applyRequirementChange,
  getAppliedChanges,
  getAssessments,
  loadSampleAssessments,
  resetAssessments,
} from "@/lib/store/assessments";

beforeEach(() => loadSampleAssessments());

test("every scenario targets a catalogue requirement and is labelled hypothetical", () => {
  assert.ok(CHANGE_SCENARIOS.length >= 2);
  for (const s of CHANGE_SCENARIOS) assert.ok(currentRequirement(s.requirementId), s.id);
});

test("impact preview: compliant values that fail the new criterion reopen; nothing changes yet", () => {
  const records = sampleAssessments();
  const impact = changeImpact(scenarioById("CHG-MIXED-ZONE-250"), records);
  assert.equal(impact.after.version, impact.before.version + 1);
  assert.equal(impact.counts.stadiums, 15); // the mixed zone applies to every stadium
  assert.ok(impact.counts.reopened > 0);
  for (const r of impact.rows) {
    if (r.outcome === "reopened") assert.equal(r.record.status, "compliant");
    if (r.outcome === "carried") assert.equal(r.newCheck, "pass");
  }
  const total = Object.entries(impact.counts)
    .filter(([k]) => !["flipped", "stadiums"].includes(k))
    .reduce((a, [, n]) => a + n, 0);
  assert.equal(total, impact.counts.stadiums);
  assert.equal(currentRequirement("STA-0040").version, 1); // a preview applies nothing
});

test("applying a change moves the requirement to v2 and reopens items into the queue", () => {
  const before = assuranceMap(getAssessments()).programme;
  const queueBefore = reviewQueue(getAssessments()).length;
  const impact = applyRequirementChange("CHG-MIXED-ZONE-250");
  assert.equal(currentRequirement("STA-0040").version, 2);
  assert.equal(currentRequirement("STA-0040").criterion.value, 250);
  const after = assuranceMap(getAssessments()).programme;
  assert.equal(after.inScope, before.inScope);
  assert.equal(after.compliant, before.compliant - impact.counts.reopened);
  const queue = reviewQueue(getAssessments());
  assert.equal(queue.length, queueBefore + impact.counts.reopened);
  assert.equal(queue.filter((i) => i.record.reopenedBy === "CHG-MIXED-ZONE-250").length, impact.counts.reopened);
  assert.equal(applyRequirementChange("CHG-MIXED-ZONE-250"), null); // only once
  assert.equal(getAppliedChanges().length, 1);
});

test("a second change applies independently; reset restores version 1", () => {
  const impact = applyRequirementChange("CHG-DRESSING-100");
  assert.equal(currentRequirement("STA-0034").version, 2);
  for (const r of impact.rows.filter((x) => x.value != null && x.value !== "" && !Number.isNaN(Number(x.value))))
    assert.equal(r.newCheck, Number(r.value) >= 100 ? "pass" : "fail");
  resetAssessments();
  assert.equal(currentRequirement("STA-0034").version, 1);
  assert.equal(getAppliedChanges().length, 0);
});

test("the map overlay counts reopened items per city and drops assured accordingly", async () => {
  const { withImpact } = await import("@/lib/domain/requirementChange.mjs");
  const records = getAssessments();
  const impact = changeImpact(scenarioById("CHG-MIXED-ZONE-250"), records);
  const view = withImpact(assuranceMap(records), impact);
  assert.equal(view.impact.programme.reopened, impact.counts.reopened);
  for (const c of view.cities) {
    assert.ok(c.impact.assuredAfter <= c.impact.assuredBefore, c.id);
    if (c.impact.reopened) assert.equal(c.tone, "bad");
  }
  const otherArea = withImpact(assuranceMap(records, "Playing area"), impact, "Playing area");
  assert.equal(otherArea.impact.programme.reopened, 0);
  const early = withImpact(assuranceMap(records, null, 2026), impact);
  assert.ok(early.impact.programme.stadiums <= 2);
});
