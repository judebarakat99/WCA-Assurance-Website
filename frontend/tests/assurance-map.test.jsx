import { test } from "vitest";
import assert from "node:assert/strict";
import { assuranceMap, assuranceTone, stadiumAssurance } from "@/lib/domain/cityAssurance.mjs";
import { seedAssessments } from "@/lib/domain/assessment.mjs";
import { sampleAssessments } from "@/lib/domain/sampleAssessments.mjs";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";
import regions from "../../data/geo/sa-regions.geo.json" with { type: "json" };

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

test("timeline counts only stadiums due complete by the chosen year", () => {
  const records = sampleAssessments();
  const all = assuranceMap(records);
  assert.equal(all.due, 15);
  const y2026 = assuranceMap(records, null, 2026);
  assert.equal(y2026.due, 2); // King Fahad Sports City and Aramco
  assert.equal(y2026.cities.reduce((n, c) => n + c.stadiums.length, 0), 15); // all still listed
  assert.equal(y2026.cities.find((c) => c.id === "neom").dueCount, 0);
  assert.ok(y2026.programme.inScope < all.programme.inScope);
  assert.equal(assuranceMap(records, null, 2029).due, 6);
  assert.deepEqual(assuranceMap(records, null, 2034).programme, all.programme);
});

test("every host city has a region in the map data and every stadium a located point", () => {
  const names = new Set(regions.features.map((f) => f.properties.name));
  for (const city of FACILITY_REGISTER.hostCities) assert.ok(names.has(city.region), city.region);
  for (const s of FACILITY_REGISTER.stadiums) {
    const [lon, lat] = s.location.coordinates;
    assert.ok(lon > 34 && lon < 56 && lat > 16 && lat < 33, s.id);
    assert.ok(["mapped", "approximate"].includes(s.location.accuracy), s.id);
    assert.ok(s.location.source, s.id);
  }
});

test("tone thresholds", () => {
  const base = { inScope: 10, unassessed: 0, assessed: 10, "non-compliant": 0 };
  assert.equal(assuranceTone({ ...base, compliant: 9, assured: 0.9 }), "good");
  assert.equal(assuranceTone({ ...base, compliant: 6, assured: 0.6 }), "warn");
  assert.equal(assuranceTone({ ...base, compliant: 2, assured: 0.2 }), "bad");
  assert.equal(assuranceTone({ ...base, compliant: 0, assured: 0 }), "mute");
});
