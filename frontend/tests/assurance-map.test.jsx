import { test } from "vitest";
import assert from "node:assert/strict";
import { assuranceMap, assuranceTone, stadiumAssurance } from "@/lib/domain/cityAssurance.mjs";
import { seedAssessments } from "@/lib/domain/assessment.mjs";
import { sampleAssessments } from "@/lib/domain/sampleAssessments.mjs";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";

test("declared-only data rolls up with nothing reviewed and a neutral tone", () => {
  const map = assuranceMap(seedAssessments());
  assert.equal(map.cities.length, 5);
  assert.equal(map.programme.compliant, 0);
  assert.equal(map.programme.declared, 15);
  assert.equal(map.tone, "mute");
  assert.ok(map.cities.every((c) => c.tone === "mute" && c.coordinates.length === 2));
  const total = map.cities.reduce((a, c) => a + c.assurance.inScope, 0);
  assert.equal(total, map.programme.inScope);
});

test("pillar filter narrows the scope to one category", () => {
  const records = seedAssessments();
  const all = assuranceMap(records).programme.inScope;
  const capacity = assuranceMap(records, "Capacity").programme;
  assert.equal(capacity.inScope, 15); // one applicable capacity rule per stadium
  assert.equal(capacity.declared, 15);
  assert.ok(assuranceMap(records, "Lighting").programme.inScope < all);
});

test("sample assessments are labelled, deterministic and vary by stadium progress", () => {
  const a = sampleAssessments();
  const b = sampleAssessments();
  assert.deepEqual(a, b);
  const sample = Object.values(a).filter((r) => r.sample);
  assert.ok(sample.length > 100);
  assert.ok(sample.every((r) => r.evidence.at(-1).file.startsWith("sample_")));
  const early = FACILITY_REGISTER.stadiums.find((s) => s.id === "king-fahad-sports-city"); // due 2026
  const late = FACILITY_REGISTER.stadiums.find((s) => s.id === "neom"); // due 2032
  assert.ok(stadiumAssurance(early, a).coverage > stadiumAssurance(late, a).coverage);
});

test("tone thresholds", () => {
  const base = { inScope: 10, unassessed: 0, assessed: 10, "non-compliant": 0 };
  assert.equal(assuranceTone({ ...base, compliant: 9, assured: 0.9 }), "good");
  assert.equal(assuranceTone({ ...base, compliant: 6, assured: 0.6 }), "warn");
  assert.equal(assuranceTone({ ...base, compliant: 2, assured: 0.2 }), "bad");
  assert.equal(assuranceTone({ ...base, compliant: 0, assured: 0 }), "mute");
});
