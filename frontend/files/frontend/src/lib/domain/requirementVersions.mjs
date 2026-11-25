// Requirement versions: the catalogue is version 1 of every requirement; an applied change replaces one
// requirement's criterion and bumps its version. The applied list is set by lib/store/assessments (it persists
// it); the domain reads the current versions from here.
//
// Changes and requirements that a person typed or dropped on the Requirement watch (lib/watch/custom) are kept in
// the browser. They are read here, when this module loads, so every page sees them whichever page is opened first.
import scenarios from "../../../../data/register/change-scenarios.json" with { type: "json" };
import { FIFA_CATALOGUE } from "@/lib/domain/fifa-catalogue.mjs";

export const CUSTOM_KEY = "wca-watch-custom-v1";

/** Hypothetical changes available to preview and apply: the ones in the data file, then any a person added. */
export const CHANGE_SCENARIOS = [...scenarios.scenarios];
export const CHANGE_NOTE = scenarios.note;
export const scenarioById = (id) => CHANGE_SCENARIOS.find((s) => s.id === id) || null;

let applied = []; // [{ changeId, requirementId, version, criterion, on }]
let extras = []; // requirements added from the Requirement watch (full requirement objects)
let cache = null;

/** Read what a person added from the browser's storage: { scenarios: [], requirements: [] }. */
export function readCustom() {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(CUSTOM_KEY) : null;
    const data = raw ? JSON.parse(raw) : null;
    return { scenarios: Array.isArray(data?.scenarios) ? data.scenarios : [], requirements: Array.isArray(data?.requirements) ? data.requirements : [] };
  } catch {
    return { scenarios: [], requirements: [] };
  }
}

/**
 * Make the added changes and requirements visible to the rest of the app.
 * A change to an existing requirement joins CHANGE_SCENARIOS (so the map's change panel lists it too); a brand new
 * requirement does not, because there is nothing for the map to compare it with.
 */
export function setCustom({ scenarios: list = [], requirements = [] } = {}) {
  for (let i = CHANGE_SCENARIOS.length - 1; i >= 0; i--) if (CHANGE_SCENARIOS[i].custom) CHANGE_SCENARIOS.splice(i, 1);
  for (const s of list) if (s.kind !== "new" && !CHANGE_SCENARIOS.some((x) => x.id === s.id)) CHANGE_SCENARIOS.push(s);
  extras = requirements;
  cache = null;
}
if (typeof window !== "undefined") setCustom(readCustom());

/** Set the applied changes (called by the store when it loads or changes). */
export function setAppliedChanges(list) {
  applied = list || [];
  cache = null;
}
export const appliedChanges = () => applied;

/** Catalogue requirements at their current versions, then the requirements a person added. */
export function currentRequirements() {
  if (cache) return cache;
  cache = [
    ...FIFA_CATALOGUE.requirements.map((r) => {
      const changes = applied.filter((c) => c.requirementId === r.id);
      if (!changes.length) return r;
      const last = changes.at(-1);
      return { ...r, version: last.version, criterion: last.criterion, changedBy: last.changeId, previous: r.criterion };
    }),
    ...extras.map((r) => {
      const changes = applied.filter((c) => c.requirementId === r.id);
      if (!changes.length) return r;
      const last = changes.at(-1);
      return { ...r, version: last.version, criterion: last.criterion, changedBy: last.changeId, previous: r.criterion };
    }),
  ];
  return cache;
}
export const currentRequirement = (id) => currentRequirements().find((r) => r.id === id) || null;

/** The next version of a requirement under a change scenario. */
export function nextVersion(scenario) {
  const current = currentRequirement(scenario.requirementId);
  return { ...current, version: current.version + 1, criterion: scenario.criterion, changedBy: scenario.id, previous: current.criterion };
}
