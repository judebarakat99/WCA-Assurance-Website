import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import FifaLibrary from "@/components/organisms/FifaLibrary";
import { CHAPTERS, FIFA_CATALOGUE, criterionLabel, fifaRequirementRecords, resolveForStadium } from "@/lib/domain/fifa-catalogue.mjs";

const byId = () => Object.fromEntries(fifaRequirementRecords().map((r) => [r.id, r]));

test("the register reconciles: 181 checks in 11 chapters, 123 for stadiums", () => {
  const records = fifaRequirementRecords();
  assert.equal(records.length, 181);
  assert.equal(new Set(records.map((r) => r.id)).size, 181);
  assert.equal(CHAPTERS.length, 11);
  assert.deepEqual(
    CHAPTERS.map((c) => c.checks),
    [13, 16, 12, 23, 34, 15, 8, 20, 9, 8, 23],
  );
  const sites = {};
  for (const r of records) sites[r.assetType] = (sites[r.assetType] || 0) + 1;
  assert.deepEqual(sites, { Stadium: 123, "Training site": 38, "Fan festival": 14, IBC: 6 });
  for (const r of records) {
    assert.ok(r.chapterInfo, r.id);
    assert.ok(["WT", "Book"].includes(r.status), r.id);
    assert.ok(r.section.startsWith(`${Number(r.chapter)}.`), r.id);
    assert.ok(criterionLabel(r.criterion), r.id);
  }
});

test("book criteria keep their thresholds; working targets keep their wording", () => {
  const r = byId();
  assert.equal(criterionLabel(r["STA-0034"].criterion), "≥ 80 m²");
  assert.equal(criterionLabel(r["STA-0068"].criterion), "≥ 4,000 m²");
  assert.equal(criterionLabel(r["STA-0015"].criterion), "≤ 250 seats per point of sale");
  assert.equal(criterionLabel(r["STA-0007"].criterion), "0.5–1 % of seats");
  assert.equal(criterionLabel(r["STA-0004"].criterion), "≥ 40,000 / 60,000 / 80,000 seats by match category");
  assert.equal(r["STA-0053"].status, "WT");
  assert.match(criterionLabel(r["STA-0053"].criterion), /1 per 250 spectators/);
  assert.equal(r["FAN-UNREADABLE"].partial, true); // obscured in the source; no ID invented
});

test("capacity resolves to the stadium's highest match", () => {
  const cap = byId()["STA-0004"];
  assert.equal(resolveForStadium(cap, { highestMatch: "opening-final" }).criterion.value, 80000);
  assert.equal(resolveForStadium(cap, { highestMatch: "semi-final" }).criterion.value, 60000);
  assert.equal(resolveForStadium(cap, { highestMatch: "round-of-16" }).criterion.value, 40000);
  assert.equal(resolveForStadium(cap, { highestMatch: "round-of-16" }).criterion.tiers, undefined);
});

test("the Requirements page lists every chapter and check, with provenance", () => {
  const html = renderToStaticMarkup(<FifaLibrary />);
  for (const c of CHAPTERS) assert.ok(html.includes(c.name), c.name);
  for (const r of FIFA_CATALOGUE.requirements.filter((x) => x.id !== "FAN-UNREADABLE")) assert.ok(html.includes(r.id), r.id);
  assert.ok(html.includes("not an independently verified statement"));
  assert.ok(html.includes("181 checks in 11 chapters"));
});
