// Nabd answers from the programme data in this browser: the compliance register (families, requirements and
// each stadium's status), the review queue and requirement changes. Used when the assistant service does not
// answer (see lib/assistant/chat.js). Every figure comes from the same modules the pages use, so answers
// always agree with what is on screen.
import { stadiumAssurance } from "@/lib/domain/cityAssurance.mjs";
import { criterionLabel } from "@/lib/domain/fifa-catalogue.mjs";
import { FACILITY_REGISTER, MATCH_LABEL, STATUS_LABEL } from "@/lib/domain/facilities.mjs";
import { EXPOSURE, EXPOSURE_ORDER, nextGate, portfolio, schedulePosition, stadiumExposure } from "@/lib/domain/exposure.mjs";
import { dueDate, formatDue, mitigationAction, ownerFor } from "@/lib/domain/mitigation.mjs";
import { queueCounts, reviewQueue } from "@/lib/domain/reviewQueue.mjs";
import { OUTCOME_LABEL, changeImpact } from "@/lib/domain/requirementChange.mjs";
import { CHANGE_SCENARIOS, appliedChanges, currentRequirements, scenarioById } from "@/lib/domain/requirementVersions.mjs";
import { stadiumRequirements } from "@/lib/domain/assessment.mjs";
import { FAMILIES } from "@/lib/register/data.mjs";
import { allAlerts } from "@/lib/store/alerts";
import { getAssessments } from "@/lib/store/assessments";

// ---------- small helpers ----------
const pct = (x) => Math.round(x * 100);
const fmtN = (n) => Number(n).toLocaleString("en-US");
const bullets = (lines) => lines.map((l) => `• ${l}`).join("\n");
const plural = (n, one, many = `${one}s`) => `${fmtN(n)} ${n === 1 ? one : many}`;
const label = (r) => criterionLabel(r.criterion);

const STATUS_TEXT = {
  compliant: "Compliant",
  "non-compliant": "Non-compliant",
  "evidence-submitted": "Evidence submitted",
  declared: "Declared",
  unassessed: "Not assessed",
};
const statusOf = (record) =>
  record?.partial ? "Partially compliant" : STATUS_TEXT[record?.status || "unassessed"];

function clean(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/(\d),(?=\d{3})/g, "$1")
    .replace(/[^a-z0-9.%\s-]/g, " ");
}
function toks(text) {
  return clean(text)
    .replace(/-/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^\.+|\.+$/g, ""))
    .filter(Boolean);
}

const STOP = new Set(
  ("a an the of for to in on at is are be do does did what which who how many much any all me us my our i we you it its " +
    "this that there their and or but with about from by as can could should would please tell show give list need needed " +
    "required requirement requirements has have had get got stadium stadiums venue venues most best ready readiness status " +
    "current currently latest now fifa chapter chapters family families").split(" "),
);
const SYNONYMS = {
  seats: "seating",
  seat: "seating",
  stands: "seating",
  lights: "lighting",
  light: "lighting",
  floodlight: "lighting",
  floodlights: "lighting",
  floodlighting: "lighting",
  illumination: "lighting",
  generators: "generator",
  toilet: "toilets",
  cameras: "camera",
  pitches: "pitch",
};

// Which requirement family (chapter of the FIFA stadium book) a question is about: the family with most keyword hits.
const FAMILY_WORDS = {
  "01": /\b(pre construction|master plan|zoning|green goal|environmental|handover|deviations?|design review|solar glare|site boundary|wastewater|potable|water)\b/g,
  "02": /\b(safety|security|fire|evacuation|cctv|surveillance|stewards?|structural|hostile|incident command|operations room|control room)\b/g,
  "03": /\b(parking|egress|wayfinding|signage|queue|perimeter|screening|transport|last mile|logistics|ambulance access|concourse|access)\b/g,
  "04": /\b(pitch|grass|turf|drainage|irrigation|playing area|playing field|goals?|substitutes?|benches|field of play|agronomic)\b/g,
  "05": /\b(dressing|players?|referees?|officials?|tunnel|warm ?up|doping|medical room|match delegate|welfare)\b/g,
  "06": /\b(spectators?|seating|capacity|toilets?|concessions?|accessible|disabled|wheelchair|ticketing|turnstiles?|public address|scoreboards?|screens?|sightlines|prayer|comfort)\b/g,
  "07": /\b(hospitality|vip|vvip|lounges?|skyboxes|sponsor)\b/g,
  "08": /\b(media|broadcast|camera|commentary|press|mixed zone|studio|photographers?|tribune|compound|accreditation)\b/g,
  "09": /\b(lighting|power|electrical|generators?|ups|lux|illuminance|floodlight|commissioning)\b/g,
  "10": /\b(communications?|telecom|wi ?fi|network|cyber(security)?|fibre|ict|telephones?|flagpoles?|building management)\b/g,
  "12": /\b(temporary|overlay|fan fest(ival)?s?|demountable|event facilities|sustainability|reinstatement)\b/g,
};
function familyFrom(text) {
  const q = ` ${toks(text).join(" ")} `.replace(/ lights? /g, " lighting ").replace(/ floodlights? /g, " floodlight ");
  let best = null;
  for (const [id, re] of Object.entries(FAMILY_WORDS)) {
    const hits = (q.match(re) || []).length;
    if (hits && (!best || hits > best.hits)) best = { id, hits };
  }
  return best ? FAMILIES.find((f) => f.id === best.id) : null;
}

// ---------- sources shown under an answer ----------
const programmeSource = (id, category, title, facts) => ({
  id,
  kind: "programme",
  category,
  title,
  facts: facts.map(([l, v]) => ({ label: l, value: String(v) })),
  checks: [],
});

function documentSources(reqs) {
  const out = new Map();
  for (const r of reqs) {
    const hosting = r.sourceId === "FIFA-HOST";
    const key = `${hosting ? "host" : r.sectionId}#${r.pdfPage}`;
    const line = `${r.id} · ${r.title}: ${r.generic ? "threshold to be confirmed against the 2034 contract" : r.summary}`;
    if (!out.has(key))
      out.set(key, {
        id: key,
        kind: "document",
        title: hosting ? "FIFA World Cup 2034 · Overview of hosting requirements" : `FIFA stadium book · ${r.section}`,
        page: r.pdfPage,
        lines: [],
      });
    out.get(key).lines.push(line);
  }
  return [...out.values()].slice(0, 3).map(({ lines, ...s }) => ({ ...s, excerpt: lines.join("\n") }));
}

// ---------- stadiums and cities ----------
const EXTRA_ALIASES = {
  "king-salman-international": ["ksis", "salman international"],
  "prince-mohammed-bin-salman": ["pmbs", "mohammed bin salman"],
  "king-abdullah-economic-city": ["kaec", "economic city"],
  "king-abdullah-sports-city": ["jeddah sports city"],
  "prince-faisal-bin-fahad": ["faisal bin fahad"],
  "new-murabba": ["murabba"],
  "jeddah-central-development": ["jeddah central"],
};
function aliasesOf(s) {
  const base = toks(s.name.replace(/stadium/i, "")).join(" ");
  const list = new Set([base, s.id.replace(/-/g, " "), ...(EXTRA_ALIASES[s.id] || [])]);
  const short = base.replace(/\b(sports city|economic city|university|development|international|sports)\b/g, "").replace(/\s+/g, " ").trim();
  if (short.split(" ").length >= 2) list.add(short);
  return [...list].filter(Boolean);
}
function findStadiums(text) {
  const padded = ` ${toks(text).join(" ")} `;
  const hits = [];
  for (const s of FACILITY_REGISTER.stadiums) {
    let best = 0;
    for (const alias of aliasesOf(s)) {
      const a = toks(alias).join(" ");
      if (a && padded.includes(` ${a} `)) best = Math.max(best, a.length);
    }
    if (best) hits.push({ stadium: s, best });
  }
  if (!hits.length) return [];
  const top = Math.max(...hits.map((h) => h.best));
  return hits.filter((h) => h.best === top).map((h) => h.stadium);
}
function findCity(text) {
  const padded = ` ${toks(text).join(" ")} `;
  return FACILITY_REGISTER.hostCities.find((c) => padded.includes(` ${toks(c.name).join(" ")} `)) || null;
}
const cityOf = (s) => FACILITY_REGISTER.hostCities.find((c) => c.id === s.cityId)?.name || "";
const statusText = (s) => (STATUS_LABEL && STATUS_LABEL[s.status]) || s.status;
const matchText = (s) => (MATCH_LABEL && MATCH_LABEL[s.highestMatch]) || s.highestMatch;
const byLevel = (a, b) =>
  EXPOSURE_ORDER.indexOf(a.level) - EXPOSURE_ORDER.indexOf(b.level) || a.row.requirement.id.localeCompare(b.row.requirement.id);
const countsText = (c, openOnly = false) =>
  EXPOSURE_ORDER.filter((k) => !openOnly || k !== "controlled")
    .map((k) => `${c[k]} ${EXPOSURE[k].label.toLowerCase()}`)
    .join(", ");
const sectionOrder = (r) => r.sectionId.split(".").map(Number);
const bySection = (a, b) => sectionOrder(a)[0] - sectionOrder(b)[0] || sectionOrder(a)[1] - sectionOrder(b)[1] || a.id.localeCompare(b.id);

function findingSource(n, stadium, f) {
  const r = f.row.requirement;
  return programmeSource(`O${n}`, "obligations", `${r.id} · ${r.title}`, [
    ["Record", f.row.key],
    ["Venue", stadium.name],
    ["Status", statusOf(f.record)],
    ["Owner", ownerFor(stadium.id, r)],
    ["Criticality", EXPOSURE[f.level].label],
    ["Criterion", r.criterion.operator === "manual" ? "Threshold to be confirmed" : label(r)],
  ]);
}
function findingLine(stadium, f) {
  const r = f.row.requirement;
  const due = formatDue(dueDate(f.level));
  return `${r.id} ${r.title} (${EXPOSURE[f.level].label}): ${mitigationAction(f)} Owner: ${ownerFor(stadium.id, r)}; due ${due}.`;
}
const stadiumRows = (stadium) => stadiumRequirements(stadium).filter((r) => r.applicability.value !== "not-applicable");

// ---------- answers ----------
function greeting() {
  return {
    reply:
      "Hello, I'm Nabd. I can tell you how each stadium is doing, what is still outstanding and what evidence is needed, " +
      "what FIFA requires, and what a requirement change would do to the programme.",
    sources: [],
  };
}
function help() {
  return {
    reply:
      "Here is what I can help with:\n" +
      bullets([
        "Facility readiness: ask about any stadium or host city, for example \"How is Aramco Stadium doing?\"",
        "By chapter: \"Show Aramco Stadium by chapter\" gives each family of requirements.",
        "FIFA requirements: \"What are the lighting requirements?\" or \"How big must the players' tunnel be?\"",
        "Outstanding gaps: \"What is outstanding at King Salman International Stadium?\"",
        "Evidence: \"What evidence is needed for the playing area?\"",
        "Alerts: \"What alerts are open?\" or \"What alerts are open for Aramco Stadium?\"",
        "Latest status: \"What is the latest compliance status?\"",
        "Requirement changes: \"What happens if the press conference room must be 500 m²?\"",
      ]),
    sources: [],
  };
}

function nationalStatus(records) {
  const p = portfolio(records);
  const k = p.kpis;
  const queue = queueCounts(reviewQueue(records));
  const applied = appliedChanges();
  const lines = [
    "Latest compliance status for the Saudi Arabia 2034 programme:",
    "",
    bullets([
      `${pct(k.compliance)}% of in-scope requirements are fulfilled (${fmtN(k.compliant)} of ${fmtN(k.inScope)}) across ${k.stadiums} stadiums.`,
      `${k.atRisk} of ${k.stadiums} stadiums carry critical or material findings: ${k.offTrack} off track and ${k.atRiskOnly} at risk.`,
      `Open findings: ${k.criticalIssues} critical and ${k.materialIssues} material.`,
      `${plural(queue.total, "item")} waiting in the review queue (${queue["evidence-submitted"]} awaiting a decision, ${queue["non-compliant"]} not fulfilled, ${queue.partial} of them partially compliant).`,
      applied.length ? `${plural(applied.length, "requirement change")} applied.` : "No requirement changes have been applied.",
    ]),
  ];
  return {
    reply: lines.join("\n"),
    sources: [
      programmeSource("S1", "summary", "Programme snapshot", [
        ["National compliance", `${pct(k.compliance)}%`],
        ["Requirements fulfilled", `${fmtN(k.compliant)} of ${fmtN(k.inScope)}`],
        ["Stadiums at risk", `${k.atRisk} of ${k.stadiums}`],
        ["Critical findings", k.criticalIssues],
        ["Material findings", k.materialIssues],
        ["Review queue", queue.total],
      ]),
    ],
  };
}

function ranking(q, records) {
  const asc = /\b(lowest|least|worst|weakest|bottom|behind)\b/.test(q);
  const rows = [...portfolio(records).rows].sort((a, b) => (asc ? a.assured - b.assured : b.assured - a.assured));
  const top = rows.slice(0, 3);
  const lines = [`${asc ? "Lowest" : "Highest"} share of requirements fulfilled by stadium:`, ""];
  lines.push(
    bullets(
      top.map((r) => {
        const a = stadiumAssurance(r.stadium, records);
        return `${r.stadium.name} (${r.cityName}): ${pct(r.assured)}% fulfilled, ${a.compliant} of ${a.inScope} requirements; ${r.schedule.label.toLowerCase()}, due ${r.stadium.completionYear}.`;
      }),
    ),
  );
  if (asc && top.every((r) => r.stadium.completionYear >= 2032))
    lines.push("", "These stadiums complete later, so fewer of their requirements have reached assessment so far.");
  const s = top[0];
  return {
    reply: lines.join("\n"),
    sources: [
      programmeSource("V1", "venues", s.stadium.name, [
        ["City", s.cityName],
        ["Fulfilled", `${pct(s.assured)}%`],
        ["Exposure", countsText(s.counts)],
        ["Next gate", s.gate],
      ]),
    ],
    stadium: s.stadium,
  };
}

function atRisk(q, records) {
  const onlyCritical = /\bcritical\b/.test(q) && !/\b(material|risk|exposure|exposed|off track|behind)\b/.test(q);
  const rows = portfolio(records).rows.filter((r) => (onlyCritical ? r.counts.critical > 0 : r.issues > 0));
  if (!rows.length)
    return { reply: `No stadium carries ${onlyCritical ? "critical" : "critical or material"} findings at the moment.`, sources: [] };
  const lines = [`Stadiums with ${onlyCritical ? "critical" : "critical or material"} findings, most exposed first:`, ""];
  lines.push(
    bullets(
      rows.map(
        (r) =>
          `${r.stadium.name} (${r.cityName}): ${r.counts.critical} critical, ${r.counts.material} material; ${r.schedule.label.toLowerCase()}; next gate ${r.gate}.`,
      ),
    ),
  );
  const first = rows[0];
  return {
    reply: lines.join("\n"),
    sources: [
      programmeSource("V1", "venues", first.stadium.name, [
        ["City", first.cityName],
        ["Exposure", countsText(first.counts)],
        ["Schedule", first.schedule.label],
        ["Next gate", first.gate],
      ]),
    ],
    stadium: first.stadium,
  };
}

function nationalGaps(records) {
  const all = [];
  for (const s of FACILITY_REGISTER.stadiums)
    for (const f of stadiumExposure(s, records).findings) if (f.level !== "controlled") all.push({ s, f });
  all.sort((a, b) => byLevel(a.f, b.f) || a.s.completionYear - b.s.completionYear || a.s.name.localeCompare(b.s.name));
  const counts = { critical: 0, material: 0, manageable: 0 };
  for (const { f } of all) counts[f.level]++;
  const top = all.slice(0, 5);
  const lines = [
    `${fmtN(all.length)} findings are open across the programme: ${counts.critical} critical, ${counts.material} material and ${counts.manageable} manageable.`,
    "",
    "Most urgent:",
    bullets(top.map(({ s, f }) => `${s.name}: ${findingLine(s, f)}`)),
  ];
  return {
    reply: lines.join("\n"),
    sources: top.slice(0, 3).map(({ s, f }, i) => findingSource(i + 1, s, f)),
    stadium: top[0]?.s,
  };
}

function stadiumCard(stadium, ex) {
  const schedule = schedulePosition(ex.counts);
  return programmeSource("V1", "venues", stadium.name, [
    ["City", cityOf(stadium)],
    ["Completion", stadium.completionYear],
    ["Exposure", countsText(ex.counts)],
    ["Schedule", schedule.label],
    ["Next gate", nextGate(stadium)],
  ]);
}

function stadiumGaps(stadium, records, family) {
  const ex = stadiumExposure(stadium, records);
  let open = ex.findings.filter((f) => f.level !== "controlled");
  if (family) open = open.filter((f) => f.row.requirement.category === family.name);
  open.sort(byLevel);
  const where = family ? ` for ${family.name.toLowerCase()}` : "";
  if (!open.length)
    return {
      reply: `${stadium.name} has no open findings${where} at the moment. Everything in scope is fulfilled or managed through normal delivery controls.`,
      sources: [stadiumCard(stadium, ex)],
      stadium,
    };
  const shown = open.slice(0, 5);
  const openCounts = { critical: 0, material: 0, manageable: 0, controlled: 0 };
  for (const f of open) openCounts[f.level]++;
  const lines = [
    `${stadium.name} has ${plural(open.length, "open finding")}${where}: ${countsText(openCounts, true)}.`,
    "",
    bullets(shown.map((f) => findingLine(stadium, f))),
  ];
  const more = open.length - shown.length;
  if (more > 0) lines.push("", `${more} more ${more === 1 ? "is" : "are"} on the stadium page.`);
  return {
    reply: lines.join("\n"),
    sources: [stadiumCard(stadium, ex), ...shown.slice(0, 2).map((f, i) => findingSource(i + 1, stadium, f))],
    stadium,
  };
}

function stadiumSummary(stadium, records) {
  const a = stadiumAssurance(stadium, records);
  const ex = stadiumExposure(stadium, records);
  const schedule = schedulePosition(ex.counts);
  const rows = stadiumRows(stadium);
  const partial = rows.filter((r) => records[r.key]?.partial).length;
  const open = ex.findings.filter((f) => f.level !== "controlled").sort(byLevel);
  const lines = [
    `${stadium.name} (${cityOf(stadium)}): ${statusText(stadium).toLowerCase()}, due ${stadium.completionYear}, highest match ${matchText(stadium)}.`,
    "",
    bullets([
      `${a.compliant} of ${a.inScope} requirements fulfilled (${pct(a.assured)}%); ${a["non-compliant"]} not fulfilled${partial ? `, ${partial} of them partially compliant` : ""}.`,
      `${a["evidence-submitted"]} awaiting review and ${a.unassessed} not yet assessed.`,
      `Exposure: ${countsText(ex.counts)}. Schedule: ${schedule.label.toLowerCase()}. Next gate: ${nextGate(stadium)}.`,
    ]),
  ];
  if (open.length) lines.push("", `Most pressing: ${findingLine(stadium, open[0])}`);
  return {
    reply: lines.join("\n"),
    sources: [stadiumCard(stadium, ex), ...open.slice(0, 2).map((f, i) => findingSource(i + 1, stadium, f))],
    stadium,
  };
}

function stadiumByChapter(stadium, records) {
  const ex = stadiumExposure(stadium, records);
  const lines = [`${stadium.name} by chapter of the FIFA stadium book:`, ""];
  const rows = [];
  for (const f of FAMILIES.filter((x) => x.forStadiums)) {
    const a = stadiumAssurance(stadium, records, f.name);
    if (!a.inScope) continue;
    rows.push(`${f.id} ${f.name}: ${a.compliant} of ${a.inScope} fulfilled, ${a["non-compliant"]} not fulfilled, ${a["evidence-submitted"]} awaiting review, ${a.unassessed} not assessed.`);
  }
  lines.push(bullets(rows));
  return { reply: lines.join("\n"), sources: [stadiumCard(stadium, ex)], stadium };
}

function stadiumEvidence(stadium, records) {
  const ex = stadiumExposure(stadium, records);
  const need = new Map();
  let waiting = 0;
  for (const f of ex.findings) {
    const status = f.record?.status || "unassessed";
    if (status === "evidence-submitted") {
      waiting++;
      continue;
    }
    if (status === "compliant") continue;
    if (status === "unassessed" && f.level === "controlled") continue;
    const family = f.row.requirement.category;
    need.set(family, (need.get(family) || 0) + 1);
  }
  const rows = [...need.entries()].sort((a, b) => b[1] - a[1]);
  const lines = [`Evidence position for ${stadium.name}:`, ""];
  const list = rows.map(([name, n]) => `${name}: evidence needed for ${plural(n, "requirement")} (drawings, calculations, tests or certificates as applicable).`);
  if (waiting) list.push(`${plural(waiting, "submission")} already in and waiting for a reviewer decision.`);
  lines.push(list.length ? bullets(list.slice(0, 7)) : "Nothing further is needed at the moment. All evidence in scope has been accepted.");
  return { reply: lines.join("\n"), sources: [stadiumCard(stadium, ex)], stadium };
}

function evidenceAnswer(family, records) {
  const reqs = currentRequirements().filter((r) => r.appliesTo.includes("stadium") && (!family || r.category === family.name));
  const evidence = [...new Set(reqs.map((r) => r.suggestedEvidence))];
  let missing = 0;
  let total = 0;
  for (const s of FACILITY_REGISTER.stadiums)
    for (const row of stadiumRows(s)) {
      if (family && row.requirement.category !== family.name) continue;
      total++;
      if (!records[row.key]) missing++;
    }
  const lines = [
    `${family ? `${family.name}: ` : ""}the register asks for ${evidence.map((e) => e.toLowerCase()).join("; ")}, for each of ${plural(reqs.length, "requirement")}.`,
    "",
    bullets([
      `Across the 15 stadiums, ${fmtN(missing)} of ${fmtN(total)} requirements in scope${family ? " for this chapter" : ""} have no evidence on record yet.`,
      "Open a stadium page to record evidence against a requirement, or file a document on the Intake page.",
    ]),
  ];
  return { reply: lines.join("\n"), sources: documentSources(reqs.slice(0, 6)) };
}

// ---------- requirement lookup ----------
function searchRequirements(text) {
  const all = toks(text);
  const qw = [...new Set(all.map((w) => SYNONYMS[w] || w).filter((w) => !STOP.has(w) && w.length > 2))];
  const bigrams = [];
  for (let i = 0; i < all.length - 1; i++) if (!STOP.has(all[i]) && !STOP.has(all[i + 1])) bigrams.push(`${all[i]} ${all[i + 1]}`);
  const c = clean(text);
  const asset = /\b(training|base camp)\b/.test(c) ? "Training site" : /\bfan fest/.test(c) ? "Fan festival" : /\bibc\b/.test(c) ? "IBC" : "Stadium";
  if (!qw.length) return { list: [], score: 0 };
  const scored = [];
  for (const r of currentRequirements()) {
    if (r.assetType !== asset) continue;
    const hayText = toks([r.id, r.title, r.topic, r.generic ? "" : r.summary, r.workstream, r.category, label(r)].join(" ")).join(" ");
    const hay = new Set(hayText.split(" "));
    let score = 0;
    for (const w of qw) if (hay.has(w) || hay.has(`${w}s`) || (w.endsWith("s") && hay.has(w.slice(0, -1)))) score++;
    for (const b of bigrams) if (` ${hayText} `.includes(` ${b} `)) score += 2;
    if (score > 0) scored.push({ r, score });
  }
  if (!scored.length) return { list: [], score: 0 };
  const top = Math.max(...scored.map((x) => x.score));
  return { list: scored.filter((x) => x.score === top).map((x) => x.r), score: top };
}

function requirementLine(r) {
  return `${r.title} [${r.id}]: ${r.generic ? "threshold to be confirmed against the 2034 contract" : r.summary}`;
}

function requirementAnswer(reqs) {
  const sorted = [...reqs].sort((a, b) => Number(a.generic) - Number(b.generic) || bySection(a, b));
  const shown = sorted.slice(0, 8);
  const lines = ["What the requirement register says:", "", bullets(shown.map(requirementLine))];
  const rest = sorted.length - shown.length;
  if (rest > 0) lines.push("", `${rest} more ${rest === 1 ? "is" : "are"} in the requirement register.`);
  lines.push("", "The 2034 contract clause is still to be confirmed for most checks; applicability to each facility is pending review.");
  return { reply: lines.join("\n"), sources: documentSources(shown) };
}

function familyAnswer(family) {
  const reqs = currentRequirements().filter((r) => r.appliesTo.includes("stadium") && r.category === family.name);
  const sorted = [...reqs].sort((a, b) => Number(a.generic) - Number(b.generic) || bySection(a, b));
  const shown = sorted.slice(0, 8);
  const withThreshold = reqs.filter((r) => !r.generic).length;
  const lines = [
    `${family.id} ${family.name}: ${plural(reqs.length, "requirement")} apply to stadiums${withThreshold ? `, ${withThreshold} with a stated threshold` : ""}.`,
    "",
    bullets(shown.map(requirementLine)),
  ];
  const rest = reqs.length - shown.length;
  if (rest > 0) lines.push("", `${rest} more ${rest === 1 ? "is" : "are"} in the requirement register.`);
  return { reply: lines.join("\n"), sources: documentSources(shown) };
}

// ---------- requirement changes ----------
function scenarioFor(text) {
  const all = toks(text);
  const qw = new Set(all.map((w) => SYNONYMS[w] || w).filter((w) => !STOP.has(w) && w.length > 2));
  let best = null;
  for (const s of CHANGE_SCENARIOS) {
    const req = currentRequirements().find((r) => r.id === s.requirementId);
    const hay = new Set(toks([s.id, s.title, s.summary, req?.title, s.criterion.value, s.criterion.unit].join(" ")));
    let score = 0;
    for (const w of qw) if (hay.has(w)) score++;
    if (!best || score > best.score) best = { s, score };
  }
  return best && best.score >= 2 ? best.s : null;
}

function appliedAnswer() {
  const applied = appliedChanges();
  if (!applied.length) {
    return {
      reply:
        "No requirement changes have been applied. These can be previewed from the map:\n" +
        bullets(CHANGE_SCENARIOS.map((s) => `${s.title}: ${s.summary}`)),
      sources: [],
    };
  }
  const lines = applied.map((c) => {
    const s = scenarioById(c.changeId);
    return s ? `${s.title}: ${s.summary}` : String(c.changeId);
  });
  return { reply: `${plural(applied.length, "requirement change")} applied:\n` + bullets(lines), sources: [] };
}

function changeAnswer(scenario, records) {
  const impact = changeImpact(scenario, records);
  const c = impact.counts;
  const now = label(impact.before);
  const next = label(impact.after);
  const flipped = impact.rows.filter((r) => r.flipped);
  const lines = [
    `${scenario.title}: ${scenario.summary} This is a hypothetical change, not an announced FIFA requirement.`,
    "",
    bullets([
      `${impact.before.id} ${impact.before.title} changes from ${now} to ${next}.`,
      `${plural(c.stadiums, "stadium")} ${c.stadiums === 1 ? "is" : "are"} in scope for this requirement.`,
      `${plural(c.reopened, "compliant stadium")} would reopen for review; ${plural(c.flipped, "recorded value")} that ${c.flipped === 1 ? "passes" : "pass"} today would fail.`,
    ]),
  ];
  if (flipped.length) {
    lines.push("", "Affected:", bullets(flipped.slice(0, 5).map((r) => `${r.stadium.name}: recorded value ${fmtN(r.value)} no longer meets ${next}.`)));
    if (flipped.length > 5) lines.push(`and ${flipped.length - 5} more.`);
  }
  const outcomes = Object.keys(OUTCOME_LABEL)
    .filter((k) => c[k])
    .map((k) => `${c[k]} ${OUTCOME_LABEL[k].toLowerCase()}`);
  if (outcomes.length) lines.push("", `Outcomes: ${outcomes.join(", ")}.`);
  lines.push("", "Open the change panel on the map to apply it and see the stadiums affected.");
  return { reply: lines.join("\n"), sources: documentSources([impact.before]) };
}

// ---------- review queue ----------
function queueAnswer(records) {
  const items = reviewQueue(records);
  const c = queueCounts(items);
  const first = items[0];
  const lines = [
    `${plural(c.total, "item")} ${c.total === 1 ? "is" : "are"} waiting in the review queue.`,
    "",
    bullets([
      `${c["evidence-submitted"]} with evidence submitted, waiting for a reviewer decision.`,
      `${c["non-compliant"]} not fulfilled, waiting for new evidence (${c.partial} of them partially compliant).`,
      `${c.fail} where the submitted evidence is below the criterion.`,
    ]),
  ];
  if (first) lines.push("", `Earliest delivery first: ${first.stadium.name}, ${first.requirement.id} ${first.requirement.title}.`);
  return {
    reply: lines.join("\n"),
    sources: [
      programmeSource("S1", "summary", "Review queue", [
        ["Items waiting", c.total],
        ["Evidence submitted", c["evidence-submitted"]],
        ["Not fulfilled", c["non-compliant"]],
        ["Below criterion", c.fail],
      ]),
    ],
    stadium: first?.stadium,
  };
}

function cityAnswer(city, records) {
  const rows = portfolio(records).rows.filter((r) => r.stadium.cityId === city.id);
  if (!rows.length) return { reply: `No stadiums are registered in ${city.name}.`, sources: [] };
  const lines = [`${city.name} has ${plural(rows.length, "stadium")}:`, ""];
  lines.push(
    bullets(
      rows.map(
        (r) => `${r.stadium.name}: ${pct(r.assured)}% fulfilled; ${r.schedule.label.toLowerCase()}; ${r.counts.critical} critical, ${r.counts.material} material; due ${r.stadium.completionYear}.`,
      ),
    ),
  );
  return { reply: lines.join("\n"), sources: [], stadium: rows[0].stadium };
}

// ---------- alerts to owners ----------
const stadiumNameById = (id) => FACILITY_REGISTER.stadiums.find((s) => s.id === id)?.name || id;
const dueText = (iso) => formatDue(new Date(`${iso}T00:00:00Z`));

function alertsAnswer(records, stadium) {
  const open = allAlerts(records).filter((a) => a.status === "open" && (!stadium || a.stadium_id === stadium.id));
  if (!open.length)
    return { reply: stadium ? `There are no open alerts for ${stadium.name}.` : "There are no open alerts.", sources: [], stadium };
  const high = open.filter((a) => a.severity === "high").length;
  const fromDocs = open.filter((a) => a.source.type === "document").length;
  const owners = new Map();
  for (const a of open) owners.set(a.owner, (owners.get(a.owner) || 0) + 1);
  const lines = [
    `${plural(open.length, "alert")} ${open.length === 1 ? "is" : "are"} open${stadium ? ` for ${stadium.name}` : ""}: ${high} high severity, ${fromDocs} raised from documents the agent read.`,
    "",
    "Most urgent:",
    bullets(open.slice(0, 4).map((a) => `${stadium ? "" : `${stadiumNameById(a.stadium_id)}: `}${a.title} (for ${a.owner}, due ${dueText(a.due)})`)),
    "",
    `By owner: ${[...owners].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([o, n]) => `${o} ${n}`).join("; ")}.`,
  ];
  return {
    reply: lines.join("\n"),
    sources: [
      programmeSource("A1", "summary", stadium ? `Alerts for ${stadium.name}` : "Alerts to owners", [
        ["Open alerts", open.length],
        ["High severity", high],
        ["Raised from documents", fromDocs],
        ["Owners to act", owners.size],
      ]),
    ],
    stadium: stadium || (open[0] ? FACILITY_REGISTER.stadiums.find((x) => x.id === open[0].stadium_id) : undefined),
  };
}

function fallback() {
  return {
    reply:
      "I could not match that to a stadium, a requirement or the programme figures. Try asking about a stadium or host city, " +
      "a chapter such as the playing area or lighting and power, outstanding gaps, the evidence needed, the review queue or the latest status.",
    sources: [],
  };
}

// ---------- routing ----------
/** Pure: the answer to one question from the given assessment records. */
export function answerQuestion(question, records, memory = {}) {
  const raw = String(question || "");
  const q = clean(raw).replace(/\s+/g, " ").trim();
  const words = toks(raw);

  if (/[\u0600-\u06FF]/.test(raw))
    return {
      reply:
        "أجيب حالياً عن الأسئلة المكتوبة بالإنجليزية. جرّب مثلاً: \"What is the latest compliance status?\" أو \"What is outstanding at Aramco Stadium?\"",
      sources: [],
    };
  if (/^(hi|hello|hey|salam|marhaba|good (morning|afternoon|evening))\b/.test(q) && words.length <= 4) return greeting();
  if (/^(thanks|thank you|shukran|great|perfect|ok thanks)\b/.test(q) && words.length <= 5)
    return { reply: "You're welcome. Ask me anything else about the stadiums, the requirements or the evidence.", sources: [] };
  if (/\b(help|what can you (do|answer)|what do you know|how (do|can) i use)\b/.test(q)) return help();

  if (/\b(changes?|scenarios?)\b.*\b(applied|active|in force)\b|\bapplied\b.*\bchanges?\b/.test(q)) return appliedAnswer();
  const scenario = scenarioFor(raw);
  if (scenario && /\b(what if|if|would|impact|affect|effect|happen|raise|rise|rises|tighten|change|increase|must be)\b/.test(q))
    return changeAnswer(scenario, records);

  if (/\b(review queue|queue|waiting for review|awaiting review|pending review|to review|reviewer)\b/.test(q)) return queueAnswer(records);

  const named = findStadiums(raw);
  const cue = /^(and|also|what about|how about)\b/.test(q) || /\b(it|its|there|that one|this one)\b/.test(q);
  const followUp = !named.length && words.length <= 8 && memory.stadiumId && cue;
  const stadium =
    named.length === 1 ? named[0] : followUp ? FACILITY_REGISTER.stadiums.find((s) => s.id === memory.stadiumId) : null;

  const gapsAsk = /\b(gaps?|outstanding|missing|open (items|findings|issues)|non compliant|noncompliant|not fulfilled|failing|fail|fails|failed|shortfall|blocking|left|issues?|findings?|problems?|actions?)\b/.test(q);
  const evidenceAsk = /\b(evidence|submit|submission|proof|uploaded|intake|filed)\b/.test(q);
  const alertsAsk = /\b(alerts?|notifications?)\b/.test(q);
  const chapterAsk = /\b(by chapter|by family|each chapter|per chapter|every chapter|chapters|breakdown|by family)\b/.test(q);
  const family = familyFrom(raw);

  if (named.length > 1) {
    const names = named.map((s) => s.name);
    return { reply: `Did you mean ${names.slice(0, -1).join(", ")} or ${names.at(-1)}?`, sources: [] };
  }
  if (stadium) {
    if (alertsAsk) return alertsAnswer(records, stadium);
    if (chapterAsk) return stadiumByChapter(stadium, records);
    if (evidenceAsk) return stadiumEvidence(stadium, records);
    if (gapsAsk || family) return stadiumGaps(stadium, records, family);
    return stadiumSummary(stadium, records);
  }

  if (alertsAsk) return alertsAnswer(records, null);
  if (
    (/\b(lowest|least|worst|weakest|bottom|highest|best|strongest|top)\b/.test(q) && /\b(assur|complian|ready|readiness|share|fulfil|stadium|venue|progress)/.test(q)) ||
    /\b(most|least) (ready|compliant|advanced|assured|progressed)\b/.test(q) ||
    /\b(furthest|closest) (ahead|behind)\b/.test(q)
  )
    return ranking(q, records);
  if (/\b(at risk|critical|exposure|exposed|material|off track|behind)\b/.test(q)) return atRisk(q, records);
  if (gapsAsk && !family) return nationalGaps(records);
  if (evidenceAsk) return evidenceAnswer(family, records);

  const hit = searchRequirements(raw);
  const wantsList = /\b(requirements?|list|what does fifa (require|ask)|checks?)\b/.test(q);
  if (family && wantsList && hit.score < 3) return familyAnswer(family);
  if (hit.list.length) return requirementAnswer(hit.list);
  if (family) return familyAnswer(family);

  const city = findCity(raw);
  if (city) return cityAnswer(city, records);
  if (/\b(status|overall|national|programme|program|summary|overview|compliance|readiness|latest|update|how are we|where are we)\b/.test(q))
    return nationalStatus(records);
  return fallback();
}

// ---------- session memory and entry point ----------
const memory = { stadiumId: null };

/** Nabd's answer to one question, shaped like the assistant service's reply: { reply, sources, warnings }. */
export async function localAnswer(question) {
  const started = Date.now();
  let result;
  try {
    result = answerQuestion(question, getAssessments(), memory);
  } catch (error) {
    console.error("Nabd could not answer from the programme data", error);
    result = { reply: "I could not work that out just now. Please try asking it another way.", sources: [] };
  }
  if (result.stadium) memory.stadiumId = result.stadium.id;
  const pause = 650 + Math.min(String(question || "").length * 9, 600);
  const left = pause - (Date.now() - started);
  if (left > 0) await new Promise((resolve) => setTimeout(resolve, left));
  return { reply: result.reply, sources: result.sources || [], warnings: [] };
}
