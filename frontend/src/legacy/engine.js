// ---------- legacy runtime: string-template views and delegated events ----------
// Pages not yet rebuilt as React components are rendered here into <main id="view">.
// bootRuntime() runs once (from components/templates/AppRuntime) and installs
// the document-level listeners, the assistant and the 3D twin hooks. State
// changes go through rerender(), which notifies React and repaints the legacy
// page if one is showing. Remove a view from LEGACY_VIEWS when it moves to React.
import {
  GATES,
  LEVELS,
  SLA,
  esc,
  fmtD,
  addDays,
  venueMeta,
  critText,
  showVal,
  SAMPLE_CLAUSE,
} from "@/lib/domain/data";
import {
  S,
  save,
  log,
  resetS,
  ui,
  tour,
  bridge,
  rerender,
  goView,
  ensureLoaded,
  notify,
} from "@/lib/store/state";
import { venueState, gateEval } from "@/lib/domain/scoring";
import { invalidateForecasts } from "@/lib/domain/forecast";
import {
  toast,
  validate,
  verify,
  advance,
  decide,
  applyChange,
  requestGatePass,
  escalateGateBlockers,
  escalateIssue,
  decompose,
} from "@/lib/domain/actions";
import {
  openDrawer,
  closeDrawer,
  renderDrawer,
} from "@/lib/drawer";
import {
  applyHL,
  startTour,
  handleTourClick,
  setTourVoice,
  setTourVoiceName,
  EXEC,
} from "@/legacy/views/tour";
import { ai } from "@/lib/store/state";

const $ = (s) => document.querySelector(s);
export const PATHS = {
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

// Legacy hash keys mapped to App Router paths. "register" and "gates" stay as
// full subpages under the Control Tower; old keys are aliased so the demos and
// in-content links keep working.
const ALIAS = {
  issues: "actions",
  decisions: "actions",
  change: "requirements",
  decompose: "requirements",
};
export function pathFor(h) {
  if (ALIAS[h]) h = ALIAS[h];
  if (/^venue-/.test(h)) return "/control-tower/" + h.slice(6);
  return PATHS[h] || "/overview";
}
function viewKeyFor(h) {
  if (ALIAS[h]) h = ALIAS[h];
  return h;
}

const current = { view: null, param: null };
let routerPush = null;
let booted = false;

function navigate(h) {
  const key = viewKeyFor(h);
  if (/^venue-/.test(key) && !venueMeta(key.slice(6))) {
    navigate("tower");
    return;
  }
  // The destination page mounts after the route change and paints itself
  // (legacy pages through AppView → mountView), so nothing is painted here.
  current.view = null;
  current.param = null;
  if (!tour.active) window.scrollTo(0, 0);
  if (routerPush) routerPush(pathFor(h), { scroll: false });
}

// Re-applies the tour highlight after a state change (pages render in React).
function renderLegacy() {
  if (!S) return;
  invalidateForecasts();
  const today = $("#today");
  if (today) today.textContent = fmtD(S.today);
  applyHL(false);
}

// Waits for the public twin script (Three.js stays untouched) and wires its hooks.
function waitForTwin() {
  if (window.WNSTwin) {
    window.WNSTwin.hooks({
      onEvent: (txt) => {
        log("Rule engine", txt, null);
        save();
      },
      onChange: notify,
    });
    return;
  }
  setTimeout(waitForTwin, 200);
}

// Boots the shared runtime once per page load. Safe to call repeatedly.
export function bootRuntime() {
  if (booted) return;
  booted = true;
  ensureLoaded();
  bridge.render = renderLegacy;
  bridge.navigate = navigate;
  installListeners();
  waitForTwin();
}

export function setRouterPush(push) {
  routerPush = push;
}

// Called by React pages so the legacy renderer leaves the page alone.
export function mountReactView() {
  bootRuntime();
  current.view = null;
  current.param = null;
  applyHL(false);
}

// ---------- delegated events for the tour dock (rendered from HTML strings) ----------
let listenersOn = false;
function installListeners() {
  if (listenersOn) return;
  listenersOn = true;
  document.addEventListener("click", (ev) => {
    const t = ev.target.closest("button");
    if (!t) return;
    if (t.dataset.tour) return handleTourClick(t.dataset.tour);
  });
  document.addEventListener("change", (ev) => {
    const t = ev.target;
    if (t.id === "tourVoice") setTourVoice(t.checked);
    if (t.id === "tourVoiceSel") setTourVoiceName(t.value);
  });
}
