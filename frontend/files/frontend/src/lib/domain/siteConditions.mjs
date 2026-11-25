// Site conditions: things that happen on site or in coordination that make a requirement more urgent than its FIFA
// criticality alone says. A requirement starts at the exposure its status gives it (lib/domain/exposure.mjs). When a
// site condition is logged against it, that exposure goes up one or more steps, and the finding says why.
//
// The conditions below are King Salman International Stadium's. They are the working data for the demonstration: the
// dates, sources and effects are assumptions, written to read like the contractor reports, clash reports and
// authority reviews they stand for. Replace them with the programme's real ones (or load them from a file) when they
// exist. Nothing here is a FIFA requirement.
//
// A condition is "logged" when a person records it (on the 3D view's Critical areas tab). Logged conditions are kept in
// the browser and cleared by Reset demo. This module is pure data and local storage: it imports nothing else from the
// app, so the exposure logic can read it without a cycle.
export const SITE_KEY = "wca-site-conditions-v1";
export const STADIUM = "king-salman-international";

export const KIND = {
  delay: { label: "Delay", tone: "warn" },
  miscoordination: { label: "Design miscoordination", tone: "bad" },
  inspection: { label: "Authority review", tone: "info" },
};

/** effects: for each requirement, how many steps the exposure goes up and the reason to show beside it. */
export const SITE_CONDITIONS = [
  {
    id: "SC-01",
    stadiumId: STADIUM,
    kind: "delay",
    raised: "2026-11-18",
    title: "North upper tier steel is nine weeks late",
    source: "Contractor progress report 14",
    detail: "Structural steel for the north upper tier is nine weeks behind plan, so the seats that close the capacity gap arrive late.",
    effects: [
      { requirementId: "STA-0004", steps: 1, because: "the north upper tier steel is nine weeks behind plan, so the seats that meet the capacity allocation arrive late" },
      { requirementId: "STA-0003", steps: 1, because: "the seat count cannot be reconciled until the north upper tier is built" },
    ],
  },
  {
    id: "SC-02",
    stadiumId: STADIUM,
    kind: "miscoordination",
    raised: "2026-11-14",
    title: "East stand wheelchair platforms clash with the egress stair core",
    source: "Clash detection report CD-212",
    detail: "The accessible platforms added to the East stand overlap the stair core that serves the east exit gates. One of the two has to move.",
    effects: [
      { requirementId: "STA-0007", steps: 1, because: "the East stand platforms clash with the egress stair core and need redesign" },
      { requirementId: "STA-0012", steps: 1, because: "the clash narrows the stair that discharges the east stand to the exit gates" },
    ],
  },
  {
    id: "SC-03",
    stadiumId: STADIUM,
    kind: "delay",
    raised: "2026-11-20",
    title: "Standby generators now arrive in the third quarter of 2028",
    source: "Procurement update, 20 November 2026",
    detail: "The supplier has moved the standby generators to the third quarter of 2028, which is inside the commissioning window.",
    effects: [
      { requirementId: "STA-0086", steps: 1, because: "the standby generators slipped into the commissioning window, so the power supply cannot be proven in time" },
      { requirementId: "STA-0087", steps: 1, because: "the standby generators arrive in the third quarter of 2028" },
      { requirementId: "ASS-0171", steps: 1, because: "the permanent power the floodlight measurements need arrives late" },
    ],
  },
  {
    id: "SC-04",
    stadiumId: STADIUM,
    kind: "inspection",
    raised: "2026-11-21",
    title: "Civil defence review: south emergency doors are narrower than modelled",
    source: "Civil defence review note",
    detail: "Three emergency doors on the south concourse are narrower than the evacuation model assumes, so the modelled exit time does not hold.",
    effects: [
      { requirementId: "STA-0056", steps: 1, because: "the civil defence review found the south emergency doors narrower than modelled" },
      { requirementId: "STA-0012", steps: 1, because: "the south emergency doors are narrower than the exit discharge model assumes" },
      { requirementId: "STA-0059", steps: 1, because: "the south gates will need closer crowd flow monitoring" },
    ],
  },
];

let logged = null; // { [id]: loggedOn (ISO date) }

function load() {
  if (logged) return logged;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(SITE_KEY) : null;
    const data = raw ? JSON.parse(raw) : null;
    logged = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch {
    logged = {};
  }
  return logged;
}
function save() {
  try {
    localStorage.setItem(SITE_KEY, JSON.stringify(logged));
  } catch {
    // Private mode or full storage: keep working for this page load.
  }
}

export const conditionById = (id) => SITE_CONDITIONS.find((c) => c.id === id) || null;
export const isLogged = (id) => Object.prototype.hasOwnProperty.call(load(), id);
export const loggedOn = (id) => load()[id] || null;
export const loggedIds = () => Object.keys(load());

/** Record a condition. Returns false when the id is unknown or already logged. */
export function logCondition(id, on = new Date()) {
  if (!conditionById(id) || isLogged(id)) return false;
  load()[id] = new Date(on).toISOString().slice(0, 10);
  save();
  return true;
}

/** Take a logged condition back. Returns false when it was not logged. */
export function withdrawCondition(id) {
  if (!isLogged(id)) return false;
  delete load()[id];
  save();
  return true;
}

/** Remove every logged condition (Reset demo). */
export function clearSiteConditions() {
  logged = {};
  save();
}

/** Run something as if exactly these conditions were logged, then put things back. For "what if" previews. */
export function withLogged(ids, fn) {
  const keep = load();
  logged = Object.fromEntries(ids.map((id) => [id, keep[id] || "preview"]));
  try {
    return fn();
  } finally {
    logged = keep;
  }
}

/**
 * How far the logged conditions push one requirement's exposure up at one stadium:
 * { steps, reasons: [{ id, kind, title, source, raised, because }] }.
 */
export function escalationFor(stadiumId, requirementId) {
  const reasons = [];
  let steps = 0;
  for (const c of SITE_CONDITIONS) {
    if (c.stadiumId !== stadiumId || !isLogged(c.id)) continue;
    for (const e of c.effects) {
      if (e.requirementId !== requirementId) continue;
      steps += e.steps;
      reasons.push({ id: c.id, kind: c.kind, title: c.title, source: c.source, raised: c.raised, because: e.because });
    }
  }
  return { steps, reasons };
}
