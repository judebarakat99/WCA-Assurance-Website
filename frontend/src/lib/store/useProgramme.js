import { useSyncExternalStore } from "react";
import { getAssessments } from "./assessments";
import { ui, subscribe, getVersion } from "./state";

// Client snapshot: the store version (always >= 1 once assessments are loaded).
function getSnapshot() {
  getAssessments();
  return getVersion() + 1;
}

// Server and hydration snapshot: nothing loaded. Assessments live in the
// browser (localStorage), so pages render them only after hydration.
function getServerSnapshot() {
  return 0;
}

/**
 * Read the shared UI state in a client component.
 * Returns null during prerender and hydration, then { ui, version } and
 * re-renders whenever state changes.
 */
export function useProgramme() {
  const version = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return version === 0 ? null : { ui, version };
}
