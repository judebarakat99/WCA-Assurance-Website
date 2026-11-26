import { test } from "vitest";
import assert from "node:assert/strict";
import { assuranceMap, assuranceTone, stadiumAssurance } from "@/lib/domain/cityAssurance.mjs";
import { seedAssessments } from "@/lib/domain/assessment.mjs";
import { sampleAssessments } from "@/lib/domain/sampleAssessments.mjs";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";
import { complianceRows } from "@/lib/register/data.mjs";
import regions from "../../data/geo/sa-regions.geo.json" with { type: "json" };

test("the register rolls up by city: every stadium in scope, and the counts add up", () => {
  const map = assuranceMap(seedAssessments());
  assert.equal(map.cities.length, 5);
  assert.ok(map.cities.every((c) => c.coordinates.length === 2));
  const total = map.cities.reduce((a, c) => a + c.assurance.inScope, 0);
  assert.equal(total, map.programme.inScope);
  const notApplicable = complianceRows().filter((r) => r.status === "Not applicable").length;
  assert.equal(map.programme.inScope, 15 * 123 - notApplicable);
  assert.ok(map.programme.compliant > 0 && map.programme["non-compliant"] > 0);
});

test("pillar filter narrows the scope to one chapter", () => {
  const records = seedAssessments();
  const all = assuranceMap(records).programme.inScope;
  const pre = assuranceMap(records, "Pre-construction decisions").programme.inScope;
  const lighting = assuranceMap(records, "Lighting and power supply").programme.inScope;
  assert.ok(pre > 0 && lighting > 0 && pre + lighting < all);
  assert.ok(pre <= 15 * 11 && lighting <= 15 * 7); // 11 and 7 stadium checks in those chapters
});

test("the demo data is the register, deterministic, and further along for stadiums due earlier", () => {
  const a = sampleAssessments();
  assert.deepEqual(a, sampleAssessments());
  assert.deepEqual(a, seedAssessments());
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
  assert.equal(
    y2026.cities.reduce((n, c) => n + c.stadiums.length, 0),
    15,
  ); // all still listed
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
