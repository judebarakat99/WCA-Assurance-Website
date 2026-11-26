import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import FifaLibrary from "@/components/organisms/FifaLibrary";
import { capacityRequirement } from "@/lib/domain/facilities.mjs";
import { FIFA_CATALOGUE, criterionLabel, fifaRequirementRecords } from "@/lib/domain/fifa-catalogue.mjs";
import { parseCsv } from "@/lib/register/csv.mjs";
import { requirementsCsv } from "@/lib/register/records.mjs";

const byId = () => Object.fromEntries(fifaRequirementRecords().map((r) => [r.id, r]));
const chapterCounts = () =>
  FIFA_CATALOGUE.families
    .map((f) => fifaRequirementRecords().filter((r) => r.familyId === f.id).length)
    .filter(Boolean);

test("the register reconciles: 181 checks in 11 chapters, 123 for stadiums", () => {
  const records = fifaRequirementRecords();
  assert.equal(records.length, 181);
  assert.equal(new Set(records.map((r) => r.id)).size, 181);
  assert.deepEqual(chapterCounts(), [13, 16, 12, 23, 34, 15, 8, 20, 9, 8, 23]);
  const sites = {};
  for (const r of records) sites[r.assetType] = (sites[r.assetType] || 0) + 1;
  assert.deepEqual(sites, { Stadium: 123, "Training site": 38, "Fan festival": 14, IBC: 6 });
  for (const r of records) {
    assert.ok(
      FIFA_CATALOGUE.families.some((f) => f.id === r.familyId),
      r.id,
    );
    assert.ok(["applicable", "provisional"].includes(r.applicability), r.id);
    assert.ok(r.sectionId.startsWith(`${Number(r.familyId)}.`), r.id);
    assert.ok(criterionLabel(r.criterion), r.id);
  }
});

test("book criteria keep their thresholds; working targets keep their wording", () => {
  const r = byId();
  assert.equal(criterionLabel(r["STA-0034"].criterion), "≥ 80 m²");
  assert.equal(criterionLabel(r["STA-0068"].criterion), "≥ 4,000 m²");
  assert.equal(criterionLabel(r["STA-0015"].criterion), "≤ 250 seats per point of sale");
  assert.equal(criterionLabel(r["STA-0007"].criterion), "0.5–1 % of seats");
  assert.equal(r["STA-0053"].applicability, "provisional");
  assert.match(criterionLabel(r["STA-0053"].criterion), /1 per 250 spectators/);
});

test("capacity resolves to the stadium's highest match", () => {
  assert.equal(capacityRequirement({ highestMatch: "opening-final" }).criterion.value, 80000);
  assert.equal(capacityRequirement({ highestMatch: "semi-final" }).criterion.value, 60000);
  assert.equal(capacityRequirement({ highestMatch: "round-of-16" }).criterion.value, 40000);
  assert.equal(capacityRequirement({ highestMatch: "round-of-16" }).id, "STA-0004");
});

test("the Requirements page lists every chapter and check, collapsible, with the CSV download", () => {
  const html = renderToStaticMarkup(<FifaLibrary />);
  for (const f of FIFA_CATALOGUE.families.filter((x) => fifaRequirementRecords().some((r) => r.familyId === x.id)))
    assert.ok(html.includes(f.name), f.name);
  for (const r of fifaRequirementRecords()) assert.ok(html.includes(r.id), r.id);
  assert.ok(html.includes("181 checks in 11 chapters"));
  assert.ok(html.includes("Expand all") && html.includes("Collapse all"));
  assert.ok(html.includes("Download requirements (CSV)"));
});

test("the requirements CSV has one row per check, in the register's order", () => {
  const rows = parseCsv(requirementsCsv());
  assert.equal(rows.length, 181);
  const cap = rows.find((r) => r.id === "STA-0034");
  assert.equal(cap.criterion, ">= 80 m²");
  assert.equal(cap.status, "Book");
  assert.equal(cap.applies_to, "Stadium");
});
