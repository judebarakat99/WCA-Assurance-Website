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
} from "@/legacy/views/drawer";
import {
  applyHL,
  startTour,
  handleTourClick,
  setTourVoice,
  setTourVoiceName,
  EXEC,
} from "@/legacy/views/tour";
import { mountAI, renderAIMsgs, aiAsk } from "@/legacy/views/ai";
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
  mountAI();
  waitForTwin();
  renderDrawer();
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

// ---------- delegated events (behaviour preserved from the original app) ----------
let listenersOn = false;
function installListeners() {
  if (listenersOn) return;
  listenersOn = true;
  document.addEventListener("click", (ev) => {
    const link = ev.target.closest && ev.target.closest('a[href^="#"]');
    if (link) {
      const h = link.getAttribute("href").slice(1);
      if (
        PATHS[h] ||
        ALIAS[h] ||
        (/^venue-/.test(h) && venueMeta(h.slice(6)))
      ) {
        ev.preventDefault();
        goView(h);
        return;
      }
    }
    const t = ev.target.closest(
      "button,[data-obl],[data-close],[data-ai-close]",
    );

    if (!t) return;
    if (t.id === "aiFab") {
      ai.open = !ai.open;
      const p = document.getElementById("aiPanel");
      if (p) p.hidden = !ai.open;
      t.setAttribute("aria-expanded", String(ai.open));
      if (ai.open && !ai.msgs.length) {
        ai.msgs.push({
          who: "a",
          html: "Hi, I'm Nabd. Ask me about programme readiness, stadiums, gates, decisions or your reference documents. Programme metrics are illustrative; answers include supporting references.",
          greeting: true,
        });
        renderAIMsgs();
      }
      if (ai.open) {
        const i = document.getElementById("aiInput");
        if (i) i.focus();
      }
      return;
    }
    if (t.id === "aiClose" || t.hasAttribute("data-ai-close")) {
      ev.preventDefault();
      ev.stopPropagation();

      ai.open = false;

      const panel = document.getElementById("aiPanel");
      if (panel) {
        panel.hidden = true;
      }

      const fab = document.getElementById("aiFab");
      if (fab) {
        fab.setAttribute("aria-expanded", "false");
      }

      return;
    }
    if (t.dataset.aiq) {
      aiAsk(t.dataset.aiq);
      return;
    }
    if (t.dataset.venueDetail) {
      goView("venue-" + t.dataset.venueDetail);
      return;
    }
    if (t.dataset.tour) {
      handleTourClick(t.dataset.tour);
      return;
    }
    if (t.hasAttribute("data-close")) {
      closeDrawer();
      return;
    }
    const o = ui.drawerId && S.obligations.find((x) => x.id === ui.drawerId);
    if (t.hasAttribute("data-validate") && o) {
      const ok = validate(o);
      const e = o.evidence[o.evidence.length - 1];
      ui.lastResult = {
        ok,
        msg: ok
          ? `Pass: ${showVal(o, e.value)} meets the criterion.`
          : `Fail: ${showVal(o, e.value)} does not meet ${critText(o)}. The owner's "complete" is overturned, status set to Rejected, corrective action opened with a ${SLA[o.crit]}-day SLA.`,
      };
      save();
      rerender();
      renderDrawer();
      return;
    }
    if (t.hasAttribute("data-verify") && o) {
      verify(o);
      ui.lastResult = {
        ok: true,
        msg: "Verified by the compliance office. This obligation now counts fully toward assured readiness.",
      };
      save();
      rerender();
      renderDrawer();
      return;
    }
    if (t.dataset.obl) {
      openDrawer(t.dataset.obl);
      return;
    }

    if (t.dataset.goto) {
      ui.filters.venue = t.dataset.venue || "all";
      ui.filters.family = "all";
      ui.filters.state = "all";
      ui.filters.q = "";
      goView(t.dataset.goto);
      if (t.dataset.goto === "gates")
        setTimeout(() => {
          const el = document.getElementById("gate-" + t.dataset.venue);
          if (el) el.scrollIntoView({ block: "start" });
        }, 30);
      return;
    }
    if (t.dataset.gate) {
      requestGatePass(t.dataset.gate);
      return;
    }
    if (t.dataset.escalateGate) {
      escalateGateBlockers(t.dataset.escalateGate);
      return;
    }
    if (t.dataset.esc) {
      escalateIssue(t.dataset.esc);
      return;
    }
    if (t.dataset.decide) {
      decide(t.dataset.decide, Number(t.dataset.opt));
      return;
    }
    if (t.dataset.dossier) {
      ui.dossierVenue = t.dataset.dossier;
      goView("dossier");
      return;
    }
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && ui.drawerId) closeDrawer();
    if (ev.key === "Enter" && ev.target.matches("tr[data-obl]"))
      openDrawer(ev.target.dataset.obl);
  });
  document.addEventListener("change", (ev) => {
    const t = ev.target;
    if (t.id === "tourVoice") {
      setTourVoice(t.checked);
      return;
    }
    if (t.id === "tourVoiceSel") {
      setTourVoiceName(t.value);
      return;
    }
  });
}
