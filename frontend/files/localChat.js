// Nabd answers from the programme data in this browser: stadium assessments,
// the review queue, requirement changes and the FIFA requirement catalogue.
// Used when the assistant service does not answer (see lib/assistant/chat.js).
// Every figure comes from the same modules the pages use, so answers always
// agree with what is on screen.
import { stadiumAssurance } from "@/lib/domain/cityAssurance.mjs";
import { FIFA_CATALOGUE, criterionLabel } from "@/lib/domain/fifa-catalogue.mjs";
import { FACILITY_REGISTER, MATCH_LABEL, STATUS_LABEL } from "@/lib/domain/facilities.mjs";
import { EXPOSURE, EXPOSURE_ORDER, nextGate, portfolio, schedulePosition, stadiumExposure } from "@/lib/domain/exposure.mjs";
import { dueDate, formatDue, mitigationAction, ownerFor } from "@/lib/domain/mitigation.mjs";
import { queueCounts, reviewQueue } from "@/lib/domain/reviewQueue.mjs";
import { OUTCOME_LABEL, changeImpact } from "@/lib/domain/requirementChange.mjs";
import { CHANGE_SCENARIOS, appliedChanges, currentRequirements, scenarioById } from "@/lib/domain/requirementVersions.mjs";
import { getAssessments } from "@/lib/store/assessments";

// ---------- small helpers ----------
const pct = (x) => Math.round(x * 100);
const fmtN = (n) => Number(n).toLocaleString("en-US");
const bullets = (lines) => lines.map((l) => `• ${l}`).join("\n");
const plural = (n, one, many = `${one}s`) => `${fmtN(n)} ${n === 1 ? one : many}`;
const label = (r) => criterionLabel(r.criterion).replace(/\d{4,}/g, (n) => fmtN(n));

const STATUS_TEXT = {
  compliant: "Compliant",
  "non-compliant": "Non-compliant",
  "evidence-submitted": "Evidence submitted",
  declared: "Declared",
  unassessed: "Not assessed",
};

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
    "current currently latest now").split(" "),
);
const SYNONYMS = {
  seats: "seating",
  seat: "seating",
  capacity: "seating",
  stands: "seating",
  lights: "lighting",
  light: "lighting",
  floodlight: "lighting",
  floodlights: "lighting",
  floodlighting: "lighting",
  illumination: "lighting",
  color: "colour",
  cri: "rendering",
  pitches: "pitch",
};

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
    const src = FIFA_CATALOGUE.sources.find((s) => s.id === r.sourceId);
    const key = `${r.sourceId}#${r.printedPage}`;
    const line = `${r.id} · ${r.title}: ${r.summary || label(r)}`;
    if (!out.has(key)) {
      out.set(key, {
        id: key,
        kind: "document",
        title: src ? `${src.publisher} ${src.shortTitle}` : r.sourceId,
        page: r.printedPage,
        lines: [],
      });
    }
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

function findingSource(n, stadium, f) {
  const r = f.row.requirement;
  return programmeSource(`O${n}`, "obligations", `${r.id} · ${r.title}`, [
    ["Record", f.row.key],
    ["Venue", stadium.name],
    ["Status", STATUS_TEXT[f.record?.status || "unassessed"]],
    ["Owner", ownerFor(r.category)],
    ["Criticality", EXPOSURE[f.level].label],
    ["Criterion", label(r)],
  ]);
}
function findingLine(f) {
  const r = f.row.requirement;
  const due = formatDue(dueDate(f.level));
  return `${r.id} ${r.title} (${EXPOSURE[f.level].label}): ${mitigationAction(f)} Owner: ${ownerFor(r.category)}; due ${due}.`;
}

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
        "FIFA requirements: ask for a figure or a family, for example \"What is the minimum seating for a semi-final?\"",
        "Outstanding gaps: \"What is outstanding at King Salman International Stadium?\"",
        "Evidence: \"What evidence is needed for lighting?\"",
        "Latest status: \"What is the latest compliance status?\"",
        "Requirement changes: \"What happens if semi-final seating rises to 65,000?\"",
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
      `${pct(k.compliance)}% of in-scope requirements are accepted (${fmtN(k.compliant)} of ${fmtN(k.inScope)}) across ${k.stadiums} stadiums.`,
      `${k.atRisk} of ${k.stadiums} stadiums carry critical or material findings: ${k.offTrack} off track and ${k.atRiskOnly} at risk.`,
      `Open findings: ${k.criticalIssues} critical and ${k.materialIssues} material.`,
      `${plural(queue.total, "item")} waiting in the review queue (${queue["evidence-submitted"]} awaiting a decision, ${queue["non-compliant"]} non-compliant).`,
      applied.length
        ? `${plural(applied.length, "requirement change")} applied.`
        : "No requirement changes have been applied.",
    ]),
  ];
  return {
    reply: lines.join("\n"),
    sources: [
      programmeSource("S1", "summary", "Programme snapshot", [
        ["National compliance", `${pct(k.compliance)}%`],
        ["Requirements accepted", `${fmtN(k.compliant)} of ${fmtN(k.inScope)}`],
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
  const lines = [`${asc ? "Lowest" : "Highest"} assured share by stadium:`, ""];
  lines.push(
    bullets(
      top.map((r) => {
        const a = stadiumAssurance(r.stadium, records);
        return `${r.stadium.name} (${r.cityName}): ${pct(r.assured)}% accepted, ${a.compliant} of ${a.inScope} requirements; ${r.schedule.label.toLowerCase()}, due ${r.stadium.completionYear}.`;
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
        ["Assured share", `${pct(s.assured)}%`],
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
    bullets(top.map(({ s, f }) => `${s.name}: ${findingLine(f)}`)),
  ];
  return {
    reply: lines.join("\n"),
    sources: top.slice(0, 3).map(({ s, f }, i) => findingSource(i + 1, s, f)),
    stadium: top[0]?.s,
  };
}

function stadiumGaps(stadium, records, category) {
  const ex = stadiumExposure(stadium, records);
  let open = ex.findings.filter((f) => f.level !== "controlled");
  if (category) open = open.filter((f) => f.row.requirement.category === category);
  open.sort(byLevel);
  if (!open.length)
    return {
      reply: `${stadium.name} has no open findings${category ? ` for ${category.toLowerCase()}` : ""} at the moment. Everything in scope is accepted or managed through normal delivery controls.`,
      sources: [stadiumCard(stadium, ex)],
      stadium,
    };
  const shown = open.slice(0, 5);
  const openCounts = { critical: 0, material: 0, manageable: 0, controlled: 0 };
  for (const f of open) openCounts[f.level]++;
  const lines = [
    `${stadium.name} has ${plural(open.length, "open finding")}${category ? ` for ${category.toLowerCase()}` : ""}: ${countsText(openCounts, true)}.`,
    "",
    bullets(shown.map(findingLine)),
  ];
  const more = open.length - shown.length;
  if (more > 0) lines.push("", `${more} more ${more === 1 ? "is" : "are"} on the stadium page.`);
  return {
    reply: lines.join("\n"),
    sources: [stadiumCard(stadium, ex), ...shown.slice(0, 2).map((f, i) => findingSource(i + 1, stadium, f))],
    stadium,
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

function stadiumSummary(stadium, records) {
  const a = stadiumAssurance(stadium, records);
  const ex = stadiumExposure(stadium, records);
  const schedule = schedulePosition(ex.counts);
  const by = { "evidence-submitted": 0, "non-compliant": 0, declared: 0, unassessed: 0 };
  for (const f of ex.findings) {
    const s = f.record?.status || "unassessed";
    if (s in by) by[s]++;
  }
  const open = ex.findings.filter((f) => f.level !== "controlled").sort(byLevel);
  const lines = [
    `${stadium.name} (${cityOf(stadium)}): ${statusText(stadium).toLowerCase()}, due ${stadium.completionYear}, highest match ${matchText(stadium)}.`,
    "",
    bullets([
      `${pct(a.assured)}% of in-scope requirements accepted (${a.compliant} of ${a.inScope}).`,
      `Exposure: ${countsText(ex.counts)}. Schedule: ${schedule.label.toLowerCase()}. Next gate: ${nextGate(stadium)}.`,
      `${by["evidence-submitted"]} awaiting review, ${by["non-compliant"]} non-compliant, ${by.declared} declared only, ${by.unassessed} not yet assessed.`,
    ]),
  ];
  if (open.length) lines.push("", `Most pressing: ${findingLine(open[0])}`);
  return {
    reply: lines.join("\n"),
    sources: [stadiumCard(stadium, ex), ...open.slice(0, 2).map((f, i) => findingSource(i + 1, stadium, f))],
    stadium,
  };
}

const specs = () => FIFA_CATALOGUE.evidenceSpecifications || [];
const evidenceName = (r) => r.suggestedEvidence || specs().find((s) => s.id === (r.evidenceIds || [])[0])?.name || "Supporting documents";

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
    if (status === "compliant" || (status === "unassessed" && f.level === "controlled")) continue;
    const name = evidenceName(f.row.requirement);
    need.set(name, (need.get(name) || 0) + 1);
  }
  const rows = [...need.entries()].sort((a, b) => b[1] - a[1]);
  const lines = [`Evidence position for ${stadium.name}:`, ""];
  const list = rows.map(([name, n]) => `${name}: still needed for ${plural(n, "requirement")}.`);
  if (waiting) list.push(`${plural(waiting, "submission")} already in and waiting for a reviewer decision.`);
  lines.push(list.length ? bullets(list) : "Nothing further is needed at the moment. All evidence in scope has been accepted.");
  return { reply: lines.join("\n"), sources: [stadiumCard(stadium, ex)], stadium };
}

function evidenceAnswer(q) {
  const want = [];
  const add = (id) => specs().some((s) => s.id === id) && !want.includes(id) && want.push(id);
  if (/(measure|illuminance|lux|grid|reading|test)/.test(q)) add("lighting-measurements");
  if (/(quality|flicker|glare|colour|color|rendering|temperature)/.test(q)) add("lighting-quality");
  if (/(power|continuity|ups|supply|electrical|generator)/.test(q)) add("lighting-power");
  if (/(design|maintenance|luminaire|model)/.test(q)) add("lighting-design");
  if (/(applicab|baseline|profile)/.test(q)) add("lighting-applicability");
  const lines = [];
  if (/\b(seat|seating|capacity)\b/.test(q)) lines.push("Seating: a seating plan and match allocation.");
  if (/\b(pitch|field|dimension|length|width)\b/.test(q)) lines.push("Pitch: design dimensions and a survey.");
  if (/\b(travel|hotel|route)\b/.test(q)) lines.push("Training-site access: a route and travel-time assessment.");
  const lighting = /\b(light|lights|lighting|floodlight|floodlights|lux|illuminance)\b/.test(q) || want.length || !lines.length;
  if (lighting) {
    const chosen = want.length ? want : specs().map((s) => s.id);
    for (const id of chosen) {
      const s = specs().find((x) => x.id === id);
      if (s) lines.push(`${s.name}: ${s.fields.join("; ")}.`);
    }
  }
  const excerpt = specs()
    .filter((s) => lines.some((l) => l.startsWith(s.name)))
    .map((s) => `${s.name}\n${s.reviewPurpose}`)
    .join("\n\n");
  return {
    reply: "Evidence the requirement library asks for:\n\n" + bullets(lines),
    sources: excerpt ? [{ id: "E1", kind: "document", title: "Requirement catalogue · evidence specifications", excerpt }] : [],
  };
}

// ---------- requirement lookup ----------
function searchRequirements(text) {
  const all = toks(text);
  const qw = [...new Set(all.map((w) => SYNONYMS[w] || w).filter((w) => !STOP.has(w) && w.length > 2))];
  const bigrams = [];
  for (let i = 0; i < all.length - 1; i++) if (!STOP.has(all[i]) && !STOP.has(all[i + 1])) bigrams.push(`${all[i]} ${all[i + 1]}`);
  const wantTraining = /\b(training|base camp)\b/.test(clean(text)) || /\b(travel|hotel)\b/.test(clean(text));
  if (!qw.length) return [];
  const scored = [];
  for (const r of currentRequirements()) {
    if ((r.assetType === "Training site") !== wantTraining) continue;
    const hayText = toks([r.id, r.title, r.topic, r.summary, r.condition, r.category, label(r)].join(" ")).join(" ");
    const hay = new Set(hayText.split(" "));
    let score = 0;
    for (const w of qw) if (hay.has(w)) score++;
    for (const b of bigrams) if (` ${hayText} `.includes(` ${b} `)) score += 2;
    if (score > 0) scored.push({ r, score });
  }
  if (!scored.length) return [];
  const top = Math.max(...scored.map((x) => x.score));
  return scored.filter((x) => x.score === top).map((x) => x.r);
}

function requirementAnswer(reqs) {
  const shown = reqs.slice(0, 10);
  const sameCondition = new Set(shown.map((r) => r.condition)).size === 1;
  const head = sameCondition ? `Requirements (${shown[0].condition}):` : "What the requirement library says:";
  const rows = shown.map((r) => {
    const value = r.summary || label(r);
    return sameCondition ? `${r.title}: ${value} [${r.id}]` : `${r.title} (${r.condition}): ${value} [${r.id}]`;
  });
  const lines = [head, "", bullets(rows)];
  const rest = reqs.length - shown.length;
  if (rest > 0) lines.push("", `${rest} more ${rest === 1 ? "is" : "are"} in the requirement library.`);
  const flagged = shown.find((r) => (r.reviewIssueIds || []).length);
  if (flagged) {
    const issue = (FIFA_CATALOGUE.reviewIssues || []).find((i) => i.id === flagged.reviewIssueIds[0]);
    if (issue) lines.push("", `Open review point: ${issue.title}. ${issue.detail}`);
  }
  if (shown.some((r) => r.sourceId === "fifa-lighting-guide-2020-01"))
    lines.push("", "Lighting figures come from the 2020 FIFA Lighting Guide, which is a provisional baseline for 2034.");
  lines.push("", "Applicability to each facility is still pending review.");
  return { reply: lines.join("\n"), sources: documentSources(shown) };
}

// ---------- requirement changes ----------
function scenarioFor(text) {
  const all = toks(text);
  const qw = new Set(all.map((w) => SYNONYMS[w] || w).filter((w) => !STOP.has(w) && w.length > 2));
  let best = null;
  for (const s of CHANGE_SCENARIOS) {
    const hay = new Set(toks([s.id, s.title, s.summary, s.criterion.value, s.criterion.unit].join(" ")));
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
      `${impact.before.title} changes from ${now} to ${next}.`,
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
  return {
    reply: lines.join("\n"),
    sources: documentSources([impact.before]),
  };
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
      `${c["non-compliant"]} non-compliant, waiting for new evidence.`,
      `${c.fail} where the submitted evidence is below the criterion.`,
    ]),
  ];
  if (first)
    lines.push("", `Earliest delivery first: ${first.stadium.name}, ${first.requirement.id} ${first.requirement.title}.`);
  return {
    reply: lines.join("\n"),
    sources: [
      programmeSource("S1", "summary", "Review queue", [
        ["Items waiting", c.total],
        ["Evidence submitted", c["evidence-submitted"]],
        ["Non-compliant", c["non-compliant"]],
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
        (r) => `${r.stadium.name}: ${pct(r.assured)}% accepted; ${r.schedule.label.toLowerCase()}; ${r.counts.critical} critical, ${r.counts.material} material; due ${r.stadium.completionYear}.`,
      ),
    ),
  );
  return { reply: lines.join("\n"), sources: [], stadium: rows[0].stadium };
}

function fallback() {
  return {
    reply:
      "I could not match that to a stadium, a requirement or the programme figures. Try asking about a stadium or host city, " +
      "a FIFA requirement such as seating or lighting, outstanding gaps, the evidence needed, the review queue or the latest status.",
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
  if (scenario && /\b(what if|if|would|impact|affect|effect|happen|raise|rise|rises|tighten|change|increase)\b/.test(q))
    return changeAnswer(scenario, records);

  if (/\b(review queue|queue|waiting for review|awaiting review|pending review|to review|reviewer)\b/.test(q)) return queueAnswer(records);

  const named = findStadiums(raw);
  const cue = /^(and|also|what about|how about)\b/.test(q) || /\b(it|its|there|that one|this one)\b/.test(q);
  const followUp = !named.length && words.length <= 8 && memory.stadiumId && cue;
  const stadium =
    named.length === 1 ? named[0] : followUp ? FACILITY_REGISTER.stadiums.find((s) => s.id === memory.stadiumId) : null;

  const gapsAsk = /\b(gaps?|outstanding|missing|open (items|findings|issues)|non compliant|noncompliant|failing|fail|fails|failed|shortfall|blocking|left|issues?|findings?|problems?|actions?)\b/.test(q);
  const evidenceAsk = /\b(evidence|submit|submission|proof|uploaded|intake|filed)\b/.test(q);
  const category = /\b(seat|seats|seating|capacity)\b/.test(q)
    ? "Capacity"
    : /\b(pitch|field|length|width)\b/.test(q)
      ? "Pitch"
      : /\b(light|lights|lighting|floodlight|floodlights|lux)\b/.test(q)
        ? "Lighting"
        : null;

  if (named.length > 1) {
    const names = named.map((s) => s.name);
    return { reply: `Did you mean ${names.slice(0, -1).join(", ")} or ${names.at(-1)}?`, sources: [] };
  }
  if (stadium) {
    if (evidenceAsk) return stadiumEvidence(stadium, records);
    if (gapsAsk || category) return stadiumGaps(stadium, records, category);
    return stadiumSummary(stadium, records);
  }

  if (
    (/\b(lowest|least|worst|weakest|bottom|highest|best|strongest|top)\b/.test(q) && /\b(assur|complian|ready|readiness|share|stadium|venue|progress)/.test(q)) ||
    /\b(most|least) (ready|compliant|advanced|assured|progressed)\b/.test(q) ||
    /\b(furthest|closest) (ahead|behind)\b/.test(q)
  )
    return ranking(q, records);
  if (/\b(at risk|critical|exposure|exposed|material|off track|behind)\b/.test(q)) return atRisk(q, records);
  if (gapsAsk && !category) return nationalGaps(records);
  if (evidenceAsk || /\bevidence\b/.test(q)) return evidenceAnswer(q);

  const reqs = searchRequirements(raw);
  if (reqs.length) return requirementAnswer(reqs);

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
