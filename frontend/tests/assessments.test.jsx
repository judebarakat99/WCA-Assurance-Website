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
const row = (stadiumId, id) => stadiumRequirements(stadium(stadiumId)).find((r) => r.requirement.id === id);

beforeEach(() => {
  const mem = {};
  globalThis.localStorage = {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => (mem[k] = String(v)),
  };
  resetAssessments();
});

test("the capacity threshold follows each stadium's highest match", () => {
  assert.equal(row("king-salman-international", "STA-0004").requirement.criterion.value, 80000);
  assert.equal(row("king-fahad-sports-city", "STA-0004").requirement.criterion.value, 60000);
  assert.equal(row("aramco", "STA-0004").requirement.criterion.value, 40000);
  assert.equal(row("prince-mohammed-bin-salman", "STA-0004").requirement.criterion.value, 40000); // third-place play-off
  assert.equal(row("aramco", "STA-0004").applicability.value, "applicable");
});

test("123 stadium checks apply; other sites' checks do not; working targets are provisional", () => {
  const rows = stadiumRequirements(stadium("aramco"));
  assert.equal(rows.length, 181);
  assert.equal(rows.filter((r) => r.applicability.value !== "not-applicable").length, 123);
  for (const r of rows.filter((x) => x.requirement.assetType !== "Stadium"))
    assert.equal(r.applicability.value, "not-applicable", r.requirement.id);
  assert.equal(stadiumApplicability(stadium("aramco"), requirement("STA-0034")).value, "applicable"); // book criterion
  assert.equal(stadiumApplicability(stadium("aramco"), requirement("STA-0053")).value, "provisional"); // working target
});

test("evaluate respects strict and inclusive operators and qualitative criteria", () => {
  assert.equal(evaluate({ operator: "min", value: 40000 }, 40000), "pass");
  assert.equal(evaluate({ operator: "gt", value: 2500 }, 2500), "fail");
  assert.equal(evaluate({ operator: "max", value: 250 }, 251), "fail");
  assert.equal(evaluate({ operator: "range", minimum: 0.5, maximum: 1 }, 0.7), "pass");
  assert.equal(evaluate({ operator: "manual", description: "Approved plan" }, "Approved"), "needs-review");
  assert.equal(evaluate({ operator: "min", value: 1 }, ""), "needs-review");
});

test("seed holds only declared capacities, checked against each stadium's threshold", () => {
  const seed = seedAssessments();
  assert.equal(Object.keys(seed).length, 15);
  for (const a of Object.values(seed)) {
    assert.equal(a.status, "declared");
    assert.equal(a.requirementId, "STA-0004");
    assert.equal(a.evidence.length, 0);
  }
  assert.equal(seed[assessmentKey("king-salman-international", requirement("STA-0004"))].declared.check, "pass"); // 92,760 ≥ 80,000
});

test("evidence is checked against the stadium's own capacity threshold, then reviewed", () => {
  const r = requirement("STA-0004");
  recordEvidence("king-fahad-sports-city", r, { file: "kfsc_seating_plan.pdf", value: "55000" });
  let a = getAssessments()[assessmentKey("king-fahad-sports-city", r)];
  assert.equal(a.evidence.at(-1).check, "fail"); // semi-final venue needs 60,000
  recordEvidence("aramco", r, { file: "aramco_seating_plan.pdf", value: "46096" });
  a = getAssessments()[assessmentKey("aramco", r)];
  assert.equal(a.status, "evidence-submitted");
  assert.equal(a.evidence.at(-1).check, "pass");
  reviewAssessment("aramco", r, "compliant");
  a = getAssessments()[assessmentKey("aramco", r)];
  assert.equal(a.status, "compliant");
  assert.ok(a.history.length >= 3);
});

test("facility summary counts scope, coverage and status", () => {
  const s = stadium("king-fahad-sports-city");
  const rows = stadiumRequirements(s);
  const before = facilitySummary(rows, getAssessments());
  assert.equal(before.inScope, 123);
  assert.equal(before.applicable, 21); // book criteria, including capacity
  assert.equal(before.provisional, 102);
  assert.equal(before.assessed, 1);
  recordEvidence(s.id, requirement("STA-0040"), { file: "mixed-zone.pdf", value: "220" });
  const after = facilitySummary(rows, getAssessments());
  assert.equal(after.assessed, 2);
  assert.equal(after.byStatus["evidence-submitted"], 1);
});

test("records and changes for checks no longer in the catalogue are dropped on load", async () => {
  const { vi } = await import("vitest");
  const mem = {
    "wca-assessments-v1": JSON.stringify({ "aramco::F34-ST-CAP-01@v1": { requirementId: "F34-ST-CAP-01", status: "compliant", sample: true } }),
    "wca-requirement-changes-v1": JSON.stringify([{ changeId: "CHG-LUX-2000", requirementId: "FL-A-EV-AVG", version: 2 }]),
  };
  globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => (mem[k] = String(v)) };
  vi.resetModules();
  const store = await import("@/lib/store/assessments");
  const all = store.getAssessments();
  assert.equal(Object.keys(all).length, 15); // only the declared capacities remain
  assert.ok(Object.values(all).every((a) => a.requirementId === "STA-0004"));
  assert.equal(store.hasSampleAssessments(), false);
  assert.equal(store.getAppliedChanges().length, 0);
});
