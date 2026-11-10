// Impact of a requirement change on existing assessments, and the records
// the change produces. Pure: the store applies the result.
//
// For each stadium the requirement applies to, the latest value on record
// (submitted evidence, else the declared value) is re-checked against the new
// criterion:
//   reopened  compliant, but the value no longer passes → back to review
//   carried   compliant and still passes → stays compliant on the new version
//   rechecked evidence awaiting review → stays in the queue, with the new check
//   still-non-compliant  non-compliant before → stays non-compliant
//   declared  only a declared value → re-checked, still only declared
//   unassessed nothing on record → to be assessed against the new version
import { assessmentKey, evaluate, stadiumApplicability } from "@/lib/domain/assessment.mjs";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";
import { currentRequirement, nextVersion } from "@/lib/domain/requirementVersions.mjs";

export const OUTCOME_LABEL = {
  reopened: "Reopened for review",
  carried: "Still compliant",
  rechecked: "Re-checked in review",
  "still-non-compliant": "Still non-compliant",
  declared: "Declared value re-checked",
  unassessed: "Not assessed yet",
};

function latestValue(record) {
  const ev = record?.evidence?.at(-1);
  if (ev && ev.value !== "" && ev.value != null) return ev.value;
  if (record?.declared) return record.declared.value;
  return null;
}

function outcomeOf(record, newCheck) {
  if (!record || record.status === "unassessed") return "unassessed";
  if (record.status === "compliant") return newCheck === "pass" ? "carried" : "reopened";
  if (record.status === "evidence-submitted") return "rechecked";
  if (record.status === "non-compliant") return "still-non-compliant";
  return "declared";
}

/** What a change scenario would do to the current records. */
export function changeImpact(scenario, records) {
  const before = currentRequirement(scenario.requirementId);
  const after = nextVersion(scenario);
  const cities = Object.fromEntries(FACILITY_REGISTER.hostCities.map((c) => [c.id, c]));
  const rows = [];
  for (const stadium of FACILITY_REGISTER.stadiums) {
    if (stadiumApplicability(stadium, before).value === "not-applicable") continue;
    const key = assessmentKey(stadium.id, before);
    const record = records[key] || null;
    const value = latestValue(record);
    const oldCheck = value == null ? null : evaluate(before.criterion, value);
    const newCheck = value == null ? null : evaluate(after.criterion, value);
    rows.push({
      stadium,
      city: cities[stadium.cityId],
      key,
      newKey: assessmentKey(stadium.id, after),
      record,
      value,
      oldCheck,
      newCheck,
      outcome: outcomeOf(record, newCheck),
      // A value that passed before and fails now, whatever its status.
      flipped: oldCheck === "pass" && newCheck === "fail",
    });
  }
  const counts = Object.fromEntries(Object.keys(OUTCOME_LABEL).map((o) => [o, 0]));
  for (const r of rows) counts[r.outcome]++;
  counts.flipped = rows.filter((r) => r.flipped).length;
  counts.stadiums = rows.length;
  const byCity = FACILITY_REGISTER.hostCities.map((city) => {
    const mine = rows.filter((r) => r.city.id === city.id);
    return {
      cityId: city.id,
      stadiums: mine.length,
      reopened: mine.filter((r) => r.outcome === "reopened").length,
      flipped: mine.filter((r) => r.flipped).length,
    };
  });
  return { scenario, before, after, rows, counts, byCity };
}

/**
 * Records for the new version, keyed by their new keys. Old records stay as
 * they are (the previous version's history).
 */
export function changedRecords(impact, on) {
  const out = {};
  const { scenario, after } = impact;
  const note = `Re-checked against version ${after.version} (${scenario.id})`;
  for (const r of impact.rows) {
    if (!r.record) continue;
    const rec = r.record;
    const evidence = rec.evidence?.length
      ? [...rec.evidence, { ...rec.evidence.at(-1), check: r.newCheck ?? "needs-review", note, on }]
      : rec.evidence || [];
    const next = {
      ...rec,
      requirementVersion: after.version,
      evidence,
      declared: rec.declared ? { ...rec.declared, check: evaluate(after.criterion, rec.declared.value) } : rec.declared,
      history: [...(rec.history || []), { on, action: `${note}: ${OUTCOME_LABEL[r.outcome].toLowerCase()}` }],
    };
    if (r.outcome === "reopened") {
      next.status = "evidence-submitted";
      next.review = null;
      next.reopenedBy = scenario.id;
    }
    out[r.newKey] = next;
  }
  return out;
}

const OUTCOME_TONE = {
  reopened: "bad",
  rechecked: "warn",
  carried: "good",
  "still-non-compliant": "mute",
  declared: "mute",
  unassessed: "mute",
};

/** Tone for a stadium under a change: a flipped check in review is a warning. */
export function outcomeTone(row) {
  if (row.outcome === "rechecked") return row.flipped ? "warn" : "mute";
  if (row.outcome === "declared") return row.newCheck === "fail" ? "warn" : "mute";
  return OUTCOME_TONE[row.outcome];
}

/**
 * The assurance map (from assuranceMap) seen through a change's impact.
 * Counts respect the map's filters: only stadiums due by its year, and none
 * when a requirement area other than the changed one is selected.
 */
export function withImpact(map, impact, pillar = null) {
  const inArea = !pillar || pillar === impact.before.category;
  const rowOf = Object.fromEntries(impact.rows.map((r) => [r.stadium.id, r]));
  const sum = { stadiums: 0, reopened: 0, flipped: 0, compliant: 0, inScope: 0 };
  const cities = map.cities.map((city) => {
    const t = { stadiums: 0, reopened: 0, flipped: 0, carried: 0 };
    const stadiums = city.stadiums.map((s) => {
      const row = inArea ? rowOf[s.id] : null;
      if (!row) return { ...s, impact: null, tone: "mute" };
      if (s.due) {
        t.stadiums++;
        if (row.outcome === "reopened") t.reopened++;
        if (row.flipped && row.outcome !== "reopened") t.flipped++;
        if (row.outcome === "carried") t.carried++;
      }
      return { ...s, impact: row, tone: s.due ? outcomeTone(row) : "mute" };
    });
    const a = city.assurance;
    const assuredAfter = a.inScope ? (a.compliant - t.reopened) / a.inScope : 0;
    for (const k of ["stadiums", "reopened", "flipped"]) sum[k] += t[k];
    sum.compliant += a.compliant;
    sum.inScope += a.inScope;
    // Green only when compliant evidence survives the change; nothing on record stays grey.
    const tone = t.reopened ? "bad" : t.flipped ? "warn" : t.carried ? "good" : "mute";
    return { ...city, stadiums, tone, impact: { ...t, assuredBefore: a.assured, assuredAfter } };
  });
  const programme = {
    ...sum,
    assuredBefore: map.programme.assured,
    assuredAfter: sum.inScope ? (sum.compliant - sum.reopened) / sum.inScope : 0,
  };
  return { ...map, cities, impact: { ...impact, inArea, programme } };
}
