// The requirement-change agent's assessment. Given a proposed change to one requirement it works out, from the
// register, which stadiums it touches, what happens to each recorded value, how exposure moves, which gates and
// chapters are affected and what each owner has to do. Pure: no storage and no UI.
//
// Everything is derived from the same modules the pages use, so the figures agree with the overview, the stadium
// pages and the review queue, and the "after" numbers are exactly what applying the change would produce.
import { assessmentKey, evaluate, stadiumApplicability } from "@/lib/domain/assessment.mjs";
import { stadiumAssurance } from "@/lib/domain/cityAssurance.mjs";
import { findingExposure, nextGate } from "@/lib/domain/exposure.mjs";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";
import { dueDate, formatDue, ownerFor } from "@/lib/domain/mitigation.mjs";
import { currentRequirement, currentRequirements } from "@/lib/domain/requirementVersions.mjs";
import { familyById } from "@/lib/register/data.mjs";
import { criterionText, num, plural } from "@/lib/reports/text.mjs";

export const OUTCOME = {
  reopened: { label: "Reopens for review", tone: "bad", action: true },
  failsInReview: { label: "Would fail in review", tone: "bad", action: true },
  stillFailing: { label: "Still not met", tone: "warn", action: false },
  carried: { label: "Still compliant", tone: "good", action: false },
  passesInReview: { label: "Still in review", tone: "info", action: false },
  mayClear: { label: "Could now pass", tone: "info", action: false },
  notAssessed: { label: "Not assessed yet", tone: "mute", action: false },
};
export const OUTCOME_ORDER = ["reopened", "failsInReview", "stillFailing", "mayClear", "passesInReview", "carried", "notAssessed"];

const RANK = { controlled: 0, manageable: 1, material: 2, critical: 3 };
/** A requirement that stops being met is at least a medium alert; critical exposure is high. */
export const severityOf = (level) => (level === "critical" ? "high" : "medium");

const UP = ["min", "gte", "gt"];
const DOWN = ["max", "lte", "lt"];

/** "tighter" or "looser" (or "changed"), and by how much, for a change of one criterion. */
export function describeShift(before, after) {
  const b = before.criterion;
  const a = after.criterion;
  if (b.operator === "range" && a.operator === "range") {
    const up = a.minimum > b.minimum;
    const same = a.minimum === b.minimum && a.maximum === b.maximum;
    return { direction: same ? "changed" : up ? "tighter" : "looser", percent: b.minimum ? Math.round((Math.abs(a.minimum - b.minimum) / Math.abs(b.minimum)) * 100) : null };
  }
  if (typeof a.value === "number" && typeof b.value === "number" && b.value !== 0) {
    const percent = Math.round((Math.abs(a.value - b.value) / Math.abs(b.value)) * 100);
    if (a.value === b.value) return { direction: "changed", percent: 0 };
    if (UP.includes(a.operator)) return { direction: a.value > b.value ? "tighter" : "looser", percent };
    if (DOWN.includes(a.operator)) return { direction: a.value < b.value ? "tighter" : "looser", percent };
  }
  return { direction: "changed", percent: null };
}

function latestValue(record) {
  const ev = record?.evidence?.at(-1);
  if (ev && ev.value !== "" && ev.value != null) return { value: ev.value, latest: ev };
  if (record?.declared && record.declared.value != null) return { value: record.declared.value, latest: null };
  return { value: null, latest: ev || null };
}

function outcomeOf(status, newCheck) {
  if (status === "compliant") return newCheck === "fail" ? "reopened" : "carried";
  if (status === "evidence-submitted") return newCheck === "fail" ? "failsInReview" : "passesInReview";
  if (status === "non-compliant") return newCheck === "pass" ? "mayClear" : "stillFailing";
  return "notAssessed";
}

const zero = () => ({ critical: 0, material: 0, manageable: 0, controlled: 0 });

/**
 * Assess one proposed change against the register.
 * scenario: { id, requirementId, title, summary, criterion }. records: the assessment records (getAssessments()).
 */
export function assessChange(scenario, records, now = new Date()) {
  const before = currentRequirement(scenario.requirementId);
  if (!before) return null;
  const after = { ...before, version: before.version + 1, criterion: scenario.criterion };
  const shift = describeShift(before, after);
  const cities = Object.fromEntries(FACILITY_REGISTER.hostCities.map((c) => [c.id, c]));

  const rows = [];
  for (const stadium of FACILITY_REGISTER.stadiums) {
    const applicability = stadiumApplicability(stadium, before);
    if (applicability.value === "not-applicable") continue;
    const row = { requirement: before, key: assessmentKey(stadium.id, before), applicability };
    const record = records[row.key] || null;
    const { value, latest } = latestValue(record);
    const status = record?.status || "unassessed";
    const oldCheck = value == null ? null : evaluate(before.criterion, value);
    const newCheck = value == null ? null : evaluate(after.criterion, value);
    const outcome = outcomeOf(status, newCheck);
    const moves = outcome === "reopened" || outcome === "failsInReview";
    const simulated = moves && latest
      ? { ...record, status: "evidence-submitted", partial: false, reopenedBy: scenario.id, evidence: [...record.evidence.slice(0, -1), { ...latest, check: "fail" }] }
      : record;
    const levelBefore = findingExposure(stadium, row, record).level;
    const levelAfter = findingExposure(stadium, row, simulated).level;
    const unit = before.criterion.unit || "";
    const valueText = value == null ? "" : `${num(Number(value))}${unit ? ` ${unit}` : ""}`;
    const owner = ownerFor(stadium.id, before);
    rows.push({
      stadium,
      city: cities[stadium.cityId]?.name || "",
      status,
      value,
      valueText,
      oldCheck,
      newCheck,
      outcome,
      actionable: OUTCOME[outcome].action,
      levelBefore,
      levelAfter,
      worse: RANK[levelAfter] > RANK[levelBefore],
      gate: nextGate(stadium),
      owner,
      due: OUTCOME[outcome].action ? dueDate(levelAfter, now) : null,
    });
  }
  const skipped = FACILITY_REGISTER.stadiums.length - rows.length;
  const crit = criterionText(after.criterion);
  const oldCrit = criterionText(before.criterion);

  for (const r of rows)
    r.action = !r.actionable
      ? ""
      : r.outcome === "reopened"
        ? `Review the recorded ${r.valueText} against the proposed requirement of ${crit}. Ask the design team for a revised design, or agree a derogation with the reviewer.`
        : `The submitted ${r.valueText} would not meet the proposed requirement of ${crit}. Ask for corrected evidence before the reviewer decides.`;

  const counts = Object.fromEntries(OUTCOME_ORDER.map((k) => [k, 0]));
  for (const r of rows) counts[r.outcome]++;
  const actionable = rows.filter((r) => r.actionable);
  const onRecord = rows.filter((r) => r.value != null);

  const exposure = { before: zero(), after: zero() };
  for (const r of rows) {
    exposure.before[r.levelBefore]++;
    exposure.after[r.levelAfter]++;
  }

  let inScope = 0;
  let compliant = 0;
  for (const s of FACILITY_REGISTER.stadiums) {
    const a = stadiumAssurance(s, records);
    inScope += a.inScope;
    compliant += a.compliant;
  }
  const programme = { inScope, inScopeAfter: inScope, compliantBefore: compliant, compliantAfter: compliant - counts.reopened };

  const group = (keyOf) => {
    const map = new Map();
    for (const r of rows) {
      const k = keyOf(r);
      if (!map.has(k)) map.set(k, { key: k, stadiums: 0, reopened: 0, failsInReview: 0, notAssessed: 0 });
      const g = map.get(k);
      g.stadiums++;
      if (r.outcome === "reopened") g.reopened++;
      if (r.outcome === "failsInReview") g.failsInReview++;
      if (r.outcome === "notAssessed") g.notAssessed++;
    }
    return [...map.values()];
  };
  const byCity = group((r) => r.city).sort((a, b) => b.reopened + b.failsInReview - (a.reopened + a.failsInReview) || a.key.localeCompare(b.key));
  const byStage = group((r) => `Due ${r.stadium.completionYear}`).sort((a, b) => a.key.localeCompare(b.key));

  const gateMap = new Map();
  for (const r of actionable) gateMap.set(r.gate, (gateMap.get(r.gate) || 0) + 1);
  const gates = [...gateMap].sort((a, b) => b[1] - a[1]).map(([gate, count]) => ({ gate, count }));

  const family = familyById(before.familyId);
  const related = currentRequirements()
    .filter((r) => r.sectionId === before.sectionId && r.id !== before.id && r.appliesTo.includes("stadium"))
    .map((r) => ({ id: r.id, title: r.title }));

  const ownerMap = new Map();
  for (const r of actionable) {
    if (!ownerMap.has(r.owner)) ownerMap.set(r.owner, { owner: r.owner, rows: [], due: null });
    const o = ownerMap.get(r.owner);
    o.rows.push(r);
    if (!o.due || r.due < o.due) o.due = r.due;
  }
  const owners = [...ownerMap.values()].map((o) => ({ ...o, dueText: formatDue(o.due) })).sort((a, b) => b.rows.length - a.rows.length || a.owner.localeCompare(b.owner));

  const worse = rows.filter((r) => r.worse).length;
  const stillPass = onRecord.filter((r) => r.newCheck === "pass").length;
  const nowFail = onRecord.filter((r) => r.newCheck === "fail").length;
  const steps = [
    {
      label: "Compared the proposal with the requirement in force",
      detail: `${before.id} ${before.title} moves from ${oldCrit} to ${crit}${shift.direction === "changed" ? "" : `, ${shift.direction}${shift.percent ? ` by ${shift.percent}%` : ""}`}.`,
      ok: true,
    },
    {
      label: "Matched it in the register",
      detail: `Chapter ${before.familyId} ${family?.name || before.category}, book section ${before.section}. It applies at ${plural(rows.length, "stadium")}${skipped ? `; ${plural(skipped, "stadium")} ${skipped === 1 ? "is" : "are"} excluded` : ""}.`,
      ok: rows.length > 0,
    },
    {
      label: "Re-checked every recorded value against the new criterion",
      detail: onRecord.length ? `${plural(onRecord.length, "value")} on record: ${stillPass} still meet it, ${nowFail} would not.` : "No stadium has a value on record for this requirement yet.",
      ok: nowFail === 0,
    },
    {
      label: "Checked the reviewers' decisions",
      detail: `${plural(counts.reopened, "compliant item")} would reopen, ${plural(counts.failsInReview, "submission")} in review would fail, ${plural(counts.stillFailing, "stadium")} already not meeting it would fall further short, ${plural(counts.notAssessed, "stadium")} not assessed yet.`,
      ok: counts.reopened + counts.failsInReview === 0,
    },
    {
      label: "Re-classified mitigation exposure",
      detail: `Critical ${exposure.before.critical} to ${exposure.after.critical}, material ${exposure.before.material} to ${exposure.after.material}; ${plural(worse, "stadium")} ${worse === 1 ? "moves" : "move"} to a worse class.`,
      ok: worse === 0,
    },
    {
      label: "Looked at gates and neighbouring requirements",
      detail: `${gates.length ? `Next gates at risk: ${gates.map((g) => `${g.gate} (${g.count})`).join(", ")}.` : "No next gate is put at risk."} ${related.length ? `${plural(related.length, "other requirement")} in the same book section ${related.length === 1 ? "is" : "are"} worth reading with this change.` : ""}`.trim(),
      ok: gates.length === 0,
    },
    {
      label: "Prepared follow-up actions",
      detail: actionable.length ? `${plural(actionable.length, "action")} for ${plural(owners.length, "owner")}: ${owners.map((o) => o.owner).join("; ")}.` : "No owner has to act.",
      ok: true,
    },
  ];

  return { kind: "amendment", scenario, before, after, shift, family, rows, skipped, counts, actionable, exposure, programme, byCity, byStage, gates, related, owners, steps, crit, oldCrit };
}

/** A complete requirement object for a requirement a person adds (same shape as the catalogue's). */
export function buildNewRequirement(spec, number) {
  const family = familyById(spec.familyId);
  return {
    id: `ADD-${String(number).padStart(4, "0")}`,
    version: 1,
    sourceId: "ADDED",
    title: spec.title,
    summary: spec.quote || spec.title,
    generic: false,
    assetType: "Stadium",
    appliesTo: ["stadium"],
    condition: "Added requirement",
    workstream: "Added requirement",
    category: family.name,
    categoryBasis: "Added from the Requirement watch",
    familyId: family.id,
    familyShort: family.short,
    sectionId: "99.1",
    section: "99.1 Added requirements",
    topic: "Added requirements",
    printedPage: null,
    pdfPage: 0,
    criterion: spec.criterion,
    sourceCheck: "added",
    applicabilityReview: "pending",
    applicability: "provisional",
    suggestedEvidence: "Drawings / calculations / tests / certificates as applicable",
    evidenceBasis: "Added from the Requirement watch",
    authority: "Added requirement",
    sourceClass: "Added from the Requirement watch",
    sourceUrl: null,
    clause2034: "To be confirmed",
    reviewIssueIds: [],
  };
}

/**
 * Assess a requirement the register does not have yet. It would apply at every stadium with no evidence, so nothing
 * reopens; what changes is the number of requirements in scope and which stadiums should start assessing it.
 */
export function assessNewRequirement(scenario, records, now = new Date()) {
  const req = scenario.newRequirement;
  const family = familyById(req.familyId);
  const cities = Object.fromEntries(FACILITY_REGISTER.hostCities.map((c) => [c.id, c]));
  const crit = criterionText(req.criterion);
  const rows = FACILITY_REGISTER.stadiums.map((stadium) => {
    const row = { requirement: req, key: assessmentKey(stadium.id, req), applicability: { value: "provisional", reason: "" } };
    const levelAfter = findingExposure(stadium, row, null).level;
    const actionable = levelAfter !== "controlled";
    return {
      stadium,
      city: cities[stadium.cityId]?.name || "",
      status: "unassessed",
      value: null,
      valueText: "",
      oldCheck: null,
      newCheck: null,
      outcome: "notAssessed",
      actionable,
      levelBefore: null,
      levelAfter,
      worse: false,
      gate: nextGate(stadium),
      owner: ownerFor(stadium.id, req),
      due: actionable ? dueDate(levelAfter, now) : null,
      action: actionable ? `Ask the stadium delivery team for evidence of ${crit}${req.criterion.operator === "manual" ? "" : ""} and start the assessment.` : "",
    };
  });
  const actionable = rows.filter((r) => r.actionable);
  const counts = Object.fromEntries(OUTCOME_ORDER.map((k) => [k, 0]));
  counts.notAssessed = rows.length;
  const exposure = { before: zero(), after: zero() };
  for (const r of rows) exposure.after[r.levelAfter]++;
  let inScope = 0;
  let compliant = 0;
  for (const s of FACILITY_REGISTER.stadiums) {
    const a = stadiumAssurance(s, records);
    inScope += a.inScope;
    compliant += a.compliant;
  }
  const programme = { inScope, inScopeAfter: inScope + rows.length, compliantBefore: compliant, compliantAfter: compliant };
  const group = (keyOf) => {
    const map = new Map();
    for (const r of rows) {
      const k = keyOf(r);
      if (!map.has(k)) map.set(k, { key: k, stadiums: 0, reopened: 0, failsInReview: 0, notAssessed: 0 });
      const g = map.get(k);
      g.stadiums++;
      g.notAssessed++;
    }
    return [...map.values()];
  };
  const byCity = group((r) => r.city).sort((a, b) => a.key.localeCompare(b.key));
  const byStage = group((r) => `Due ${r.stadium.completionYear}`).sort((a, b) => a.key.localeCompare(b.key));
  const gateMap = new Map();
  for (const r of actionable) gateMap.set(r.gate, (gateMap.get(r.gate) || 0) + 1);
  const gates = [...gateMap].sort((a, b) => b[1] - a[1]).map(([gate, count]) => ({ gate, count }));
  const ownerMap = new Map();
  for (const r of actionable) {
    if (!ownerMap.has(r.owner)) ownerMap.set(r.owner, { owner: r.owner, rows: [], due: null });
    const o = ownerMap.get(r.owner);
    o.rows.push(r);
    if (!o.due || r.due < o.due) o.due = r.due;
  }
  const owners = [...ownerMap.values()].map((o) => ({ ...o, dueText: formatDue(o.due) })).sort((a, b) => b.rows.length - a.rows.length || a.owner.localeCompare(b.owner));
  const steps = [
    { label: "Read the proposed requirement", detail: `${req.title}: ${crit}. Chapter ${family.id} ${family.name}.`, ok: true },
    { label: "Checked the register", detail: "No requirement in the register covers this, so it would be added as a new one.", ok: true },
    { label: "Applied it to every stadium", detail: `It would apply at ${plural(rows.length, "stadium")}. None has evidence for it, so every one starts as not assessed.`, ok: true },
    {
      label: "Re-classified mitigation exposure",
      detail: `${plural(actionable.length, "stadium")} complete${actionable.length === 1 ? "s" : ""} by 2027, so an assessment is due soon (manageable); the other ${rows.length - actionable.length} stay controlled. The fulfilled share falls from ${Math.round((compliant / inScope) * 100)}% to ${Math.round((compliant / (inScope + rows.length)) * 100)}% because there are more requirements to meet.`,
      ok: actionable.length === 0,
    },
    {
      label: "Prepared follow-up actions",
      detail: actionable.length ? `${plural(actionable.length, "action")} for ${plural(owners.length, "owner")}: ${owners.map((o) => o.owner).join("; ")}.` : "No stadium has to act yet.",
      ok: true,
    },
  ];
  return { kind: "new", scenario, before: null, after: req, shift: null, family, rows, skipped: 0, counts, actionable, exposure, programme, byCity, byStage, gates, related: [], owners, steps, crit, oldCrit: null };
}
