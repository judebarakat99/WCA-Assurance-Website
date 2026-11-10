// Requirement versions: the catalogue is version 1 of every requirement; an
// applied change replaces one requirement's criterion and bumps its version.
// The applied list is set by lib/store/assessments (it persists it); the
// domain reads the current versions from here.
import scenarios from "../../../../data/fifa/change-scenarios.json" with { type: "json" };
import { FIFA_CATALOGUE } from "@/lib/domain/fifa-catalogue.mjs";

/** Hypothetical changes available to preview and apply. */
export const CHANGE_SCENARIOS = scenarios.scenarios;
export const CHANGE_NOTE = scenarios.note;
export const scenarioById = (id) => CHANGE_SCENARIOS.find((s) => s.id === id) || null;

let applied = []; // [{ changeId, requirementId, version, criterion, on }]
let cache = null;

/** Set the applied changes (called by the store when it loads or changes). */
export function setAppliedChanges(list) {
  applied = list || [];
  cache = null;
}
export const appliedChanges = () => applied;

/** Catalogue requirements at their current versions. */
export function currentRequirements() {
  if (cache) return cache;
  cache = FIFA_CATALOGUE.requirements.map((r) => {
    const changes = applied.filter((c) => c.requirementId === r.id);
    if (!changes.length) return r;
    const last = changes.at(-1);
    return { ...r, version: last.version, criterion: last.criterion, changedBy: last.changeId, previous: r.criterion };
  });
  return cache;
}

export const currentRequirement = (id) => currentRequirements().find((r) => r.id === id) || null;

/** The next version of a requirement under a change scenario. */
export function nextVersion(scenario) {
  const current = currentRequirement(scenario.requirementId);
  return { ...current, version: current.version + 1, criterion: scenario.criterion, changedBy: scenario.id, previous: current.criterion };
}
