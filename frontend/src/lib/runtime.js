// Client runtime: loads assessments once, connects goView() to the Next
// router, and keeps the tour highlight in step with state changes.
import { getAssessments } from "@/lib/store/assessments";
import { bridge, tour } from "@/lib/store/state";
import { applyHL } from "@/lib/tour/highlight";

// View keys used by the tour, mapped to App Router paths.
export const PATHS = {
  home: "/",
  review: "/review",
  compliance: "/compliance",
};

/**
 * Path for a view key; "facility-<id>" opens a stadium's assessment page.
 * A "?query" suffix is kept ("review?city=riyadh").
 */
export function pathFor(key) {
  const [base, query] = key.split("?");
  let path = PATHS[base] || "/";
  if (base.startsWith("facility-")) path = `/facilities/${base.slice(9)}`;
  return query ? `${path}?${query}` : path;
}

let routerPush = null;
export function setRouterPush(push) {
  routerPush = push;
}

function navigate(key) {
  if (!tour.active) window.scrollTo(0, 0);
  routerPush?.(pathFor(key), { scroll: false });
}

let booted = false;
/** Boot once per page load. Safe to call from any component. */
export function bootRuntime() {
  if (booted) return;
  booted = true;
  getAssessments(); // loads requirement versions too
  bridge.render = () => applyHL(false);
  bridge.navigate = navigate;
}

/** Called when a page mounts: make sure the runtime is up and refresh the highlight. */
export function onPageMount() {
  bootRuntime();
  applyHL(false);
}
