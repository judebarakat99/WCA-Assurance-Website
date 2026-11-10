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
import { viewTower, intakeCard } from "@/legacy/views/tower";
import { viewReadiness } from "@/legacy/views/readiness";
import {
  viewRequirements,
  paintIntake,
  intakeRun,
  intakeAdd,
  decoAdd,
} from "@/legacy/views/requirements";
import { viewCompliance } from "@/legacy/views/compliance";
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
import { viewOverview, ovSelect } from "@/legacy/views/overview";

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
  const view = /^venue-/.test(key) ? "venue" : key;
  if (LEGACY_VIEWS.has(view)) {
    current.view = view;
    current.param = /^venue-/.test(key) ? key.slice(6) : null;
    renderLegacy();
  } else {
    current.view = null;
  }
  if (!tour.active) window.scrollTo(0, 0);
  if (routerPush) routerPush(pathFor(h), { scroll: false });
}

// Views still rendered from HTML strings. "twin" is handled below.
const VIEW_FNS = {
  overview: viewOverview,
  readiness: viewReadiness,
  tower: viewTower,
  requirements: viewRequirements,
  compliance: viewCompliance,
};
const LEGACY_VIEWS = new Set([...Object.keys(VIEW_FNS), "twin"]);

function renderLegacy() {
  const v = document.getElementById("view");
  if (!v || !S || !LEGACY_VIEWS.has(current.view)) {
    applyHL(false);
    return;
  }
  invalidateForecasts();
  const today = $("#today");
  if (today) today.textContent = fmtD(S.today);
  if (current.view === "twin") {
    v.innerHTML = `<h2>Design intake · King Salman International Stadium</h2><p class="lead">Before anything is built, the design team's model goes in and compliance checks come out. This is the Riyadh venue for the 2034 opening match and final, beside King Abdulaziz Park in north Riyadh. The 3D massing follows Populous's published concept: a circular, segmented form like a seed cracking the earth, green walls and roof, and a ring of hospitality boxes between two tiers. Proportions are approximate. The submissions and findings are simulated, and thresholds are illustrative.</p>`;
    if (window.WNSTwin) window.WNSTwin.mount(v);
    else
      v.insertAdjacentHTML(
        "beforeend",
        `<p class="muted">Loading the 3D design engine…</p>`,
      );
    applyHL(false);
    return;
  }
  v.innerHTML = VIEW_FNS[current.view]();
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
      onChange: () => {
        const el = document.getElementById("intakeCard");
        if (el) el.outerHTML = intakeCard();
      },
    });
    if (current.view === "twin" || current.view === "tower") renderLegacy();
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

// Called by legacy/AppView when a page still rendered here mounts.
export function mountView(viewKey, param) {
  bootRuntime();
  current.view = viewKey;
  current.param = param || null;
  renderLegacy();
  renderDrawer();
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
      "button,[data-obl],[data-close],[data-ai-close],#evDrop",
    );

    if (!t) return;
    if (t.id === "evDrop") {
      if (ev.target.id !== "evUpFile") {
        const f = document.getElementById("evUpFile");
        if (f) f.click();
      }
      return;
    }
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
    if (t.dataset.ovVenue) {
      ovSelect(t.dataset.ovVenue);
      rerender();
      return;
    }
    if (t.hasAttribute("data-ov-clear")) {
      ovSelect(null);
      rerender();
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
    if (t.id === "evProcess") {
      intakeRun();
      return;
    }
    if (t.id === "evAddBtn") {
      intakeAdd();
      return;
    }
    if (t.id === "evIntakeReset") {
      ui.intake.step = -1;
      ui.intake.running = false;
      ui.intake.result = null;
      ui.intake.added = false;
      ui.intake.fileName = "";
      paintIntake();
      return;
    }
    if (t.dataset.tour) {
      handleTourClick(t.dataset.tour);
      return;
    }
    if (t.id === "tourStart") {
      startTour();
      return;
    }
    if (t.id === "execStart") {
      startTour(EXEC);
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

    if (t.dataset.compAuthority) {
      ui.compliance.authority =
        ui.compliance.authority === t.dataset.compAuthority
          ? "all"
          : t.dataset.compAuthority;
      rerender();
      return;
    }

    if (t.dataset.compFamily) {
      ui.compliance.family = t.dataset.compFamily;
      ui.compliance.venue = null;
      rerender();
      window.scrollTo(0, 0);
      return;
    }

    if (t.dataset.compVenue) {
      ui.compliance.venue = t.dataset.compVenue;
      rerender();
      window.scrollTo(0, 0);
      return;
    }

    if (t.hasAttribute("data-comp-back")) {
      ui.compliance.family = null;
      ui.compliance.venue = null;
      rerender();
      window.scrollTo(0, 0);
      return;
    }

    if (t.dataset.complianceIntake) {
      const target = t.dataset.complianceIntake;

      goView("requirements");

      setTimeout(() => {
        const el = document.getElementById(
          target === "evidence" ? "evIntake" : "reqIntake",
        );

        if (el) {
          el.scrollIntoView({
            block: "start",
            behavior: "smooth",
          });
        }
      }, 60);

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
    if (t.dataset.unrecover) {
      S.scn.recovery = S.scn.recovery.filter((x) => x !== t.dataset.unrecover);
      save();
      rerender();
      return;
    }
    if (t.id === "scReset") {
      S.scn = { prod: 1, fifa: false, recovery: [] };
      save();
      rerender();
      return;
    }
    if (t.dataset.dossier) {
      ui.dossierVenue = t.dataset.dossier;
      goView("dossier");
      return;
    }
    if (t.dataset.demo) {
      const d = t.dataset.demo;
      if (d === "green") {
        openDrawer("JED-LGT-01");
      }
      if (d === "gate") {
        goView("gates");
        setTimeout(() => {
          const el = document.getElementById("gate-JED");
          if (el) el.scrollIntoView({ block: "start" });
        }, 30);
      }
      if (d === "camp") {
        openDrawer("TBC-R3-TBC-03");
      }
      if (d === "change") {
        ui.selChange = "lux";
        goView("change");
      }
      if (d === "dossier") {
        ui.dossierVenue = "KHO";
        goView("dossier");
      }
      return;
    }
    if (t.id === "advance") {
      advance();
      return;
    }
    if (t.id === "reset") {
      if (t.dataset.confirm) {
        resetS();
        closeDrawer();
        window.WNSTwin && window.WNSTwin.reset();
        ui.filters = { venue: "all", family: "all", state: "all", q: "" };
        rerender();
        toast("Sample data restored.");
      } else {
        t.dataset.confirm = "1";
        t.textContent = "Click again to reset";
        t.classList.add("danger");
        setTimeout(() => {
          delete t.dataset.confirm;
          t.textContent = "Reset demo";
          t.classList.remove("danger");
        }, 3000);
      }
      return;
    }
    if (t.id === "applyChange") {
      applyChange();
      return;
    }
    if (t.id === "decoRun") {
      ui.decoInput = $("#decoIn").value;
      ui.decoOut = decompose(ui.decoInput);
      rerender();
      return;
    }
    if (t.id === "decoSample") {
      ui.decoInput = SAMPLE_CLAUSE;
      ui.decoOut = null;
      rerender();
      return;
    }
    if (t.id === "decoAdd") {
      decoAdd();
      return;
    }
  });
  document.addEventListener("mousemove", (ev) => {
    const tip = document.querySelector(".fc-tip");
    if (!tip) return;
    const h = ev.target.closest && ev.target.closest(".fc-chart [data-tip]");
    if (!h) {
      tip.hidden = true;
      return;
    }
    const w = tip.parentElement.getBoundingClientRect();
    tip.innerHTML = h.dataset.tip;
    tip.hidden = false;
    const x = Math.min(ev.clientX - w.left + 14, w.width - 290),
      y = ev.clientY - w.top + 14;
    tip.style.left = Math.max(0, x) + "px";
    tip.style.top = y + "px";
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && ui.drawerId) closeDrawer();
    if (ev.key === "Enter" && ev.target.matches("tr[data-obl]"))
      openDrawer(ev.target.dataset.obl);
    if ((ev.key === "Enter" || ev.key === " ") && ev.target.id === "evDrop") {
      ev.preventDefault();
      const f = document.getElementById("evUpFile");
      if (f) f.click();
    }
  });
  document.addEventListener("dragover", (ev) => {
    const z = ev.target.closest && ev.target.closest("#evDrop");
    if (z) {
      ev.preventDefault();
      z.classList.add("drag");
    }
  });
  document.addEventListener("dragleave", (ev) => {
    const z = ev.target.closest && ev.target.closest("#evDrop");
    if (z) z.classList.remove("drag");
  });
  document.addEventListener("drop", (ev) => {
    const z = ev.target.closest && ev.target.closest("#evDrop");
    if (!z) return;
    ev.preventDefault();
    z.classList.remove("drag");
    const f =
      ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
    if (f) {
      ui.intake.fileName = f.name;
      ui.intake.step = -1;
      ui.intake.running = false;
      ui.intake.result = null;
      ui.intake.added = false;
      paintIntake();
    }
  });
  document.addEventListener("change", (ev) => {
    const t = ev.target;
    if (t.id === "chSel") {
      ui.selChange = t.value;
      rerender();
    }
    if (t.id === "scProd") {
      S.scn.prod = Number(t.value);
      save();
      rerender();
    }
    if (t.id === "scFifa") {
      S.scn.fifa = t.checked;
      save();
      rerender();
    }
    if (t.id === "decoV") {
      ui.decoVenue = t.value;
    }
    if (t.id === "evVenueSel") {
      ui.intake.venue = t.value;
      ui.intake.target = "";
      ui.intake.step = -1;
      ui.intake.running = false;
      ui.intake.result = null;
      ui.intake.added = false;
      paintIntake();
    }
    if (t.id === "evTargetSel") {
      ui.intake.target = t.value;
      ui.intake.step = -1;
      ui.intake.running = false;
      ui.intake.result = null;
      ui.intake.added = false;
      paintIntake();
    }
    if (t.id === "evTypeSel") {
      ui.intake.etype = Number(t.value);
    }
    if (t.id === "evUpFile") {
      const f = t.files && t.files[0];
      if (f) {
        ui.intake.fileName = f.name;
        ui.intake.step = -1;
        ui.intake.running = false;
        ui.intake.result = null;
        ui.intake.added = false;
        paintIntake();
      }
    }
    if (t.id === "tourVoice") {
      setTourVoice(t.checked);
      return;
    }
    if (t.id === "tourVoiceSel") {
      setTourVoiceName(t.value);
      return;
    }
    if (t.dataset.keep !== undefined && ui.decoOut) {
      ui.decoOut[Number(t.dataset.keep)].keep = t.checked;
    }
  });
  document.addEventListener("input", (ev) => {
    if (ev.target.id === "decoIn") {
      ui.decoInput = ev.target.value;
    }
  });
}
