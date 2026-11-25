// What a person can do with a proposed requirement change, and where each change stands. A change is "new" until
// its owners are notified (their alerts exist in the alerts store) and "applied" once it is in the register (the
// assessment store's applied list for a change to a requirement; the custom store for a requirement that is added).
// Both are read from those stores, so Reset demo clears them with everything else.
//
// The feed holds only what a person adds on the Requirement watch (by typing text or dropping a document, which
// lib/watch/extract reads) since the tab was opened, so it starts empty each time. Changes added earlier stay stored,
// with their alerts and anything applied to the register; they are listed again when the same text or document is
// added again. The data file's changes stay available to the map's change panel.
import { CHANGE_NOTE, currentRequirement } from "@/lib/domain/requirementVersions.mjs";
import { isoDate, shortDate } from "@/lib/reports/text.mjs";
import { getAlerts, raiseAlerts } from "@/lib/store/alerts";
import { applyRequirementChange, getAppliedChanges, getAssessments } from "@/lib/store/assessments";
import { addScenarios, addedRequirements, applyNewRequirement, customScenarios, isShown, removeScenario, showIds } from "@/lib/watch/custom";
import { assessChange, assessNewRequirement, buildNewRequirement, severityOf } from "@/lib/watch/impact.mjs";

export { CHANGE_NOTE };

export const STATE = {
  new: { label: "New", tone: "warn" },
  notified: { label: "Owners notified", tone: "info" },
  applied: { label: "Applied", tone: "good" },
};

/** The alerts raised for one change. */
export const alertsFor = (changeId) => getAlerts().filter((a) => a.source?.id === changeId);

/** Every proposed change with its state and (until it is applied) its assessment, newest first. */
export function watchItems(now = new Date()) {
  const records = getAssessments();
  const applied = new Map(getAppliedChanges().map((c) => [c.changeId, c]));
  const items = customScenarios()
    .filter((s) => isShown(s.id))
    .map((scenario, index) => {
      const kind = scenario.kind === "new" ? "new" : "amendment";
      const done = kind === "new" ? (scenario.applied ? { version: 1, on: scenario.appliedOn } : null) : applied.get(scenario.id) || null;
      if (kind === "amendment" && !currentRequirement(scenario.requirementId)) return null;
      const alerts = alertsFor(scenario.id);
      let detectedIso = scenario.detected;
      if (!detectedIso) {
        const d = new Date(now);
        d.setDate(d.getDate() - (scenario.detected_days_ago ?? 0));
        detectedIso = isoDate(d);
      }
      return {
        scenario,
        kind,
        custom: !!scenario.custom,
        source: scenario.source || null,
        state: done ? "applied" : alerts.length ? "notified" : "new",
        applied: done,
        alerts,
        detectedIso,
        detectedText: shortDate(detectedIso),
        assessment: done ? null : kind === "new" ? assessNewRequirement(scenario, records, now) : assessChange(scenario, records, now),
        index,
      };
    })
    .filter(Boolean);
  const order = { new: 0, notified: 1, applied: 2 };
  return items.sort(
    (a, b) =>
      order[a.state] - order[b.state] ||
      Number(b.custom) - Number(a.custom) ||
      (a.custom && b.custom ? a.index - b.index : 0) ||
      (b.assessment?.counts.reopened ?? 0) - (a.assessment?.counts.reopened ?? 0) ||
      b.detectedIso.localeCompare(a.detectedIso),
  );
}

/** Figures for the tab badge and the tiles. */
export function watchSummary(items) {
  const open = items.filter((i) => i.state !== "applied");
  const toNotify = items.filter((i) => i.state === "new" && i.assessment);
  const stadiums = new Set();
  const owners = new Set();
  let reopen = 0;
  let fails = 0;
  for (const i of open) {
    reopen += i.assessment.counts.reopened;
    fails += i.assessment.counts.failsInReview;
    for (const r of i.assessment.actionable) stadiums.add(r.stadium.id);
  }
  for (const i of toNotify) for (const r of i.assessment.actionable) owners.add(r.owner);
  return { proposed: open.length, applied: items.length - open.length, reopen, fails, stadiums: stadiums.size, owners: owners.size };
}

export const watchCounts = () => ({ pending: watchItems().filter((i) => i.state !== "applied").length });

/** What notifying the owners would send. */
export function notifyPlan(assessment) {
  const owners = assessment.owners.map((o) => o.owner);
  return { count: assessment.actionable.length, owners, ready: assessment.actionable.length > 0 };
}

/** Raise one alert for each stadium the change affects, addressed to the owner of the requirement. */
export function notifyOwners(assessment) {
  const { scenario, before, after, crit } = assessment;
  const isNew = assessment.kind === "new";
  const byStadium = new Map();
  for (const r of assessment.actionable) byStadium.set(r.stadium.id, r);
  let count = 0;
  for (const r of byStadium.values()) {
    const item = isNew
      ? {
          requirement_id: null,
          kind: "requirement-change",
          severity: "low",
          owner: r.owner,
          title: `${after.title}: new requirement of ${crit}; evidence needed`,
          detail: `${scenario.title}: ${scenario.summary} The requirement would apply at every stadium and none has evidence for it yet.`,
          action: r.action,
        }
      : {
          requirement_id: before.id,
          kind: "requirement-change",
          severity: severityOf(r.levelAfter),
          owner: r.owner,
          title: `${before.title}: the recorded ${r.valueText} would not meet the proposed requirement of ${crit}`,
          detail: `${scenario.title}: ${scenario.summary} ${r.outcome === "reopened" ? "The requirement is recorded as compliant and would reopen for review." : "The evidence in review would fail."}`,
          action: r.action,
        };
    count += raiseAlerts([item], { id: scenario.id, name: scenario.title, stadium_id: r.stadium.id, type: "change" }).length;
  }
  return { count, owners: assessment.owners.map((o) => o.owner) };
}

/** Apply the change to the register. Returns what the store reports, or null when nothing was applied. */
export function applyChange(changeId) {
  const custom = customScenarios().find((s) => s.id === changeId);
  if (custom && custom.kind === "new") {
    const requirement = applyNewRequirement(changeId);
    return requirement ? { kind: "new", after: requirement, counts: { reopened: 0 } } : null;
  }
  return applyRequirementChange(changeId) || null;
}

/** Take a change a person added out of the feed (only before it is applied). */
export function discardChange(changeId) {
  if (getAppliedChanges().some((c) => c.changeId === changeId)) return;
  removeScenario(changeId);
}

const nextNumber = () => {
  const ids = [...addedRequirements().map((r) => r.id), ...customScenarios().filter((s) => s.newRequirement).map((s) => s.newRequirement.id)];
  return ids.reduce((m, id) => Math.max(m, Number(String(id).replace(/\D/g, "")) || 0), 0) + 1;
};

/**
 * Put what the extraction agent found into the watch. items: the extraction's items (not the "already in force" ones),
 * with familyId possibly changed by the person; source: { name, kind }.
 * Returns { added, shown, skipped }: the new changes stored, the ids now listed on the watch (new ones, and earlier ones
 * brought back because the same requirement was added again), and how many were already listed.
 */
export function addFromExtraction(items, source, now = new Date()) {
  const existing = customScenarios();
  const scenarios = [];
  let number = nextNumber();
  let skipped = 0;
  const revived = [];
  const again = (match) => {
    if (isShown(match.id)) skipped++;
    else revived.push(match.id);
  };
  for (const item of items) {
    if (item.kind === "amendment") {
      const dup = existing.find((s) => !s.applied && s.requirementId === item.requirementId && JSON.stringify(s.criterion) === JSON.stringify(item.criterion));
      if (dup) {
        again(dup);
        continue;
      }
      const before = currentRequirement(item.requirementId);
      scenarios.push({
        kind: "amendment",
        requirementId: item.requirementId,
        title: item.title,
        summary: `${before.title} moves from ${item.oldCrit} to ${item.newCrit}.`,
        rationale: `Found in ${source.name}, page ${item.page}: “${item.quote}”`,
        criterion: item.criterion,
        source: { type: source.kind, name: source.name, quote: item.quote, page: item.page },
      });
    } else if (item.kind === "new") {
      const dup = existing.find((s) => !s.applied && s.kind === "new" && s.title.toLowerCase() === item.title.toLowerCase());
      if (dup) {
        again(dup);
        continue;
      }
      scenarios.push({
        kind: "new",
        title: item.title,
        summary: item.quote,
        rationale: `New requirement found in ${source.name}, page ${item.page}.`,
        criterion: item.criterion,
        newRequirement: buildNewRequirement(item, number++),
        source: { type: source.kind, name: source.name, quote: item.quote, page: item.page },
      });
    }
  }
  const added = scenarios.length ? addScenarios(scenarios, now) : [];
  const ids = [...added.map((s) => s.id), ...revived];
  showIds(ids);
  return { added, shown: ids, skipped };
}
