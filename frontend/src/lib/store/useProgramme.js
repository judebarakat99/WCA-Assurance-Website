import { useSyncExternalStore } from "react";
import { S, ui, subscribe, getVersion, ensureLoaded } from "./state";

// Client snapshot: the store version (always >= 1 once the model is loaded).
function getSnapshot() {
  ensureLoaded();
  return getVersion() + 1;
}

// Server and hydration snapshot: no model. The programme lives in the
// browser (localStorage), so pages render it only after hydration.
function getServerSnapshot() {
  return 0;
}

/**
 * Read the programme model in a client component.
 * Returns null during prerender and hydration, then { S, ui, version } and
 * re-renders whenever the model changes.
 */
export function useProgramme() {
  const version = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return version === 0 ? null : { S, ui, version };
}
