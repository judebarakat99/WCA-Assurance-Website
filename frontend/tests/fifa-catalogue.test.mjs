import test from "node:test";
import assert from "node:assert/strict";
import { FIFA_CATALOGUE, fifaRequirementRecords, criterionLabel } from "../src/lib/domain/fifa-catalogue.mjs";
import { fifaLibrary } from "../src/legacy/views/fifaLibrary.js";

test("catalogue references resolve to official sources and explicit applicability", () => {
  const records = fifaRequirementRecords();
  assert.equal(new Set(records.map((r) => r.id)).size, records.length);
  for (const record of records) {
    assert.ok(record.source);
    assert.equal(new URL(record.source.url).hostname, "digitalhub.fifa.com");
    assert.equal(record.pdfPage, record.printedPage + 1);
    assert.ok(record.condition);
    assert.equal(record.applicabilityReview, "pending");
    assert.equal(record.status, undefined);
  }
});

test("lighting separates horizontal, vertical and training thresholds", () => {
  const byId = Object.fromEntries(fifaRequirementRecords().map((r) => [r.id, r]));
  assert.equal(byId["FL-A-EH-AVG"].criterion.value, 2500);
  assert.deepEqual(byId["FL-A-EH-AVG"].planes, ["Eh"]);
  assert.equal(byId["FL-A-EV-AVG"].criterion.value, 1500);
  assert.deepEqual(byId["FL-A-EV-AVG"].planes, ["Ev0", "Ev90", "Ev180", "Ev270"]);
  assert.equal(byId["FL-T1-EH-AVG"].criterion.value, 750);
  assert.equal(byId["FL-A-EV-U2"].criterion.value, 0.6);
  assert.equal(criterionLabel(byId["FL-A-EH-AVG"].criterion), "> 2500 lux");
  assert.equal(criterionLabel(byId["FL-A-FF-MAX"].criterion), "< 1 percent");
  assert.ok(byId["FL-A-CRI"].reviewIssues.some((issue) => issue.id === "cri-boundary"));
  assert.ok(byId["FL-T1-EV-U2"].reviewIssues.some((issue) => issue.id === "training-u2-label"));
  assert.equal(byId["FL-A-LED"].authority, "recommendation");
});

test("lighting references remain connected and pending facility assessment", () => {
  const records = fifaRequirementRecords();
  const ids = new Set(records.map((r) => r.id));
  for (const record of records.filter((r) => r.profileId)) {
    assert.ok(FIFA_CATALOGUE.lightingProfiles.some((p) => p.id === record.profileId));
    assert.ok(record.evidence.length);
    assert.ok(record.evidence.every(Boolean));
    assert.ok(record.reviewIssues.every(Boolean));
    assert.ok(criterionLabel(record.criterion));
    if (record.basisRequirementId) assert.ok(ids.has(record.basisRequirementId));
  }
  const missing = FIFA_CATALOGUE.sources.find((s) => s.id === "fifa-wc2034-full-hosting-package");
  assert.equal(missing.url, null);
  assert.equal(missing.reviewStatus, "awaiting-partner-source");
  const html = fifaLibrary();
  assert.ok(html.includes("Source inventory"));
  assert.ok(html.includes("Evidence and interpretation review"));
  assert.ok(html.includes("&gt; 2500 lux"));
  assert.ok(!html.includes('href="null'));
  assert.ok(!html.includes("undefined"));
});

test("match allocation and training-site type retain distinct criteria", () => {
  const byId = Object.fromEntries(FIFA_CATALOGUE.requirements.map((r) => [r.id, r]));
  assert.equal(byId["F34-ST-CAP-01"].criterion.value, 40000);
  assert.match(byId["F34-ST-CAP-01"].condition, /excluding opening/);
  assert.equal(byId["F34-ST-CAP-02"].criterion.value, 60000);
  assert.equal(byId["F34-ST-CAP-03"].criterion.value, 80000);
  assert.equal(byId["F34-TR-PITCH-01"].criterion.value, 1);
  assert.equal(byId["F34-TR-PITCH-02"].criterion.value, 2);
  assert.equal(byId["F34-TR-TRAVEL-01"].criterion.operator, "max");
});

test("library displays the shared catalogue with page citations and review status", () => {
  const html = fifaLibrary();
  for (const record of fifaRequirementRecords()) {
    assert.ok(html.includes(record.id));
    assert.ok(html.includes(record.sourceUrl));
  }
  assert.ok(html.includes(`${FIFA_CATALOGUE.requirements.length} criteria`));
  assert.ok(html.includes("Applicability pending"));
  assert.ok(!html.includes("Verified"));
});
