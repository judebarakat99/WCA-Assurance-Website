import { test } from "vitest";
import assert from "node:assert/strict";
import { AREAS, areaExposure, areaView } from "@/lib/domain/stadiumAreas.mjs";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";
import { FIFA_CATALOGUE } from "@/lib/domain/fifa-catalogue.mjs";
import { sampleAssessments } from "@/lib/domain/sampleAssessments.mjs";
import { seedAssessments } from "@/lib/domain/assessment.mjs";

const KS = FACILITY_REGISTER.stadiums.find((s) => s.id === "king-salman-international");

test("every stadium check belongs to exactly one area", () => {
  const stadiumIds = FIFA_CATALOGUE.requirements.filter((r) => r.assetType === "Stadium").map((r) => r.id);
  const placed = AREAS.flatMap((a) => a.ids);
  assert.equal(placed.length, new Set(placed).size, "no check in two areas");
  assert.deepEqual([...placed].sort(), [...stadiumIds].sort());
  for (const a of AREAS) {
    assert.equal(a.pos.length, 3, a.id);
    assert.equal(areaView(a).t.length, 3, a.id);
  }
});

test("an area's exposure is the worst status among its checks", () => {
  const seed = areaExposure(KS, seedAssessments());
  assert.equal(seed.open, 0);
  assert.ok(seed.areas.every((a) => a.exposure === "none")); // only declared capacities: nothing assessed
  const sample = areaExposure(KS, sampleAssessments());
  const total = Object.values(sample.counts).reduce((t, n) => t + n, 0);
  assert.equal(total, AREAS.length);
  for (const a of sample.areas) {
    const has = (k) => a.checks.some((c) => c.exposure === k);
    if (has("critical")) assert.equal(a.exposure, "critical", a.id);
    else if (has("material")) assert.equal(a.exposure, "material", a.id);
    assert.equal(a.open, a.checks.filter((c) => ["critical", "material"].includes(c.exposure)).length);
  }
  const rank = ["critical", "material", "manageable", "controlled", "none"];
  for (let i = 1; i < sample.areas.length; i++)
    assert.ok(rank.indexOf(sample.areas[i - 1].exposure) <= rank.indexOf(sample.areas[i].exposure));
});
