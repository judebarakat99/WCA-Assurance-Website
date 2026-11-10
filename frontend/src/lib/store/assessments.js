// Assessment store: facility × requirement × version records, persisted in the
// browser (separately from the demo simulation). Changes call notify() so
// components using useProgramme() re-render.
import { assessmentKey, evaluate, seedAssessments } from "@/lib/domain/assessment.mjs";
import { changeImpact, changedRecords } from "@/lib/domain/requirementChange.mjs";
import { appliedChanges, scenarioById, setAppliedChanges } from "@/lib/domain/requirementVersions.mjs";
import { sampleAssessments } from "@/lib/domain/sampleAssessments.mjs";
import { notify } from "@/lib/store/state";

const KEY = "wca-assessments-v1";
const CHANGES_KEY = "wca-requirement-changes-v1";
const REVIEWER = "Compliance reviewer";
let records = null;

const today = () => new Date().toISOString().slice(0, 10);

function load() {
  // Requirement versions first: record keys depend on them.
  try {
    setAppliedChanges(JSON.parse(localStorage.getItem(CHANGES_KEY) || "[]"));
  } catch {
    setAppliedChanges([]);
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      records = JSON.parse(raw);
      return;
    }
  } catch {}
  records = seedAssessments();
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(records));
    localStorage.setItem(CHANGES_KEY, JSON.stringify(appliedChanges()));
  } catch {}
}

/** All assessment records, keyed by assessmentKey(). */
export function getAssessments() {
  if (!records) load();
  return records;
}

function upsert(facilityId, requirement, change) {
  const all = getAssessments();
  const key = assessmentKey(facilityId, requirement);
  const current = all[key] || {
    facilityId,
    requirementId: requirement.id,
    requirementVersion: requirement.version,
    status: "unassessed",
    evidence: [],
    review: null,
    history: [],
  };
  all[key] = change(current);
  save();
  notify();
  return all[key];
}

/** Record evidence against a requirement; numeric criteria are checked at once. */
export function recordEvidence(facilityId, requirement, { file, value, note = "" }) {
  return upsert(facilityId, requirement, (a) => {
    const check = evaluate(requirement.criterion, value);
    return {
      ...a,
      status: "evidence-submitted",
      review: null,
      evidence: [...a.evidence, { file: file || "evidence.pdf", value, note, check, on: today() }],
      history: [...a.history, { on: today(), action: `Evidence submitted: ${file || "evidence.pdf"} (${check})` }],
    };
  });
}

/** Reviewer decision on submitted evidence. outcome: "compliant" | "non-compliant". */
export function reviewAssessment(facilityId, requirement, outcome, note = "") {
  return upsert(facilityId, requirement, (a) => ({
    ...a,
    status: outcome,
    review: { outcome, by: REVIEWER, on: today(), note },
    history: [...a.history, { on: today(), action: `${REVIEWER}: ${outcome === "compliant" ? "compliant" : "non-compliant"}` }],
  }));
}

/** Back to the register-derived seed (declared capacities only). */
export function resetAssessments() {
  setAppliedChanges([]);
  records = seedAssessments();
  save();
  notify();
}

/** Replace the store with labelled sample assessments for a demonstration. */
export function loadSampleAssessments() {
  setAppliedChanges([]);
  records = sampleAssessments();
  save();
  notify();
}

/** True when the store holds sample records. */
export function hasSampleAssessments() {
  return Object.values(getAssessments()).some((a) => a.sample);
}

/** Requirement changes applied so far (newest last). */
export function getAppliedChanges() {
  getAssessments();
  return appliedChanges();
}

/**
 * Apply a change scenario: the requirement moves to its next version and every
 * stadium's record is re-checked against the new criterion (see
 * domain/requirementChange). Returns the impact that was applied.
 */
export function applyRequirementChange(scenarioId) {
  const scenario = scenarioById(scenarioId);
  if (!scenario || appliedChanges().some((c) => c.changeId === scenarioId)) return null;
  const impact = changeImpact(scenario, getAssessments());
  Object.assign(records, changedRecords(impact, today()));
  setAppliedChanges([
    ...appliedChanges(),
    {
      changeId: scenario.id,
      requirementId: scenario.requirementId,
      version: impact.after.version,
      criterion: scenario.criterion,
      on: today(),
    },
  ]);
  save();
  notify();
  return impact;
}
