import { beforeEach, test } from "vitest";
import assert from "node:assert/strict";
import readings from "../../data/progress/offline-readings.json" with { type: "json" };
import { REPORT_KINDS, buildReport, cellText } from "@/lib/domain/report.mjs";
import { getAssessments, loadSampleAssessments, resetAssessments } from "@/lib/store/assessments";
import { localCheck, localClear, localFile, localSeed, localState, localUpload } from "@/lib/store/intakeLocal";

let data;
beforeEach(() => {
  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  resetAssessments();
  localClear();
  loadSampleAssessments();
  localSeed();
  for (const f of readings.files.filter((x) => x.folder === "to-upload")) {
    const row = localUpload({ name: f.name, size: f.size });
    localFile(row.document_id, row);
  }
  localCheck("king-fahad-sports-city");
  const state = localState();
  data = { records: getAssessments(), checks: state.checks, documents: state.documents, sample: true, date: "2026-11-25" };
});

const SCOPES = {
  programme: {},
  city: { cityId: "riyadh" },
  stadium: { stadiumId: "king-fahad-sports-city" },
  area: { area: "Lighting" },
  contractor: {},
  executive: {},
};

test("every report kind builds a complete model", () => {
  for (const kind of Object.keys(REPORT_KINDS)) {
    const r = buildReport(kind, SCOPES[kind], data);
    assert.ok(r, kind);
    assert.ok(r.title && r.subtitle && r.filename.startsWith("venue-compliance-hub_"), kind);
    assert.equal(r.sections[0].type, "kpis", kind);
    assert.ok(r.sections.some((s) => s.type === "table" && s.rows.length), kind);
    for (const s of r.sections.filter((x) => x.type === "table"))
      for (const row of s.rows) for (const col of s.columns) assert.notEqual(cellText(row[col.key]), "undefined", `${kind} ${col.key}`);
    assert.ok(r.about.some((a) => a.includes("sample data")), kind);
  }
});

test("programme report counts agree with its stadium table", () => {
  const r = buildReport("programme", {}, data);
  const stadiums = r.sections.find((s) => s.title === "Stadiums");
  assert.equal(stadiums.rows.length, 15);
  const nonCompliant = stadiums.rows.reduce((t, row) => t + Number(cellText(row.nonCompliant)), 0);
  assert.equal(String(nonCompliant), cellText(r.sections[0].items[2].value));
  assert.ok(r.sections.some((s) => s.title === "Progress claims"));
});

test("scoped reports: city, area, stadium, contractor", () => {
  assert.equal(buildReport("city", { cityId: "riyadh" }, data).sections.find((s) => s.title === "Stadiums").rows.length, 8);
  const area = buildReport("area", { area: "Lighting" }, data);
  assert.ok(area.sections.find((s) => s.title === "Findings").rows.every((row) => row.area === "Lighting"));
  const kf = buildReport("stadium", { stadiumId: "king-fahad-sports-city" }, data);
  assert.match(kf.sections[1].text, /reported 70% progress/);
  const contractor = buildReport("contractor", {}, data);
  assert.equal(contractor.sections[0].items[0].value, "3 of 15");
  assert.equal(buildReport("city", { cityId: "nowhere" }, data), null);
});
