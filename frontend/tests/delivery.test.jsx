import { beforeEach, test } from "vitest";
import assert from "node:assert/strict";
import readings from "../../data/progress/offline-readings.json" with { type: "json" };
import { costTone, delivery, sCurve } from "@/lib/domain/delivery.mjs";
import { localCheck, localClear, localFile, localSeed, localUpload } from "@/lib/store/intakeLocal";

const fileAsProposed = (row) =>
  localFile(row.document_id, {
    kind: row.kind,
    stadium_id: row.stadium_id,
    element: row.element,
    as_of: row.as_of,
    revision: row.revision,
  });

beforeEach(() => {
  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  localClear();
});

const row = (d, id) => d.rows.find((r) => r.id === id);

test("the planned S-curve runs from 0 to 100", () => {
  assert.equal(sCurve(0), 0);
  assert.equal(sCurve(0.5), 50);
  assert.equal(sCurve(1), 100);
  assert.ok(sCurve(0.25) < 25 && sCurve(0.75) > 75);
});

test("without checks every stadium uses its reported progress", () => {
  const d = delivery({});
  assert.equal(d.rows.length, 15);
  assert.equal(d.totals.verified, 0);
  const kfsc = row(d, "king-fahad-sports-city");
  assert.equal(kfsc.actual, 70);
  assert.equal(kfsc.status, "on-track");
  assert.equal(row(d, "new-murabba").status, "not-started");
  assert.equal(row(d, "neom").status, "early");
  // Cost: value of work done over spend; forecast = budget / CPI.
  assert.equal(kfsc.earnedValue, 1295);
  assert.equal(kfsc.cpi, 1.13);
  assert.equal(kfsc.eac, Math.round(1850 / 1.13));
  assert.equal(costTone(0.85), "bad");
});

test("a checked progress report replaces the reported figure and moves the forecast", () => {
  for (const f of readings.files.filter((x) => x.folder === "to-upload"))
    fileAsProposed(localUpload({ name: f.name, size: f.size }));
  const check = localCheck("king-fahad-sports-city");
  const kfsc = row(delivery({ "king-fahad-sports-city": check }), "king-fahad-sports-city");
  assert.ok(kfsc.verified);
  assert.equal(kfsc.reported, 70);
  assert.equal(kfsc.actual, check.recalculated);
  assert.ok(kfsc.slip > 60, `slip ${kfsc.slip}`);
  assert.equal(kfsc.status, "late");
  assert.ok(kfsc.forecast > kfsc.finish);
  assert.ok(kfsc.cpi < 0.9);
  assert.equal(kfsc.packages.length, 4);
});

test("seeded checks: Aramco on track, Prince Faisal at risk", () => {
  const { checks } = localSeed();
  const d = delivery(checks);
  assert.equal(d.totals.verified, 2);
  assert.equal(row(d, "aramco").status, "on-track");
  assert.equal(row(d, "prince-faisal-bin-fahad").status, "at-risk");
});
