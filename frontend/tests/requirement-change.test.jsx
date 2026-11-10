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
  const impact = changeImpact(scenarioById("CHG-LUX-2000"), records);
  assert.equal(impact.after.version, impact.before.version + 1);
  assert.equal(impact.counts.stadiums, 15); // lighting applies to every stadium
  assert.ok(impact.counts.reopened > 0);
  for (const r of impact.rows) {
    if (r.outcome === "reopened") assert.equal(r.record.status, "compliant");
    if (r.outcome === "carried") assert.equal(r.newCheck, "pass");
  }
  const total = Object.entries(impact.counts)
    .filter(([k]) => !["flipped", "stadiums"].includes(k))
    .reduce((a, [, n]) => a + n, 0);
  assert.equal(total, impact.counts.stadiums);
  assert.equal(currentRequirement("FL-A-EV-AVG").version, 1); // a preview applies nothing
});

test("applying a change moves the requirement to v2 and reopens items into the queue", () => {
  const before = assuranceMap(getAssessments()).programme;
  const queueBefore = reviewQueue(getAssessments()).length;
  const impact = applyRequirementChange("CHG-LUX-2000");
  assert.equal(currentRequirement("FL-A-EV-AVG").version, 2);
  assert.equal(currentRequirement("FL-A-EV-AVG").criterion.value, 2000);
  const after = assuranceMap(getAssessments()).programme;
  assert.equal(after.inScope, before.inScope);
  assert.equal(after.compliant, before.compliant - impact.counts.reopened);
  const queue = reviewQueue(getAssessments());
  assert.equal(queue.length, queueBefore + impact.counts.reopened);
  assert.equal(queue.filter((i) => i.record.reopenedBy === "CHG-LUX-2000").length, impact.counts.reopened);
  assert.equal(applyRequirementChange("CHG-LUX-2000"), null); // only once
  assert.equal(getAppliedChanges().length, 1);
});

test("declared capacities are re-checked by a capacity change; reset restores version 1", () => {
  resetAssessments();
  const impact = applyRequirementChange("CHG-SEMI-65K");
  assert.ok(impact.counts.declared > 0);
  for (const r of impact.rows) assert.equal(r.newCheck, r.value >= 65000 ? "pass" : "fail");
  resetAssessments();
  assert.equal(currentRequirement("F34-ST-CAP-02").version, 1);
  assert.equal(getAppliedChanges().length, 0);
});

test("the map overlay counts reopened items per city and drops assured accordingly", async () => {
  const { withImpact } = await import("@/lib/domain/requirementChange.mjs");
  const records = getAssessments();
  const impact = changeImpact(scenarioById("CHG-LUX-2000"), records);
  const view = withImpact(assuranceMap(records), impact);
  assert.equal(view.impact.programme.reopened, impact.counts.reopened);
  for (const c of view.cities) {
    assert.ok(c.impact.assuredAfter <= c.impact.assuredBefore, c.id);
    if (c.impact.reopened) assert.equal(c.tone, "bad");
  }
  const otherArea = withImpact(assuranceMap(records, "Pitch"), impact, "Pitch");
  assert.equal(otherArea.impact.programme.reopened, 0);
  const early = withImpact(assuranceMap(records, null, 2026), impact);
  assert.ok(early.impact.programme.stadiums <= 2);
});
