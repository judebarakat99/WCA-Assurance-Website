import { beforeEach, test } from "vitest";
import assert from "node:assert/strict";
import { reviewQueue } from "@/lib/domain/reviewQueue.mjs";
import { loadReportData } from "@/lib/reports/data.js";
import { renderReport } from "@/lib/reports/export.js";
import { SCOPES, buildReport, isComplete, targetsFor } from "@/lib/reports/model.mjs";
import { getAssessments, resetAssessments } from "@/lib/store/assessments";

beforeEach(() => {
  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  resetAssessments();
});

const configFor = (scope, data) => ({ scope, target: targetsFor(scope, data)[0]?.id || null, narrow: null });

test("every report kind builds from the shared data, with a title and content", () => {
  const data = loadReportData({ now: new Date("2026-11-26T00:00:00Z") });
  assert.equal(data.stadiums.length, 15);
  for (const s of SCOPES) {
    const config = configFor(s.id, data);
    assert.ok(isComplete(config), s.id);
    const report = buildReport(config, data);
    assert.ok(report.title, s.id);
    assert.ok(report.filenameBase, s.id);
  }
});

test("the programme report counts the same items as the review queue", () => {
  const data = loadReportData({ now: new Date("2026-11-26T00:00:00Z") });
  const rows = data.stadiums.flatMap((s) => s.rows);
  const awaiting = rows.filter((r) => r.statusKey === "evidence-submitted").length;
  const queued = reviewQueue(getAssessments()).filter((i) => i.record.status === "evidence-submitted").length;
  assert.equal(awaiting, queued);
});

test("a stadium report renders to Word and Excel", async () => {
  const data = loadReportData({ now: new Date("2026-11-26T00:00:00Z") });
  const report = buildReport(configFor("stadium", data), data);
  for (const format of ["docx", "xlsx"]) {
    const bytes = await renderReport(report, format);
    assert.ok(bytes.byteLength > 1000 || bytes.size > 1000, format);
  }
});
