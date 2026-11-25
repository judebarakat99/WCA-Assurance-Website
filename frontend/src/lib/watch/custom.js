// Changes and requirements a person typed or dropped on the Requirement watch. Kept in the browser (the key is the
// one lib/domain/requirementVersions reads at load) and cleared with Reset demo (lib/store/alerts clearAlerts).
//
// A stored change is { id, kind: "amendment" | "new", title, summary, rationale, detected, criterion, requirementId?,
// newRequirement?, source: { type, name, quote, page }, custom: true, applied? }.
import { CUSTOM_KEY, readCustom, setCustom } from "@/lib/domain/requirementVersions.mjs";
import { notify } from "@/lib/store/state";

let state = null;
let seq = 0;

// Which of the stored changes the Requirement watch is listing. The tab starts empty each time it is opened: the stored
// changes stay (their alerts, and any change already applied to the register, are kept), but only the ones added since
// the tab was opened are listed. Held in memory only, so a reload also starts empty.
let shown = new Set();
/** Whether a stored change is listed on the watch. */
export const isShown = (id) => shown.has(id);
/** List these stored changes on the watch. */
export function showIds(ids) {
  if (!ids.length) return;
  shown = new Set([...shown, ...ids]);
  notify();
}
/** Start the watch empty again. */
export function resetShown() {
  if (!shown.size) return;
  shown = new Set();
  notify();
}

function load() {
  if (!state) state = readCustom();
  return state;
}
function commit() {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(state));
  } catch {
    // Private mode or full storage: keep working for this page load.
  }
  setCustom(state);
  notify();
}

/** Everything a person added: { scenarios, requirements }. */
export const getCustom = () => load();
/** The changes a person added, newest first. */
export const customScenarios = () => load().scenarios;

/** Add changes found by the agent. Returns the stored changes. */
export function addScenarios(items, now = new Date()) {
  const s = load();
  const day = now.toISOString().slice(0, 10);
  const stamp = now.getTime().toString(36);
  const added = items.map((item) => ({ ...item, id: `CHG-X-${stamp}-${++seq}`, detected: day, custom: true }));
  s.scenarios = [...added, ...s.scenarios];
  commit();
  return added;
}

/** Remove a change that has not been applied. */
export function removeScenario(id) {
  const s = load();
  const before = s.scenarios.length;
  s.scenarios = s.scenarios.filter((x) => x.id !== id || x.applied);
  shown.delete(id);
  if (s.scenarios.length !== before) commit();
  else notify();
}

/** A brand new requirement joins the register: it applies to every stadium from now on. */
export function applyNewRequirement(id) {
  const s = load();
  const item = s.scenarios.find((x) => x.id === id && x.kind === "new" && !x.applied);
  if (!item) return null;
  item.applied = true;
  item.appliedOn = new Date().toISOString().slice(0, 10);
  s.requirements = [...s.requirements.filter((r) => r.id !== item.newRequirement.id), item.newRequirement];
  commit();
  return item.newRequirement;
}

/** The requirements added to the register this way. */
export const addedRequirements = () => load().requirements;

/** Remove everything (Reset demo). */
export function clearCustom() {
  shown = new Set();
  state = { scenarios: [], requirements: [] };
  commit();
}
