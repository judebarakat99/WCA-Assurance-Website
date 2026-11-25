// What the design review does to the rest of the site. The twin shows the design team's package being checked; this
// records each result in the requirement register as evidence for King Salman International Stadium (so the stadium
// page, the Overview, exposure, reports, the review queue and Nabd all show it) and, when the findings are sent to
// the design team, raises one alert for each with its owner and due date.
//
// Results go in as evidence awaiting a reviewer, exactly like a document filed on the Evidence page: nothing counts as
// compliant until the compliance team accepts it in the review queue.
import { assessmentKey } from "@/lib/domain/assessment.mjs";
import { currentRequirement } from "@/lib/domain/requirementVersions.mjs";
import { conditionById, logCondition, withdrawCondition } from "@/lib/domain/siteConditions.mjs";
import { ownerFor } from "@/lib/domain/mitigation.mjs";
import { KIND_LABEL, getAlerts, raiseAlerts, removeAlertsFor } from "@/lib/store/alerts";
import { getAssessments, recordEvidence } from "@/lib/store/assessments";
import { notify } from "@/lib/store/state";

// Alerts raised from a site condition read "Site condition" in the alerts list.
if (!KIND_LABEL["site-condition"]) KIND_LABEL["site-condition"] = "Site condition";

const REV_NAME = { C: "KSIS-DES Rev C", D: "KSIS-DES Rev D" };
const SEVERITY = { Critical: "high", High: "medium", Medium: "low" };

/** The requirement object a check is recorded against, with the criterion that gives the twin's verdict. */
function recordable(design, id, record) {
  const base = design.requirementOf(id);
  if (!base) return null;
  const real = base.criterion && base.criterion.operator !== "manual";
  if (record.mode === "register" && real) return base; // the register's own number decides
  // The twin's verdict on a measure the register does not state as a number: the evidence is stored with that verdict.
  if (record.value === "" || record.value == null) return base; // no value: the store marks it as needing review
  return { ...base, criterion: { operator: record.verdict === "pass" ? "gte" : "lt", value: Number(record.value), unit: record.unit } };
}

/**
 * Record a revision's results as evidence. Safe to call again: a result already recorded for the same file and value is skipped.
 * Returns the requirement ids recorded.
 */
export function recordDesignResults(design, rev) {
  const records = design.records[rev] || {};
  const all = getAssessments();
  const done = [];
  for (const [id, record] of Object.entries(records)) {
    const requirement = recordable(design, id, record);
    if (!requirement) continue;
    const key = assessmentKey(design.stadiumId, requirement);
    // Already recorded (replaying the review never adds a result twice, and never puts an older revision back on top of a newer one).
    if ((all[key]?.evidence || []).some((e) => e.file === record.file && String(e.value) === String(record.value))) continue;
    const check = design.check(id);
    recordEvidence(design.stadiumId, requirement, {
      file: record.file,
      value: record.value,
      note: `Design review of ${REV_NAME[rev]}: ${design.res[rev][id].why}${check.basis === "brief" ? " The threshold is from the design brief." : ""}`,
    });
    done.push(requirement.id);
  }
  return done;
}

/** Raise an alert for each finding sent to the design team. Safe to call again. Returns how many were raised. */
export function raiseDesignAlerts(design) {
  const source = { id: "design-review:KSIS-DES-RevC", name: REV_NAME.C, stadium_id: design.stadiumId, type: "document" };
  const existing = new Set(getAlerts().filter((a) => a.source?.id === source.id).map((a) => a.title));
  const items = [];
  for (const item of design.items) {
    const check = design.check(item.chk);
    const title = `${item.id} · ${check.t}`;
    if (existing.has(title)) continue;
    const req = check.reqId ? design.requirementOf(item.chk) : null;
    items.push({
      requirement_id: req ? req.id : null,
      kind: item.kind === "ncr" ? "below-criterion" : "missing-evidence",
      severity: SEVERITY[check.crit] || "medium",
      owner: design.ownerOf(item.chk) || item.to,
      title,
      detail: item.msg,
      action: item.kind === "ncr" ? `Resubmit the design with the finding fixed. Sent to ${item.to}.` : `Send the missing information. Sent to ${item.to}.`,
    });
  }
  return items.length ? raiseAlerts(items, source).length : 0;
}

/** What the design review has recorded in the register so far, for the card under the 3D view. */
export function recordedRows(design) {
  const all = getAssessments();
  const rows = [];
  for (const check of design.checks) {
    if (!check.reqId) continue;
    const requirement = design.requirementOf(check.id);
    if (!requirement) continue;
    const record = all[assessmentKey(design.stadiumId, requirement)];
    // the latest evidence the design review recorded (a later document filed on the Evidence page does not hide it)
    const latest = [...(record?.evidence || [])].reverse().find((e) => String(e.file || "").startsWith("KSIS-"));
    if (!latest) continue;
    const made = ["D", "C"].map((rev) => design.records[rev] && design.records[rev][check.id]).find((r) => r && r.file === latest.file);
    rows.push({ check, requirement, record, latest, unit: made ? made.unit : "" });
  }
  return rows;
}

const LEVEL_SEVERITY = { critical: "high", material: "medium", manageable: "low", controlled: "low" };

/**
 * Record a site condition. The exposure of every requirement it touches goes up (the register's exposure logic reads
 * it), and the owner of each gets an alert saying why and what to do. Returns how many alerts were raised.
 */
export function logSiteCondition(design, id) {
  const condition = conditionById(id);
  if (!condition || !logCondition(id)) return { raised: 0, logged: false };
  const items = [];
  for (const effect of condition.effects) {
    const req = currentRequirement(effect.requirementId);
    if (!req) continue;
    const level = design.levelOf(effect.requirementId);
    if (!level || level === "controlled") continue;
    items.push({
      requirement_id: req.id,
      kind: "site-condition",
      severity: LEVEL_SEVERITY[level],
      owner: ownerFor(design.stadiumId, req),
      title: `${req.title}: ${condition.title}`,
      detail: `${condition.detail} Exposure goes up because ${effect.because}.`,
      action: "Confirm the recovery plan with the contractor, update the programme and re-assess this requirement.",
    });
  }
  const source = { id: `site:${id}`, name: condition.source, stadium_id: design.stadiumId, type: "site" };
  const raised = items.length ? raiseAlerts(items, source).length : 0;
  notify(); // every page reads the exposure, so tell them it changed even when no alert was needed
  return { raised, logged: true };
}

/** Take a site condition back: the exposure returns to what its status gives it, and its alerts are withdrawn. */
export function withdrawSiteCondition(id) {
  if (!withdrawCondition(id)) return { withdrawn: false };
  removeAlertsFor(`site:${id}`);
  notify();
  return { withdrawn: true };
}
