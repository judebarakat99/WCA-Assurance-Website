// The 3D design review's data, built from the register. The twin used to carry its own thresholds (1% wheelchair
// positions, 2,500 lux, 150 m² dressing rooms, ...). They now come from the requirement register, so a change to a
// requirement (for example one applied on the Requirement watch) changes what the design review checks.
//
// Two things live here:
//   - the design package itself (the BIM facts for Rev C and Rev D of King Salman International Stadium): these are
//     the stadium's data, not requirements;
//   - how each fact is checked: the register's criterion where it has a number, the register's text where the
//     number is written inside it (for example "105 m × 68 m"), and the design brief where the register has nothing.
//     Every check says which of the three it used.
//
// It also holds the FIFA-critical areas of the model (the zones of the heat map), the chapter layers and the site
// conditions' view (lib/domain/siteConditions), all read from the register.
//
// Pure: no storage and no UI. lib/twin/session records the results in the register and raises the alerts.
import { STATUS, evaluate, stadiumRequirements } from "@/lib/domain/assessment.mjs";
import { EXPOSURE_ORDER, findingExposure, stadiumExposure } from "@/lib/domain/exposure.mjs";
import { criterionLabel } from "@/lib/domain/fifa-catalogue.mjs";
import { FACILITY_REGISTER, MATCH_LABEL, capacityRequirement } from "@/lib/domain/facilities.mjs";
import { dueDate, evidenceLine, formatDue, mitigationAction, ownerFor } from "@/lib/domain/mitigation.mjs";
import { currentRequirement } from "@/lib/domain/requirementVersions.mjs";
import { KIND, SITE_CONDITIONS, escalationFor, isLogged, loggedOn, withLogged, loggedIds } from "@/lib/domain/siteConditions.mjs";
import { FAMILIES, familyById } from "@/lib/register/data.mjs";

export const STADIUM_ID = "king-salman-international";
const fmt = (n) => Number(n).toLocaleString("en-US");
const SYMBOL = { min: "≥", gte: "≥", gt: ">", max: "≤", lte: "≤", lt: "<", eq: "=" };

// ---------- the design package ----------
// Rev C is the package the design team submits; Rev D answers the findings. Numbers that exist only to be compared
// with a threshold are drawn relative to it (see touchline run-off): a design is drawn to its requirements.
const BIM = {
  C: {
    seats: 79180,
    pitch: [105.0, 68.0],
    pitchArea: [125, 85],
    runoffGoal: 10.0,
    bearing: 6,
    mediaSeats: 1780,
    mediaDesks: 690,
    wheelchair: { North: 238, South: 238, West: 236, East: 0 },
    gridShare: null, // set below from the lighting grid
    dressing: [168, 168],
  },
  D: {
    seats: 92760,
    pitch: [105.0, 68.0],
    pitchArea: [125, 85],
    runoffGoal: 10.0,
    bearing: 6,
    mediaSeats: 2120,
    mediaDesks: 840,
    wheelchair: { North: 238, South: 238, West: 236, East: 214 },
    dressing: [168, 168],
  },
};
// The brief's own numbers, used where the register has none for the check.
const BRIEF = { mediaSeats: 2000, mediaDesks: 800, runoff: 6.0, pitchArea: [125, 85] };

// The lighting calculation grid: 21 × 14 points over the pitch, vertical illuminance towards the main camera.
// The same formula as the twin's heat map (twinEngine.js), so the numbers shown and the colours drawn agree.
const GX = 21;
const GZ = 14;
const lux = (x, z) => {
  const nx = x / 52.5;
  const nz = z / 34;
  return 3300 - 330 * nx * nx - 230 * nz * nz + 55 * Math.sin(x * 0.13) * Math.cos(z * 0.17);
};
function gridStats(full) {
  let mn = 1e9;
  let n = 0;
  for (let j = 0; j < GX; j++) {
    const x = -52.5 + (j + 0.5) * 5;
    if (!full && x < -17.5) continue;
    for (let i = 0; i < GZ; i++) {
      mn = Math.min(mn, lux(x, -34 + (i + 0.5) * (68 / GZ)));
      n++;
    }
  }
  return { min: Math.round(mn / 10) * 10, cells: n };
}
const GC = gridStats(false);
const GD = gridStats(true);

// ---------- reading a threshold ----------
const numeric = (req) => (req && req.criterion && req.criterion.operator !== "manual" ? req.criterion : null);
const textOf = (req) => (req && req.criterion && req.criterion.description) || "";
const number = (s) => Number(String(s).replace(/,/g, ""));
const symbolOf = (c) => SYMBOL[c.operator] || "≥";

/** Pitch size written in the register text, for example "105 m × 68 m". */
function pitchFromText(text) {
  const m = /(\d+(?:\.\d+)?)\s*m\s*[×x]\s*(\d+(?:\.\d+)?)\s*m/.exec(text);
  return m ? [number(m[1]), number(m[2])] : null;
}
const bearingFromText = (text) => {
  const m = /(\d+(?:\.\d+)?)\s*degrees?/i.exec(text);
  return m ? number(m[1]) : null;
};
const verticalLuxFromText = (text) => {
  const m = /(?:more than|at least|above|>)\s*([\d,]+)\s*lux\s*vertical/i.exec(text);
  return m ? number(m[1]) : null;
};

/** The requirement a check reads, and where its threshold came from: "register", "text" (inside the register's words) or "brief". */
function source(req, got) {
  if (!req) return "brief";
  return got === "criterion" ? "register" : got === "text" ? "text" : "brief";
}

// ---------- FIFA-critical areas ----------
// Each zone is a place on the model and the requirements that belong to it, all from one chapter of the register.
// shape tells the 3D view what to draw: a ground sector with doors (arcs), a disc with a beam (spot), a frame around the
// pitch (frame), a band round the bowl (band) or a ribbon round the roof edge (ribbon). Coordinates are the model's:
// x is the pitch's long axis (the north stand is +x), z is across it (the west and main stand is -z), y is up.
export const ZONES = [
  { id: "Z01", tag: "Capacity", name: "Capacity and site plan", chapter: "01", reqs: ["STA-0003", "STA-0004", "STA-0005"],
    about: "The seats the stadium provides against its match allocation, its orientation and its layout on the site.",
    shape: { kind: "spot", p: [100, 29, 0], r: 6 }, anchor: [100, 42, 0], view: { p: [20, 64, 40], t: [100, 26, 0] } },
  { id: "Z02", tag: "Fire safety", name: "Fire and life safety", chapter: "02", reqs: ["STA-0053", "STA-0054", "STA-0056"],
    about: "Fire detection and suppression, the evacuation model and the stewards who run it, at the west gates.",
    shape: { kind: "arcs", arcs: [{ a: 270, span: 20 }], r0: 144, r1: 153, doors: 4 }, anchor: [0, 8, -149], view: { p: [70, 52, -262], t: [0, 2, -149] } },
  { id: "Z03", tag: "Medical", name: "Medical response and incident command", chapter: "02", reqs: ["STA-0058", "STA-0061"],
    about: "Medical response stations and the incident command structure that runs them on match day.",
    shape: { kind: "spot", p: [-150, 0.5, -55], r: 7 }, anchor: [-150, 9, -55], view: { p: [-262, 48, -60], t: [-150, 2, -55] } },
  { id: "Z04", tag: "Control room", name: "Control room, CCTV and access control", chapter: "02", reqs: ["STA-0050", "STA-0051", "STA-0052"],
    about: "The security control room, camera coverage and accreditation checks.",
    shape: { kind: "spot", p: [0, 40, -96], r: 5 }, anchor: [0, 52, -96], view: { p: [0, 74, -12], t: [0, 38, -96] } },
  { id: "Z05", tag: "Vehicle barriers", name: "Hostile vehicle mitigation", chapter: "02", reqs: ["STA-0060"],
    about: "Rated barriers on every vehicle approach to the outer perimeter.",
    shape: { kind: "arcs", arcs: [{ a: 0, span: 62 }], r0: 160, r1: 165.5, doors: 0 }, anchor: [163, 5, 0], view: { p: [300, 70, 0], t: [163, 2, 0] } },
  { id: "Z06", tag: "Exit gates", name: "Exit gates and emergency doors", chapter: "03", reqs: ["STA-0012", "STA-0057", "STA-0059"],
    about: "How fast the bowl empties through the exit gates and emergency doors, and the routes emergency vehicles use.",
    shape: { kind: "arcs", arcs: [{ a: 0, span: 13 }, { a: 90, span: 13 }, { a: 180, span: 13 }], r0: 144, r1: 153, doors: 3 }, anchor: [149, 8, 0], view: { p: [300, 110, 40], t: [149, 2, 0] } },
  { id: "Z07", tag: "Queues", name: "Entry queues and wayfinding", chapter: "03", reqs: ["STA-0009", "STA-0011", "STA-0013"],
    about: "Queue space outside the gates, concourse flow and the signs that guide people to their seats.",
    shape: { kind: "spot", p: [-102, 0.5, 146], r: 9 }, anchor: [-102, 9, 146], view: { p: [-190, 54, 260], t: [-102, 2, 146] } },
  { id: "Z08", tag: "Pitch", name: "Pitch, run-off and markings", chapter: "04", reqs: ["STA-0018", "STA-0019", "STA-0020"],
    about: "The field of play, its markings and levelness, and the clear area around it.",
    shape: { kind: "frame", w: 105, h: 68 }, anchor: [0, 3, 0], view: { p: [10, 140, 90], t: [0, 0, 0] } },
  { id: "Z09", tag: "Tunnel", name: "Players' tunnel and team rooms", chapter: "05", reqs: ["STA-0030", "STA-0034", "STA-0038"],
    about: "The players' tunnel, the team dressing rooms and the player medical room.",
    shape: { kind: "spot", p: [10, 2.5, -46], r: 4 }, anchor: [10, 11, -46], view: { p: [42, 30, -6], t: [10, 4, -46] } },
  { id: "Z10", tag: "Accessible", name: "Accessible seating and routes", chapter: "06", reqs: ["STA-0007", "STA-0008", "STA-0062"],
    about: "Wheelchair positions in every stand, step-free routes and the way people with disabilities leave in an emergency.",
    shape: { kind: "spot", p: [0, 17, 66], r: 6 }, anchor: [0, 27, 66], view: { p: [0, 34, -22], t: [0, 14, 62] } },
  { id: "Z11", tag: "Toilets, food", name: "Toilets, concessions and prayer rooms", chapter: "06", reqs: ["STA-0014", "STA-0015", "STA-0016"],
    about: "Toilet numbers, food service points and the prayer and family rooms on the concourse.",
    shape: { kind: "spot", p: [-92, 17, 20], r: 5 }, anchor: [-92, 27, 20], view: { p: [-14, 52, 42], t: [-92, 14, 20] } },
  { id: "Z12", tag: "Hospitality", name: "Hospitality ring and VIP arrival", chapter: "07", reqs: ["STA-0078", "STA-0079", "STA-0083"],
    about: "The ring of hospitality boxes between the tiers, VVIP lounges and the VIP arrival route.",
    shape: { kind: "band", d: 26.4, h0: 15.6, h1: 18.2 }, anchor: [0, 26, -69], view: { p: [0, 130, 150], t: [0, 16, -40] } },
  { id: "Z13", tag: "Media", name: "Media tribune and broadcast", chapter: "08", reqs: ["STA-0063", "STA-0068", "STA-0072"],
    about: "The media tribune, the main camera platform and the broadcast compound.",
    shape: { kind: "spot", p: [0, 10, -58], r: 6 }, anchor: [0, 18, -58], view: { p: [0, 30, 22], t: [0, 10, -58] } },
  { id: "Z14", tag: "Floodlights", name: "Floodlighting", chapter: "09", reqs: ["ASS-0171"],
    about: "The floodlights on the roof edge and the measurements that prove broadcast-grade light on the pitch.",
    shape: { kind: "ribbon", d0: 19.2, d1: 21.4, y: 47.6 }, anchor: [-83, 54, 0], view: { p: [-215, 140, 150], t: [-83, 46, 0] } },
  { id: "Z15", tag: "Power", name: "Primary power and standby generators", chapter: "09", reqs: ["STA-0086", "STA-0087", "ASS-0174"],
    about: "The mains supply, the standby generators and the power failure test.",
    shape: { kind: "spot", p: [-130, 0.5, -95], r: 9 }, anchor: [-130, 10, -95], view: { p: [-250, 58, -200], t: [-130, 2, -95] } },
  { id: "Z16", tag: "ICT", name: "ICT, Wi-Fi and control systems", chapter: "10", reqs: ["STA-0091", "STA-0092", "STA-0097"],
    about: "The telecom backbone and Wi-Fi, the operational systems and how they are kept apart from guest networks.",
    shape: { kind: "spot", p: [106, 34, 34], r: 4 }, anchor: [106, 44, 34], view: { p: [44, 62, 40], t: [106, 32, 34] } },
  { id: "Z17", tag: "Overlay", name: "Overlay and event facilities", chapter: "11", reqs: ["STA-0017", "ASS-0177"],
    about: "What is permanent and what is temporary on match days, and the test event that proves it works.",
    shape: { kind: "spot", p: [86, 0.5, 123], r: 12 }, anchor: [86, 9, 123], view: { p: [170, 62, 250], t: [86, 2, 123] } },
];

// One colour for each chapter of the stadium book: they outline a chapter's zones on the model and mark its layer button.
// They are this register's own colours. FIFA's department colour code is not in the sources this register was built from.
export const CHAPTER_COLOURS = {
  "01": "#9fb4ff", "02": "#ff8a7a", "03": "#ffb36b", "04": "#7fd68a", "05": "#6fe3d2", "06": "#5b8cff",
  "07": "#e2b56a", "08": "#d49cff", "09": "#f3e26b", "10": "#8de1ff", "11": "#c7c7d9",
};

const CRIT = ["Medium", "High", "Critical"];
const LEVEL_RANK = Object.fromEntries(EXPOSURE_ORDER.map((k, i) => [k, i]));

// ---------- the design ----------
/**
 * Build the design review for King Salman International Stadium from the register.
 * options.getRecords: () => the assessment records, for the exposure line on each check (optional).
 */
export function buildDesign({ getRecords } = {}) {
  const stadium = FACILITY_REGISTER.stadiums.find((s) => s.id === STADIUM_ID);
  const matchLabel = (MATCH_LABEL[stadium.highestMatch] || "").toLowerCase();

  const reqCap = capacityRequirement(stadium) || currentRequirement("STA-0004");
  const reqFop = currentRequirement("STA-0018");
  const reqRun = currentRequirement("STA-0020");
  const reqOri = currentRequirement("STA-0005");
  const reqMed = currentRequirement("STA-0072");
  const reqAcc = currentRequirement("STA-0007");
  const reqLgt = currentRequirement("ASS-0171");
  const reqDrs = currentRequirement("STA-0034");

  // thresholds
  const cap = numeric(reqCap) || { operator: "min", value: 80000, unit: "seats" };
  const pitch = pitchFromText(textOf(reqFop)) || [105, 68];
  const run = numeric(reqRun);
  const runMin = run && run.operator !== "range" ? Number(run.value) : BRIEF.runoff;
  const bearingMax = bearingFromText(textOf(reqOri)) ?? 15;
  const acc = reqAcc && reqAcc.criterion.operator === "range" ? reqAcc.criterion : { operator: "range", minimum: 0.5, maximum: 1, unit: "% of seats" };
  const vertical = verticalLuxFromText(textOf(reqLgt)) ?? 2000;
  const dress = numeric(reqDrs) || { operator: "min", value: 80, unit: "m²" };
  const lightMin = Math.floor(vertical / 100) * 100;

  // The design is drawn to the requirements: the touchline run-off sits half a metre above the minimum.
  const touch = Math.max(8.5, (run && run.operator !== "range" ? Number(run.value) : BRIEF.runoff) + 0.5);
  const lighting = { C: GC, D: GD };

  const family = (req) => {
    const f = req ? familyById(req.familyId) : null;
    return f ? `${f.id} ${f.short}` : "Design brief";
  };
  const chapterOf = family;
  const basisNote = (req, kind) => (req ? ` · Register ${req.id} (${kind})` : " · Design brief");

  const checks = [
    {
      id: "CAP-01", reqId: "STA-0004", fam: chapterOf(reqCap), crit: "Critical", basis: source(reqCap, numeric(reqCap) ? "criterion" : null),
      t: "Gross seating capacity",
      req: "The stadium provides the gross seating capacity required for its match allocation.",
      rule: `seats_gross ${symbolOf(cap)} ${fmt(cap.value)} (${matchLabel})`,
      ev: `Seat instances in 412 tier blocks · Bowl model${basisNote(reqCap, "register")}`,
      pin: [80, 22, 0], view: { p: [-30, 40, 20], t: [75, 20, 0] }, hl: "cap",
    },
    {
      id: "FOP-01", reqId: "STA-0018", fam: chapterOf(reqFop), crit: "Critical", basis: source(reqFop, pitchFromText(textOf(reqFop)) ? "text" : null),
      t: "Field of play dimensions",
      req: `The field of play measures ${pitch[0]} m by ${pitch[1]} m.`,
      rule: `length = ${pitch[0].toFixed(1)} m ∧ width = ${pitch[1].toFixed(1)} m (±0.1)`,
      ev: `Space "FOP-Pitch" boundary · Bowl model${basisNote(reqFop, "register text")}`,
      pin: [0, 1, 0], view: { p: [10, 140, 90], t: [0, 0, 0] }, hl: "fop",
    },
    {
      id: "FOP-02", reqId: "STA-0020", fam: chapterOf(reqRun), crit: "High", basis: source(reqRun, run ? "criterion" : null),
      t: "Clear run-off around the pitch",
      req: "An obstruction-free auxiliary area surrounds the field of play.",
      rule: `run-off ${run ? symbolOf(run) : "≥"} ${runMin.toFixed(1)} m ∧ pitch_area ≥ ${BRIEF.pitchArea[0]} × ${BRIEF.pitchArea[1]} m`,
      ev: `Pitch boundary to nearest obstruction · Bowl model${basisNote(reqRun, "register")}`,
      pin: [58, 1, 30], view: { p: [20, 46, 52], t: [58, 0, 14] }, hl: null,
    },
    {
      id: "ORI-01", reqId: "STA-0005", fam: chapterOf(reqOri), crit: "High", basis: source(reqOri, bearingFromText(textOf(reqOri)) != null ? "text" : null),
      t: "Pitch orientation",
      req: "The pitch runs approximately north to south to limit low sun in players’ eyes.",
      rule: `|bearing| ≤ ${bearingMax}° from true north`,
      ev: `Pitch axis vs. site true north · Bowl model${basisNote(reqOri, "register text")}`,
      pin: [30, 1, -22], view: { p: [0, 170, 24], t: [0, 0, 0] }, hl: null,
    },
    {
      id: "MED-01", reqId: "STA-0072", fam: chapterOf(reqMed), crit: "Critical", basis: "brief",
      t: "Media tribune size",
      req: "A media tribune on the main stand, centred on the halfway line, with desk positions for written press.",
      rule: `media_seats ≥ ${fmt(BRIEF.mediaSeats)} ∧ desk_positions ≥ ${fmt(BRIEF.mediaDesks)}`,
      ev: `Zone "MEDIA-TRIB" seats and desk elements · Bowl model · Design brief threshold (the register has no number for this)`,
      pin: [0, 11, -58], view: { p: [0, 30, 22], t: [0, 10, -58] }, hl: "med",
    },
    {
      id: "ACC-01", reqId: "STA-0007", fam: chapterOf(reqAcc), crit: "Critical", basis: source(reqAcc, reqAcc && reqAcc.criterion.operator === "range" ? "criterion" : null),
      t: "Wheelchair positions",
      req: "Wheelchair user positions at the share of seats the requirement sets, distributed across every stand.",
      rule: `wc_positions within ${acc.minimum}–${acc.maximum}% of seats_gross ∧ min(per stand) > 0`,
      ev: `Wheelchair family + accessibility schedule${basisNote(reqAcc, "register")}`,
      pin: [0, 19, 67], view: { p: [0, 32, -22], t: [0, 14, 62] }, hl: "acc",
    },
    {
      id: "LGT-01", reqId: "ASS-0171", fam: chapterOf(reqLgt), crit: "High", basis: source(reqLgt, verticalLuxFromText(textOf(reqLgt)) != null ? "text" : null),
      t: "Floodlight illuminance",
      req: "Broadcast-grade floodlighting across the whole field of play.",
      rule: `Ev,min > ${fmt(vertical)} lux (fixed cameras) over 100% of grid`,
      ev: `Lighting calculation grid tables, pp. 4–11${basisNote(reqLgt, "register text")}`,
      pin: [-36, 1, 0], view: { p: [-10, 88, 40], t: [-30, 0, 0] }, hl: "lgt",
    },
    {
      id: "DRS-01", reqId: "STA-0034", fam: chapterOf(reqDrs), crit: "High", basis: source(reqDrs, numeric(reqDrs) ? "criterion" : null),
      t: "Team dressing rooms",
      req: "Each team dressing room meets the minimum floor area.",
      rule: `area(DR-HOME), area(DR-AWAY) ${symbolOf(dress)} ${fmt(dress.value)} m²`,
      ev: `Spaces "DR-HOME", "DR-AWAY" net areas · Bowl model${basisNote(reqDrs, "register")}`,
      pin: [24, 4, -56], view: { p: [40, 30, -18], t: [22, 4, -56] }, hl: null,
    },
    {
      id: "THR-01", reqId: null, fam: "Design brief", crit: "Medium", basis: "brief",
      t: "Green roof shading specification",
      req: "The green roof and walls provide solar shading to spectator seating, with build-up and shading properties declared.",
      rule: "roof.buildup ≠ null ∧ roof.shading_factor declared",
      ev: "Roof element KSIS-ROOF-01 property sets · Design brief (not a FIFA requirement)",
      pin: [-30, 49, 92], view: { p: [-70, 160, 250], t: [-15, 40, 70] }, hl: "thr",
    },
  ];

  // Each check carries the chapter of its register requirement, and its criticality can go up: it starts at the level the
  // design brief gives it and rises when site conditions are logged against its requirement. Everything that reads
  // check.crit (the gate, the weights, the due dates, the alerts) sees the raised level.
  for (const c of checks) {
    const base = c.crit;
    const req = c.reqId ? currentRequirement(c.reqId) : null;
    c.chapter = req ? req.familyId : null;
    delete c.crit;
    Object.defineProperty(c, "baseCrit", { value: base, enumerable: false });
    Object.defineProperty(c, "crit", {
      enumerable: true,
      get() {
        const e = c.reqId ? escalationFor(STADIUM_ID, c.reqId) : { steps: 0 };
        return CRIT[Math.min(CRIT.length - 1, CRIT.indexOf(base) + e.steps)];
      },
    });
  }

  // ---------- evaluating each check for a revision ----------
  const wcTotal = (rev) => Object.values(BIM[rev].wheelchair).reduce((a, b) => a + b, 0);
  const fewest = (rev) => Math.min(...Object.values(BIM[rev].wheelchair));
  const share = (rev) => (wcTotal(rev) / BIM[rev].seats) * 100;
  const FILE = {
    C: { bowl: "KSIS-ARC-Bowl-RevC.ifc", acc: "KSIS-ACC-Schedule-RevC.xlsx", lgt: "KSIS-LGT-Calc-RevC.pdf" },
    D: { bowl: "KSIS-ARC-Bowl-RevD.ifc", acc: "KSIS-ACC-Schedule-RevD.xlsx", lgt: "KSIS-LGT-Calc-RevD.pdf" },
  };

  function evaluateRev(rev) {
    const b = BIM[rev];
    const out = {};
    const rec = {};
    const put = (id, s, v, why, record) => {
      out[id] = { s, v, why };
      if (record) rec[id] = { ...record, verdict: s };
    };

    // CAP-01: the register's capacity rule for the stadium's match category
    {
      const s = evaluate(cap, b.seats) === "pass" ? "pass" : "fail";
      const why =
        s === "fail"
          ? `Short by ${fmt(cap.value - b.seats)} seats for an ${matchLabel} venue. The north upper tier is deferred in Rev C (phasing note PH-07).`
          : `North upper tier brought into Rev D (+${fmt(BIM.D.seats - BIM.C.seats)} seats). Matches the published ${fmt(stadium.grossCapacity)} capacity.`;
      put("CAP-01", s, `${fmt(b.seats)} seats`, why, { mode: "register", value: b.seats, unit: "seats", file: FILE[rev].bowl });
    }
    // FOP-01: both sides of the pitch against the size in the register text
    {
      const ok = Math.abs(b.pitch[0] - pitch[0]) <= 0.1 && Math.abs(b.pitch[1] - pitch[1]) <= 0.1;
      put("FOP-01", ok ? "pass" : "fail", `${b.pitch[0].toFixed(1)} × ${b.pitch[1].toFixed(1)} m`, ok ? "Pitch boundary matches the required dimensions." : `Pitch is ${b.pitch[0]} × ${b.pitch[1]} m; ${pitch[0]} × ${pitch[1]} m is required.`, {
        mode: "verdict", value: b.pitch[0], unit: "m", file: FILE[rev].bowl,
      });
    }
    // FOP-02: the smaller of the two run-offs against the register's minimum, and the pitch area from the brief
    {
      const lowest = Math.min(b.runoffGoal, touch);
      const areaOk = b.pitchArea[0] >= BRIEF.pitchArea[0] && b.pitchArea[1] >= BRIEF.pitchArea[1];
      const runOk = run && run.operator !== "range" ? evaluate(run, lowest) === "pass" : lowest >= runMin;
      const ok = areaOk && runOk;
      put("FOP-02", ok ? "pass" : "fail", `${b.pitchArea[0]} × ${b.pitchArea[1]} m · ${lowest.toFixed(1)} m`, ok ? `Run-off of ${lowest.toFixed(1)} m meets the minimum of ${runMin.toFixed(1)} m and the pitch area matches the brief.` : `Run-off of ${lowest.toFixed(1)} m is below the ${runMin.toFixed(1)} m minimum.`, {
        mode: run && run.operator !== "range" ? "register" : "verdict", value: lowest, unit: "m", file: FILE[rev].bowl,
      });
    }
    // ORI-01
    {
      const ok = Math.abs(b.bearing) <= bearingMax;
      put("ORI-01", ok ? "pass" : "fail", `${String(b.bearing).padStart(3, "0")}°`, ok ? `Within ${bearingMax}° of north–south.` : `${b.bearing}° is more than ${bearingMax}° from north–south.`, {
        mode: "verdict", value: b.bearing, unit: "degrees", file: FILE[rev].bowl,
      });
    }
    // MED-01: the brief's numbers
    {
      const ok = b.mediaSeats >= BRIEF.mediaSeats && b.mediaDesks >= BRIEF.mediaDesks;
      put("MED-01", ok ? "pass" : "fail", `${fmt(b.mediaSeats)} seats · ${fmt(b.mediaDesks)} desks`, ok ? "Tribune widened to 25 m on the halfway line." : `Below ${fmt(BRIEF.mediaSeats)} seats and ${fmt(BRIEF.mediaDesks)} desk positions for a final venue. Tribune spans 20 m of the West stand.`, {
        mode: "verdict", value: b.mediaSeats, unit: "seats", file: FILE[rev].bowl,
      });
    }
    // ACC-01: the register's share of seats, and a position in every stand
    {
      const sh = share(rev);
      const inRange = sh >= acc.minimum && sh <= acc.maximum;
      const every = fewest(rev) > 0;
      const ok = inRange && every;
      const eastText = b.wheelchair.East === 0 ? "East 0" : `East ${b.wheelchair.East}`;
      put(
        "ACC-01",
        ok ? "pass" : "fail",
        `${fmt(wcTotal(rev))} · ${sh.toFixed(2)}% · ${eastText}`,
        ok
          ? "All four stands now provide positions, and the share is inside the range."
          : `${fmt(wcTotal(rev))} positions (${sh.toFixed(2)}% of seats) is inside the ${acc.minimum}% to ${acc.maximum}% range, but the East stand has none. Positions are required in every stand.`,
        { mode: "verdict", value: fewest(rev), unit: "positions in the smallest stand", file: FILE[rev].acc },
      );
    }
    // LGT-01: the calculation grid, against the register's vertical illuminance
    {
      const g = lighting[rev];
      const full = g.cells === GX * GZ;
      if (!full) {
        put("LGT-01", "evid", `${Math.round((g.cells / (GX * GZ)) * 100)}% of grid`, `The calc covers the north two-thirds only (Ev,min ${fmt(g.min)} lux there). The south third cannot be assured, so the engine asks instead of guessing.`, {
          mode: "verdict", value: "", unit: "lux", file: FILE[rev].lgt,
        });
      } else {
        const ok = g.min > vertical;
        put("LGT-01", ok ? "pass" : "fail", `Ev,min ${fmt(g.min)} lux over the full grid`, ok ? `Full-grid calc submitted. Every grid point is above ${fmt(vertical)} lux.` : `Ev,min of ${fmt(g.min)} lux does not exceed ${fmt(vertical)} lux.`, {
          mode: "verdict", value: g.min, unit: "lux", file: FILE[rev].lgt,
        });
      }
    }
    // DRS-01: the smaller dressing room against the register's minimum area
    {
      const smallest = Math.min(...b.dressing);
      const ok = evaluate(dress, smallest) === "pass";
      put("DRS-01", ok ? "pass" : "fail", `${b.dressing.map((a) => `${a} m²`).join(" · ")}`, ok ? `Both rooms meet the minimum of ${fmt(dress.value)} m².` : `A room of ${smallest} m² is below the ${fmt(dress.value)} m² minimum.`, {
        mode: "register", value: smallest, unit: "m²", file: FILE[rev].bowl,
      });
    }
    // THR-01: a design brief item with no register requirement
    put("THR-01", "evid", "no material data", "The green roof is a generic object with no planting build-up or shading properties. Asked, not failed.", null);
    return { out, rec };
  }
  const C = evaluateRev("C");
  const D = evaluateRev("D");
  const res = { C: C.out, D: { ...C.out, ...D.out } };
  // Rev D re-checks only what changed (the same four checks); the rest keep their Rev C result.
  for (const id of ["FOP-01", "FOP-02", "ORI-01", "DRS-01", "THR-01"]) res.D[id] = C.out[id];
  const records = { C: C.rec, D: { ...D.rec } };
  for (const id of ["FOP-01", "FOP-02", "ORI-01", "DRS-01"]) delete records.D[id];

  // ---------- the facts the engine reads ----------
  const g = BIM.C;
  const facts = [
    ["Gross seats", fmt(g.seats), "1,046 tier blocks · Bowl model Rev C"],
    ["North upper tier", "deferred", "Phasing note PH-07, not modelled in Rev C", true],
    ["Field of play", `${g.pitch[0].toFixed(1)} × ${g.pitch[1].toFixed(1)} m`, "Space FOP-Pitch · hybrid grass"],
    ["Pitch area, run-off", `${g.pitchArea[0]} × ${g.pitchArea[1]} m · ${g.runoffGoal.toFixed(1)} m / ${touch.toFixed(1)} m`, "Pitch area boundary to first obstruction"],
    ["Pitch bearing", `${String(g.bearing).padStart(3, "0")}° from true north`, "Site true north vs pitch axis"],
    ["Media tribune", `${fmt(g.mediaSeats)} seats · ${g.mediaDesks} desks`, "Zone MEDIA-TRIB, West stand"],
    ["Wheelchair positions", `${wcTotal("C")} (East stand: 0)`, "Accessibility schedule Rev C"],
    ["Lighting calc coverage", `${GC.cells} of ${GX * GZ} grid points`, "Lighting calc PDF Rev C, south third missing", true],
    ["Dressing rooms", `${g.dressing[0]} m² · ${g.dressing[1]} m²`, "Spaces DR-HOME, DR-AWAY"],
    ["Hospitality", "Royal suite 150 · 120 suites · 2,500 VIP", "Hospitality zones, matches public brief"],
    ["Green roof build-up", "no material data", "Element KSIS-ROOF-01, generic object", true],
  ];

  // ---------- the findings sent to the design team ----------
  const by = Object.fromEntries(checks.map((c) => [c.id, c]));
  const items = [
    { id: "NCR-031", kind: "ncr", chk: "CAP-01", to: "Design team · Design lead", msg: `Gross capacity in Rev C is ${fmt(BIM.C.seats)} against ${fmt(cap.value)} required for the ${matchLabel === "opening and final" ? "opening match and final" : matchLabel}. Bring the deferred north upper tier into the design.` },
    { id: "NCR-032", kind: "ncr", chk: "MED-01", to: "Design team · Design lead", msg: `Media tribune provides ${fmt(BIM.C.mediaSeats)} seats and ${BIM.C.mediaDesks} desks. The design brief requires ${fmt(BRIEF.mediaSeats)} seats and ${BRIEF.mediaDesks} desks, centred on the halfway line.` },
    { id: "NCR-033", kind: "ncr", chk: "ACC-01", to: "Design team · Access consultant", msg: `${wcTotal("C")} wheelchair positions (${share("C").toFixed(2)}% of seats). The East stand has none. Provide positions in every stand, keeping the share between ${acc.minimum}% and ${acc.maximum}%.` },
    { id: "CLR-014", kind: "clr", chk: "LGT-01", to: "Design team · Lighting consultant", msg: "Lighting calc covers the north two-thirds of the pitch only. Please submit the full-grid calculation." },
    { id: "CLR-015", kind: "clr", chk: "THR-01", to: "Design team · Roof engineer", msg: "Green roof KSIS-ROOF-01 has no build-up or shading properties. Please confirm the planting build-up and shading factor." },
  ];

  // ---------- FIFA-critical areas, read live from the register ----------
  const levelOf = (reqId) => {
    const row = stadiumRequirements(stadium).find((r) => r.requirement.id === reqId);
    if (!row || row.applicability.value === "not-applicable") return null;
    const record = getRecords ? getRecords()[row.key] : null;
    return findingExposure(stadium, row, record).level;
  };

  /** Every zone with its worst exposure and the findings behind it. */
  function zoneStatus() {
    const records = getRecords ? getRecords() : {};
    const found = new Map(stadiumExposure(stadium, records).findings.map((f) => [f.row.requirement.id, f]));
    return ZONES.map((z) => {
      const findings = z.reqs
        .map((id) => found.get(id))
        .filter(Boolean)
        .map((f) => {
          const req = f.row.requirement;
          const status = f.record ? (f.record.partial ? "Partially compliant" : STATUS[f.record.status] || f.record.status) : "Not assessed";
          return {
            id: req.id,
            title: req.title,
            status,
            level: f.level,
            reason: f.reason,
            escalated: f.escalated || null,
            action: mitigationAction(f),
            owner: ownerFor(STADIUM_ID, req),
            due: f.level === "controlled" ? "" : formatDue(dueDate(f.level)),
            required: req.criterion.operator === "manual" ? req.criterion.description : criterionLabel(req.criterion),
            evidence: evidenceLine(f.record),
          };
        })
        .sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || a.id.localeCompare(b.id));
      const counts = Object.fromEntries(EXPOSURE_ORDER.map((k) => [k, findings.filter((f) => f.level === k).length]));
      const level = findings.length ? findings[0].level : "controlled";
      return { id: z.id, level, counts, open: findings.filter((f) => f.level !== "controlled").length, escalated: findings.some((f) => f.escalated && f.escalated.from !== f.escalated.to), findings };
    });
  }

  /** The chapters of the stadium book that apply to stadiums, with their colour and how many zones each holds. */
  const chapters = FAMILIES.filter((f) => f.forStadiums).map((f) => ({
    id: f.id,
    name: f.name,
    short: f.short,
    color: CHAPTER_COLOURS[f.id] || "#c7c7d9",
    zones: ZONES.filter((z) => z.chapter === f.id).length,
  }));

  /** The site conditions with what each would do (or did) to the exposure of the requirements it touches. */
  function siteList() {
    const logged = loggedIds();
    return SITE_CONDITIONS.filter((c) => c.stadiumId === STADIUM_ID).map((c) => {
      const on = isLogged(c.id);
      const others = logged.filter((id) => id !== c.id);
      const effects = c.effects.map((e) => {
        const req = currentRequirement(e.requirementId);
        const now = levelOf(e.requirementId);
        const without = on ? withLogged(others, () => levelOf(e.requirementId)) : now;
        const withIt = on ? now : withLogged([...logged, c.id], () => levelOf(e.requirementId));
        return { requirementId: e.requirementId, title: req ? req.title : e.requirementId, steps: e.steps, because: e.because, from: without, to: withIt, zone: (ZONES.find((z) => z.reqs.includes(e.requirementId)) || {}).tag || "" };
      });
      return { id: c.id, kind: c.kind, kindLabel: KIND[c.kind].label, kindTone: KIND[c.kind].tone, title: c.title, source: c.source, raised: c.raised, detail: c.detail, logged: on, loggedOn: loggedOn(c.id), effects };
    });
  }

  /** How a check's criticality has been raised, or null when it has not: { from, to, reasons }. */
  function escalation(id) {
    const c = by[id];
    if (!c || !c.reqId) return null;
    const e = escalationFor(STADIUM_ID, c.reqId);
    return e.steps && c.crit !== c.baseCrit ? { from: c.baseCrit, to: c.crit, reasons: e.reasons } : null;
  }

  /** The mitigation exposure of a check as the rest of the site sees it (empty until the register has a record for it). */
  function exposureLine(id) {
    const c = by[id];
    if (!c || !c.reqId || !getRecords) return "";
    const row = stadiumRequirements(stadium).find((r) => r.requirement.id === c.reqId);
    if (!row) return "";
    const record = getRecords()[row.key];
    if (!record) return "";
    const f = findingExposure(stadium, row, record);
    const label = f.level[0].toUpperCase() + f.level.slice(1);
    return `${label} · ${f.reason}`;
  }

  return {
    stadiumId: STADIUM_ID,
    stadium,
    checks,
    zones: ZONES,
    chapters,
    zoneStatus,
    site: { list: siteList },
    levelOf,
    escalation,
    facts,
    res,
    items,
    records,
    lightMin: Math.floor(vertical / 100) * 100,
    exposureLine,
    check: (id) => by[id] || null,
    requirementOf: (id) => {
      const c = by[id];
      if (!c || !c.reqId) return null;
      return c.reqId === "STA-0004" ? reqCap : currentRequirement(c.reqId);
    },
    ownerOf: (id) => {
      const r = by[id] && by[id].reqId ? (by[id].reqId === "STA-0004" ? reqCap : currentRequirement(by[id].reqId)) : null;
      return r ? ownerFor(STADIUM_ID, r) : null;
    },
    thresholds: { cap, pitch, runMin, bearingMax, acc, vertical, dress, brief: BRIEF, lightMin },
    criterionText: (id) => {
      const r = by[id] && by[id].reqId ? currentRequirement(by[id].reqId) : null;
      return r ? (numeric(r) ? criterionLabel(r.criterion) : textOf(r)) : "";
    },
  };
}
