import { beforeEach, test } from "vitest";
import assert from "node:assert/strict";
import {
  assessmentKey,
  evaluate,
  facilitySummary,
  seedAssessments,
  stadiumApplicability,
  stadiumRequirements,
} from "@/lib/domain/assessment.mjs";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";
import { FIFA_CATALOGUE } from "@/lib/domain/fifa-catalogue.mjs";
import { getAssessments, recordEvidence, resetAssessments, reviewAssessment } from "@/lib/store/assessments";

const stadium = (id) => FACILITY_REGISTER.stadiums.find((s) => s.id === id);
const requirement = (id) => FIFA_CATALOGUE.requirements.find((r) => r.id === id);

beforeEach(() => {
  const mem = {};
  globalThis.localStorage = {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => (mem[k] = String(v)),
  };
  resetAssessments();
});

test("exactly one capacity rule applies, chosen by highest match", () => {
  for (const s of FACILITY_REGISTER.stadiums) {
    const capacity = stadiumRequirements(s).filter(
      (r) => r.requirement.category === "Capacity" && r.applicability.value === "applicable",
    );
    assert.equal(capacity.length, 1, s.id);
  }
  assert.equal(stadiumApplicability(stadium("king-salman-international"), requirement("F34-ST-CAP-03")).value, "applicable");
  assert.equal(stadiumApplicability(stadium("king-salman-international"), requirement("F34-ST-CAP-01")).value, "not-applicable");
});

test("training-site requirements do not apply to stadiums; lighting is provisional", () => {
  const rows = stadiumRequirements(stadium("aramco"));
  for (const r of rows.filter((x) => x.requirement.assetType === "Training site"))
    assert.equal(r.applicability.value, "not-applicable", r.requirement.id);
  for (const r of rows.filter((x) => x.requirement.category === "Lighting" && x.requirement.assetType === "Stadium"))
    assert.equal(r.applicability.value, "provisional", r.requirement.id);
  assert.equal(stadiumApplicability(stadium("aramco"), requirement("F34-ST-PITCH-01")).value, "applicable");
});

test("evaluate respects strict and inclusive operators and qualitative criteria", () => {
  assert.equal(evaluate({ operator: "min", value: 40000 }, 40000), "pass");
  assert.equal(evaluate({ operator: "gt", value: 2500 }, 2500), "fail");
  assert.equal(evaluate({ operator: "gt", value: 2500 }, 2501), "pass");
  assert.equal(evaluate({ operator: "lt", value: 1 }, 1), "fail");
  assert.equal(evaluate({ operator: "range", minimum: 5000, maximum: 6500 }, 5600), "pass");
  assert.equal(evaluate({ operator: "classification", value: "Grade 1" }, "Grade 1"), "needs-review");
  assert.equal(evaluate({ operator: "min", value: 1 }, ""), "needs-review");
});

test("seed holds only declared capacities, all passing, evidence pending", () => {
  const seed = seedAssessments();
  assert.equal(Object.keys(seed).length, 15);
  for (const a of Object.values(seed)) {
    assert.equal(a.status, "declared");
    assert.equal(a.declared.check, "pass");
    assert.equal(a.evidence.length, 0);
  }
});

test("evidence then review moves an assessment to compliant", () => {
  const s = stadium("aramco");
  const r = requirement("F34-ST-CAP-01");
  recordEvidence(s.id, r, { file: "aramco_seating_plan.pdf", value: "46096" });
  let a = getAssessments()[assessmentKey(s.id, r)];
  assert.equal(a.status, "evidence-submitted");
  assert.equal(a.evidence.at(-1).check, "pass");
  reviewAssessment(s.id, r, "compliant");
  a = getAssessments()[assessmentKey(s.id, r)];
  assert.equal(a.status, "compliant");
  assert.equal(a.review.outcome, "compliant");
  assert.ok(a.history.length >= 3);
});

test("facility summary counts scope, coverage and status", () => {
  const s = stadium("king-fahad-sports-city");
  const rows = stadiumRequirements(s);
  const before = facilitySummary(rows, getAssessments());
  assert.equal(before.applicable, 3); // capacity (semi-final) + two pitch requirements
  assert.ok(before.provisional > 20);
  assert.equal(before.assessed, 1);
  assert.equal(before.byStatus.declared, 1);
  recordEvidence(s.id, requirement("F34-ST-PITCH-01"), { file: "pitch.pdf", value: "105" });
  const after = facilitySummary(rows, getAssessments());
  assert.equal(after.assessed, 2);
  assert.equal(after.byStatus["evidence-submitted"], 1);
});
