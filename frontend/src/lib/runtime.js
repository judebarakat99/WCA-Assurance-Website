// Client runtime: boots the programme store once, connects the domain's
// goView() to the Next router, keeps the tour highlight in step with state
// changes, and records the 3D twin's events in the audit log.
import { venueMeta } from "@/lib/domain/data";
import { bridge, ensureLoaded, log, notify, save, tour } from "@/lib/store/state";
import { applyHL } from "@/lib/tour/highlight";

// View keys used by the domain and the tour, mapped to App Router paths.
export const PATHS = {
  home: "/",
  review: "/review",
  overview: "/overview",
  readiness: "/readiness",
  tower: "/control-tower",
  register: "/control-tower/register",
  gates: "/control-tower/gates",
  actions: "/decisions-actions",
  twin: "/design-review",
  requirements: "/requirements-evidence",
  dossier: "/dossiers",
  compliance: "/compliance",
};
const ALIAS = {
  issues: "actions",
  decisions: "actions",
  change: "requirements",
  decompose: "requirements",
};

/**
 * Path for a view key; "venue-<id>" opens a simulation venue, "facility-<id>"
 * a stadium's assessment page. A "?query" suffix is kept ("review?city=riyadh").
 */
export function pathFor(key) {
  const [base, query] = key.split("?");
  const k = ALIAS[base] || base;
  let path = PATHS[k] || "/";
  if (k.startsWith("venue-")) path = `/control-tower/${k.slice(6)}`;
  if (k.startsWith("facility-")) path = `/facilities/${k.slice(9)}`;
  return query ? `${path}?${query}` : path;
}

let routerPush = null;
export function setRouterPush(push) {
  routerPush = push;
}

function navigate(key) {
  if (key.startsWith("venue-") && !venueMeta(key.slice(6))) key = "tower";
  if (!tour.active) window.scrollTo(0, 0);
  routerPush?.(pathFor(key), { scroll: false });
}

// The twin script loads asynchronously; wire its hooks once it exists.
function connectTwin() {
  if (!window.WNSTwin) {
    setTimeout(connectTwin, 200);
    return;
  }
  window.WNSTwin.hooks({
    onEvent: (text) => {
      log("Rule engine", text, null);
      save();
    },
    onChange: notify,
  });
}

let booted = false;
/** Boot once per page load. Safe to call from any component. */
export function bootRuntime() {
  if (booted) return;
  booted = true;
  ensureLoaded();
  bridge.render = () => applyHL(false);
  bridge.navigate = navigate;
  connectTwin();
}

/** Called when a page mounts: make sure the runtime is up and refresh the highlight. */
export function onPageMount() {
  bootRuntime();
  applyHL(false);
}
