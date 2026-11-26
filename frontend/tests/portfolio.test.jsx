import { beforeEach, test } from "vitest";
import assert from "node:assert/strict";
import readings from "../../data/progress/offline-readings.json" with { type: "json" };
import { portfolio } from "@/lib/domain/portfolio.mjs";
import { scheduleSlipDays } from "@/lib/domain/progressCheck.mjs";
import { getAssessments, loadSampleAssessments, resetAssessments } from "@/lib/store/assessments";
import { localCheck, localClear, localFile, localSeed, localUpload } from "@/lib/store/intakeLocal";

beforeEach(() => {
  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  resetAssessments();
  localClear();
});

function kfsc() {
  for (const f of readings.files.filter((x) => x.folder === "to-upload")) {
    const row = localUpload({ name: f.name, size: f.size });
    localFile(row.document_id, row);
  }
  return localCheck("king-fahad-sports-city");
}

test("schedule slip: on plan is zero, behind plan is positive", () => {
  const state = localSeed();
  const aramco = scheduleSlipDays(state.checks.aramco); // 86.8% actual vs 88.7% planned
  const pfbf = scheduleSlipDays(state.checks["prince-faisal-bin-fahad"]); // 57.4% vs 71.1%
  assert.ok(aramco >= 0 && aramco <= 7, `aramco ${aramco}`);
  assert.ok(pfbf > 30, `pfbf ${pfbf}`);
  assert.ok(scheduleSlipDays(kfsc()) > pfbf, "King Fahad is furthest behind");
  assert.equal(scheduleSlipDays(null), null);
});

test("portfolio rows, risk order and headline figures", () => {
  loadSampleAssessments();
  const checks = { ...localSeed().checks, "king-fahad-sports-city": kfsc() };
  const p = portfolio(getAssessments(), checks, null, 2026);
  assert.equal(p.rows.length, 15);
  const ranks = { bad: 0, warn: 1, good: 2, mute: 3 };
  for (let i = 1; i < p.rows.length; i++) assert.ok(ranks[p.rows[i - 1].risk] <= ranks[p.rows[i].risk]);
  const kf = p.rows.find((r) => r.id === "king-fahad-sports-city");
  assert.equal(kf.risk, "bad");
  assert.equal(kf.issues.claims, 1);
  assert.match(kf.schedule.label, /^\+\d+ days$/);
  assert.equal(p.rows.find((r) => r.id === "neom").schedule.label, "No plan on file");
  assert.equal(p.kpis.atRisk.total, 15);
  assert.equal(
    p.kpis.issues.total,
    p.rows.reduce((t, r) => t + r.issues.total, 0),
  );
  assert.equal(p.kpis.milestones.horizon, 2028);
  assert.equal(
    p.cities.reduce((t, c) => t + c.count, 0),
    15,
  );
});

test("the register programme: reviewed stadiums have a readiness figure, the rest do not", () => {
  const p = portfolio(getAssessments(), {}, null, 2026);
  assert.equal(p.kpis.compliance.reviewed, true);
  assert.ok(p.rows.some((r) => r.readiness !== null));
  for (const r of p.rows) if (r.readiness !== null) assert.ok(r.readiness >= 0 && r.readiness <= 1, r.id);
});
