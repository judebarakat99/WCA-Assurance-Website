import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import FacilityRegister from "@/components/organisms/FacilityRegister";
import {
  FACILITY_REGISTER,
  MATCH_LABEL,
  STATUS_LABEL,
  capacityRequirement,
  cityRecords,
  declaredCapacityCheck,
  registerSource,
  registerSummary,
  stadiumRecords,
} from "@/lib/domain/facilities.mjs";
import { VENUES } from "@/lib/domain/data";

test("register matches the bid's headline counts", () => {
  const s = registerSummary();
  assert.equal(s.cities, 5);
  assert.equal(s.stadiums, 15);
  assert.ok(s.seats > 728000, `${s.seats} seats`);
  assert.deepEqual(s.byStatus, { "existing-refurbishment": 4, "under-construction": 3, planned: 8 });
  const perCity = Object.fromEntries(cityRecords().map((c) => [c.id, c.stadiums.length]));
  assert.deepEqual(perCity, { riyadh: 8, jeddah: 4, "al-khobar": 1, abha: 1, neom: 1 });
  assert.equal(s.roomKeys, 232023);
});

test("every record is sourced and uses known categories", () => {
  const ids = new Set();
  for (const st of FACILITY_REGISTER.stadiums) {
    assert.ok(!ids.has(st.id), `duplicate ${st.id}`);
    ids.add(st.id);
    assert.ok(registerSource(st.sourceId), st.id);
    assert.ok(st.page > 0);
    assert.ok(MATCH_LABEL[st.highestMatch], st.highestMatch);
    assert.ok(STATUS_LABEL[st.status], st.status);
    assert.ok(st.completionYear >= 2026 && st.completionYear <= 2034);
    assert.ok(FACILITY_REGISTER.hostCities.some((c) => c.id === st.cityId));
  }
  assert.equal(registerSource("fifa-wc2034-bid-book").url, null);
});

test("match category selects the matching FIFA capacity requirement", () => {
  const byId = Object.fromEntries(FACILITY_REGISTER.stadiums.map((s) => [s.id, s]));
  assert.equal(capacityRequirement(byId["king-salman-international"]).id, "F34-ST-CAP-03");
  assert.equal(capacityRequirement(byId["king-fahad-sports-city"]).id, "F34-ST-CAP-02");
  assert.equal(capacityRequirement(byId["prince-mohammed-bin-salman"]).id, "F34-ST-CAP-01");
  assert.equal(capacityRequirement(byId["aramco"]).id, "F34-ST-CAP-01");
  const ks = declaredCapacityCheck(byId["king-salman-international"]);
  assert.equal(ks.minimum, 80000);
  assert.equal(ks.margin, 12760);
  assert.equal(ks.status, "declared-meets");
  assert.equal(ks.evidence, "pending");
});

test("a declared shortfall is reported as declared-short", () => {
  const short = declaredCapacityCheck({ highestMatch: "semi-final", grossCapacity: 55000 });
  assert.equal(short.status, "declared-short");
  assert.equal(short.margin, -5000);
});

test("simulated venues link to register entries in the same city", () => {
  const linked = FACILITY_REGISTER.stadiums.filter((s) => s.simulationId);
  assert.equal(linked.length, 5);
  for (const s of linked) {
    const v = VENUES.find((x) => x.id === s.simulationId);
    assert.ok(v, s.simulationId);
    assert.equal(v.name, s.name);
  }
  assert.ok(stadiumRecords().every((s) => s.city));
});

test("register view shows every stadium, its requirement and pending evidence", () => {
  const html = renderToStaticMarkup(<FacilityRegister />);
  for (const s of FACILITY_REGISTER.stadiums) assert.ok(html.includes(s.name), s.name);
  assert.ok(html.includes("F34-ST-CAP-03"));
  assert.ok(html.includes("Evidence pending"));
  assert.ok(html.includes("Secondary source"));
  assert.ok(!html.includes("Compliant"));
  assert.ok(!html.includes("undefined"));
});
