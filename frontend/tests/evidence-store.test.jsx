import { beforeEach, test } from "vitest";
import assert from "node:assert/strict";
import expected from "../../data/progress/expected.json" with { type: "json" };
import readings from "../../data/progress/offline-readings.json" with { type: "json" };
import { plannedFraction } from "@/lib/domain/progressCheck.mjs";
import {
  localCheck,
  localClear,
  localDecide,
  localFile,
  localSeed,
  localState,
  localFileAndSync,
  localIngest,
  localUpload,
} from "@/lib/store/intakeLocal";
import { getAssessments } from "@/lib/store/assessments";

const sample = (name) => readings.files.find((f) => f.name === name);
const asFile = (f) => ({ name: f.name, size: f.size });
const fileAsProposed = (row) =>
  localFile(row.document_id, {
    kind: row.kind,
    stadium_id: row.stadium_id,
    element: row.element,
    as_of: row.as_of,
    revision: row.revision,
  });
const kfsc = () => readings.files.filter((f) => f.folder === "to-upload");

beforeEach(() => localClear());

test("planned progress builds up evenly", () => {
  assert.equal(plannedFraction("2026-11-01", "2026-11-30", "2026-10-31"), 0);
  assert.equal(plannedFraction("2026-11-01", "2026-11-30", "2026-11-15"), 0.5);
  assert.equal(plannedFraction("2026-11-01", "2026-11-30", "2026-11-30"), 1);
});

test("seed matches the backend's expected results", () => {
  const state = localSeed();
  assert.equal(state.documents.length, 9);
  for (const id of ["aramco", "prince-faisal-bin-fahad"]) {
    const check = state.checks[id];
    assert.equal(check.recalculated, expected.stadiums[id].overall_actual, id);
    assert.equal(check.planned, expected.stadiums[id].overall_planned, id);
    assert.ok(!check.stale);
  }
  assert.equal(state.checks.aramco.status, "supported");
  assert.equal(state.checks["prince-faisal-bin-fahad"].status, "behind-plan");
});

test("King Fahad: overstated, revised plan supersedes, decision recorded", () => {
  for (const f of kfsc()) fileAsProposed(localUpload(asFile(f)));
  let check = localCheck("king-fahad-sports-city");
  assert.equal(check.status, "overstated");
  assert.equal(check.recalculated, expected.stadiums["king-fahad-sports-city"].overall_actual);
  assert.deepEqual(
    check.packages.map((p) => p.element),
    ["pitch-turf", "floodlighting", "seating-stands", "broadcast-media"],
  );

  fileAsProposed(localUpload(asFile(sample(expected.revised.file))));
  const state = localState();
  assert.ok(state.checks["king-fahad-sports-city"].stale);
  assert.equal(state.documents.find((d) => d.name.endsWith("floodlighting-plan-rev-C.pdf")).superseded, 1);
  check = localCheck("king-fahad-sports-city");
  assert.equal(check.packages.find((p) => p.element === "floodlighting").actual, expected.revised.actual);
  assert.equal(localDecide("king-fahad-sports-city", "accepted", "").decision, "accepted");
});

test("a missing plan is reported and only sample files are accepted", () => {
  for (const f of kfsc().filter((x) => !x.name.includes("broadcast"))) fileAsProposed(localUpload(asFile(f)));
  const check = localCheck("king-fahad-sports-city");
  assert.equal(check.packages.find((p) => p.element === "broadcast-media").status, "evidence-missing");
  assert.throws(() => localUpload({ name: "Digital & Technology BL.pdf", size: 10 }), /could not be read/); // not a sample
  assert.throws(() => localCheck("aramco"), /No progress report is filed/);
});

test("any other document goes through the evidence agent and is recorded only when confirmed", async () => {
  const text = "Aramco Stadium\nMixed zone drawing, revision B\nMixed zone area: 180 m2";
  const file = new File([text], "aramco-mixed-zone.txt", { type: "text/plain" });
  const doc = await localIngest(file, {});
  assert.equal(doc.status, "proposed");
  assert.equal(doc.kind, "evidence");
  assert.equal(doc.stadium_id, "aramco");
  assert.ok(doc.analysis.steps.length > 0);
  const before = JSON.stringify(getAssessments());
  assert.equal(JSON.stringify(getAssessments()), before); // nothing recorded yet
  localFileAndSync(doc.document_id, {
    kind: "evidence",
    stadium_id: "aramco",
    as_of: doc.as_of,
    revision: doc.revision,
  });
  const filed = localState().documents.find((d) => d.document_id === doc.document_id);
  assert.equal(filed.status, "filed");
  for (const id of filed.registered || []) {
    const key = Object.keys(getAssessments()).find((k) => k.startsWith(`aramco::${id}@`));
    assert.equal(getAssessments()[key].status, "evidence-submitted", id);
  }
});
