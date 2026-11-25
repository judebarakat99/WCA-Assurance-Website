import { beforeEach, test } from "vitest";
import assert from "node:assert/strict";
import { assessDocument, readDocument } from "@/lib/domain/evidenceReader.mjs";
import { seedAssessments } from "@/lib/domain/assessment.mjs";
import { localClear, localUpload } from "@/lib/store/intakeLocal";

beforeEach(() => {
  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  localClear();
});

test("a sample drawing is read: stadium, type, revision and stated values", () => {
  const row = localUpload({ name: "ksis-media-areas-drawing-rev-B.pdf", size: 0 });
  assert.equal(row.kind, "evidence");
  assert.equal(row.evidenceType, "Drawing");
  assert.equal(row.stadium_id, "king-salman-international");
  assert.equal(row.revision, "B");
  assert.equal(row.as_of, "2026-11-18");
  assert.deepEqual(
    row.reading.matches.map((m) => [m.requirementId, m.value]),
    [["STA-0040", 180], ["STA-0042", 230], ["STA-0066", 6]],
  );
  const result = assessDocument(row, seedAssessments());
  assert.equal(result.blocker, null);
  assert.deepEqual(result.failing.map((m) => m.requirementId), ["STA-0040"]); // 180 m² against ≥ 200 m²
  assert.equal(result.alerts[0].owner, "Media and broadcast lead");
  assert.equal(result.steps.length, 8);
  assert.ok(result.effects.some((e) => e.includes("STA-0040")));
});

test("capacity evidence is checked against the stadium's own threshold", () => {
  const row = localUpload({ name: "kfsc-seating-certificate.pdf", size: 0 });
  const result = assessDocument(row, seedAssessments());
  const cap = result.matches.find((m) => m.requirementId === "STA-0004");
  assert.equal(cap.value, 58400);
  assert.equal(cap.check, "fail"); // semi-final venue: 60,000
  assert.equal(result.matches.find((m) => m.requirementId === "STA-0007").check, "pass"); // 0.8 within 0.5–1 %
});

test("text files are read by requirement title as well as ID", () => {
  const reading = readDocument({
    name: "aramco-media-note.txt",
    text: "Aramco Stadium\nDocument type: Calculation\nMixed zone measured at 260 m²\nPress conference room 190 m²",
  });
  assert.equal(reading.stadium_id, "aramco");
  assert.deepEqual(reading.matches.map((m) => [m.requirementId, m.value]), [["STA-0040", 260], ["STA-0042", 190]]);
});

test("an unreadable file is identified from its name, and needs a type", () => {
  const row = localUpload({ name: "Digital & Technology BL.pdf", size: 1 });
  const result = assessDocument(row, seedAssessments());
  assert.equal(result.steps[0].ok, false);
  assert.match(result.steps[0].detail, /identified from the file name only/);
  assert.equal(result.blocker.button, "Choose a type");
  assert.match(result.blocker.text, /not recorded anywhere/);
});
