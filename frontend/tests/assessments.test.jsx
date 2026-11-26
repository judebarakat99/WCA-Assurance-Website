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
import { complianceRows } from "@/lib/register/data.mjs";
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
  const notApplicable = complianceRows().filter(
    (r) => r.stadiumId === "aramco" && r.status === "Not applicable",
  ).length;
  assert.equal(rows.filter((r) => r.requirement.assetType === "Stadium").length, 123);
  assert.equal(rows.filter((r) => r.applicability.value !== "not-applicable").length, 123 - notApplicable);
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

test("the seed is the compliance register: one record per assessed row, statuses as in the CSV", () => {
  const seed = seedAssessments();
  const rows = complianceRows().filter((r) => !["Not assessed", "Not applicable"].includes(r.status));
  assert.equal(Object.keys(seed).length, rows.length);
  const count = (status, partial = false) =>
    Object.values(seed).filter((a) => a.status === status && a.partial === partial).length;
  assert.equal(count("compliant"), rows.filter((r) => r.status === "Compliant").length);
  assert.equal(count("non-compliant", true), rows.filter((r) => r.status === "Partially compliant").length);
  assert.equal(count("evidence-submitted"), rows.filter((r) => r.status === "Evidence submitted").length);
  // the declared capacity is checked against the stadium's own threshold
  assert.equal(seed[assessmentKey("king-salman-international", requirement("STA-0004"))].declared.check, "pass"); // 92,760 ≥ 80,000
});

test("evidence is checked against the stadium's own capacity threshold, then reviewed", () => {
  const kfsc = row("king-fahad-sports-city", "STA-0004").requirement;
  recordEvidence("king-fahad-sports-city", kfsc, { file: "kfsc_seating_plan.pdf", value: "55000" });
  let a = getAssessments()[assessmentKey("king-fahad-sports-city", kfsc)];
  assert.equal(a.evidence.at(-1).check, "fail"); // semi-final venue needs 60,000
  const r = row("aramco", "STA-0004").requirement;
  recordEvidence("aramco", r, { file: "aramco_seating_plan.pdf", value: "46096" });
  a = getAssessments()[assessmentKey("aramco", r)];
  assert.equal(a.status, "evidence-submitted");
  assert.equal(a.evidence.at(-1).check, "pass");
  reviewAssessment("aramco", r, "compliant");
  a = getAssessments()[assessmentKey("aramco", r)];
  assert.equal(a.status, "compliant");
  assert.ok(a.history.length >= 2); // evidence, then the review
});

test("facility summary counts scope, coverage and status", () => {
  const s = stadium("king-fahad-sports-city");
  const rows = stadiumRequirements(s);
  const before = facilitySummary(rows, getAssessments());
  const notApplicable = complianceRows().filter((r) => r.stadiumId === s.id && r.status === "Not applicable").length;
  assert.equal(before.inScope, 123 - notApplicable);
  assert.equal(before.applicable + before.provisional, before.inScope);
  assert.equal(before.assessed, before.inScope - before.byStatus.unassessed);
  const open = rows.find((r) => r.applicability.value !== "not-applicable" && !getAssessments()[r.key]);
  recordEvidence(s.id, open.requirement, { file: "new-evidence.pdf", value: "" });
  const after = facilitySummary(rows, getAssessments());
  assert.equal(after.assessed, before.assessed + 1);
  assert.equal(after.byStatus["evidence-submitted"], before.byStatus["evidence-submitted"] + 1);
});

test("records and changes for checks no longer in the catalogue are dropped on load", async () => {
  const { vi } = await import("vitest");
  const mem = {
    "wca-assessments-v3": JSON.stringify({
      "aramco::F34-ST-CAP-01@v1": { requirementId: "F34-ST-CAP-01", status: "compliant", sample: true },
    }),
    "wca-requirement-changes-v1": JSON.stringify([
      { changeId: "CHG-LUX-2000", requirementId: "FL-A-EV-AVG", version: 2 },
    ]),
  };
  globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => (mem[k] = String(v)) };
  vi.resetModules();
  const store = await import("@/lib/store/assessments");
  const all = store.getAssessments();
  assert.equal(all["aramco::F34-ST-CAP-01@v1"], undefined); // an unknown check is dropped; the register seed remains
  assert.equal(Object.keys(all).length, Object.keys(seedAssessments()).length);
  assert.equal(store.getAppliedChanges().length, 0);
});
