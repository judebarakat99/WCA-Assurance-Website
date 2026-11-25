// The compliance and evidence agent. Given the text of a document that has come in, it works out which stadium the
// document is about, which requirements in the register it speaks to and what it states for each, checks every
// stated value against the requirement's criterion and against what is already on record, notes what is missing,
// and prepares an alert for the owner of each gap.
//
// Pure: no storage and no UI. lib/store/intakeLocal files the result; the pages show it.
import { assessmentKey, evaluate, stadiumApplicability } from "@/lib/domain/assessment.mjs";
import { criterionLabel } from "@/lib/domain/fifa-catalogue.mjs";
import { FACILITY_REGISTER, capacityRequirement } from "@/lib/domain/facilities.mjs";
import { ownerFor } from "@/lib/domain/mitigation.mjs";
import { currentRequirements } from "@/lib/domain/requirementVersions.mjs";
import { familyById } from "@/lib/register/data.mjs";

// ---------- text helpers ----------
const STOP = new Set(
  ("a an the of for to in on at is are be and or with from by as this that these those it its per all any each " +
    "stadium stadiums area areas room rooms facility facilities requirement requirements").split(" "),
);
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/** Lower case, punctuation removed, "back-up" and similar spellings made uniform. */
function normal(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/back[\s-]?up/g, "backup")
    .replace(/stand[\s-]?by/g, "standby")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9%.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
const words = (text) =>
  normal(text)
    .split(" ")
    .map((w) => w.replace(/^\.+|\.+$/g, ""))
    .filter((w) => w.length > 2 && !STOP.has(w));
const has = (label, phrase) => ` ${label} `.includes(` ${phrase} `) || ` ${label} `.includes(` ${phrase}s `);
const fmtNum = (n) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
/** "1 screen", "2 screens": the unit agrees with the number. */
const withUnit = (n, unit) => `${fmtNum(n)}${unit ? ` ${Number(n) === 1 && /s$/.test(unit) && !/%|m²/.test(unit) ? unit.replace(/s$/, "") : unit}` : ""}`;
const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

// ---------- stadiums ----------
const EXTRA_ALIASES = {
  "king-salman-international": ["ksis", "salman international"],
  "prince-mohammed-bin-salman": ["pmbs", "mohammed bin salman"],
  "king-abdullah-economic-city": ["kaec", "economic city"],
  "king-abdullah-sports-city": ["jeddah sports city"],
  "prince-faisal-bin-fahad": ["faisal bin fahad"],
  "new-murabba": ["murabba"],
  "jeddah-central-development": ["jeddah central"],
  "king-fahad-sports-city": ["kfsc"],
};
function aliasesOf(s) {
  const base = normal(s.name.replace(/stadium/i, ""));
  const list = new Set([base, s.id.replace(/-/g, " "), ...(EXTRA_ALIASES[s.id] || [])]);
  const short = base.replace(/\b(sports city|economic city|university|development|international|sports)\b/g, "").replace(/\s+/g, " ").trim();
  if (short.split(" ").length >= 2) list.add(short);
  return [...list].filter(Boolean);
}
const ALIASES = FACILITY_REGISTER.stadiums.map((s) => ({ stadium: s, aliases: aliasesOf(s) }));

/** How often each stadium is named in a text: Map(stadiumId -> count). */
function stadiumMentions(text) {
  const padded = ` ${normal(text)} `;
  const out = new Map();
  for (const { stadium, aliases } of ALIASES) {
    let best = 0;
    for (const a of aliases) {
      if (a.length < 4) continue;
      const n = padded.split(` ${a} `).length - 1;
      best = Math.max(best, n);
    }
    if (best) out.set(stadium.id, best);
  }
  return out;
}
const top = (counts) => [...counts].sort((a, b) => b[1] - a[1])[0] || null;

// ---------- what a document says about itself ----------
function findRevision(text) {
  const m = /\brev(?:ision)?\.?[\s:_-]*([A-Z]\d?|\d{1,2}[A-Z]?)\b/i.exec(text);
  return m ? m[1].toUpperCase() : null;
}
function findDate(text) {
  const candidates = [];
  const push = (index, y, m, d) => {
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) candidates.push({ index, date: iso(y, m, d) });
  };
  for (const m of text.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)) push(m.index, +m[1], +m[2], +m[3]);
  for (const m of text.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(20\d{2})\b/g)) {
    const month = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (month) push(m.index, +m[3], month, +m[1]);
  }
  for (const m of text.matchAll(/\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2})\b/g)) push(m.index, +m[3], +m[2], +m[1]);
  if (!candidates.length) return null;
  const labelled = candidates.find((c) => /date|issued|dated|as at|as of/i.test(text.slice(Math.max(0, c.index - 24), c.index)));
  return (labelled || candidates[0]).date;
}
const SIGNED = /\b(approved|signed|signature|certified|endorsed|witnessed|accepted by|issued for (?:construction|approval)|authori[sz]ed)\b/i;
const DOC_TYPE = /\b(drawing|calculation|test (?:report|record|result)|certificate|survey|specification|schedule|plan|statement|method statement|report|record|layout|design)\b/i;
// A line that talks about an earlier version gives that version's figures, not this document's.
const PRIOR = /\b(supersede[sd]?|replaces|replaced|previous(?:ly)?|formerly|earlier|prior|was)\b/i;
const CLAIMS = /\b(complies|complying|is compliant|are compliant|fully compliant|meets|satisfies|conforms|achieves)\b/i;
const SUPERSEDES = /\b(supersede[sd]?|replaces|replaced|resubmi\w+|revised (?:from|figure|value|layout)|updated (?:from|figure|value|layout))\b/i;

// ---------- quantities ----------
const UNIT_KEY = {
  "m²": "m²",
  m: "m",
  seats: "seats",
  hours: "hours",
  "% of seats": "%",
  screens: "screens",
  "TV positions": "positions",
  "perimeter lines": "lines",
  "seats per point of sale": "seats-per-pos",
  STI: "sti",
};
const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const toNumber = (s) => {
  const lower = String(s).toLowerCase();
  return NUMBER_WORDS[lower] ?? Number(lower.replace(/,/g, ""));
};

/** Every quantity on a line: { value, unit (key), index, length }. */
function quantities(line) {
  const found = [];
  const add = (re, unit, group = 1) => {
    for (const m of line.matchAll(re)) {
      const value = toNumber(m[group]);
      if (Number.isFinite(value)) found.push({ value, unit, index: m.index, length: m[0].length });
    }
  };
  add(/\bSTI\b\s*(?:of|is|[:=≥>])?\s*(\d?\.\d+)/gi, "sti");
  add(/(\d[\d,]*)\s*seats?\s*(?:per|\/)\s*(?:point|pos\b|outlet|concession)/gi, "seats-per-pos");
  add(/(?:points?\s+of\s+sale|outlets?|concessions?|pos)\b[^0-9]{0,40}?(?:per|for every|for each|every)\s*(\d[\d,]*)\s*seats?/gi, "seats-per-pos");
  add(/(\d+(?:\.\d+)?)\s*(?:%|per ?cent|percent)/gi, "%");
  add(/(\d[\d,]*(?:\.\d+)?)\s*(?:m²|m2|sqm|sq\.?\s?m\b|square\s+met(?:re|er)s?)/gi, "m²");
  add(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/gi, "hours");
  add(/(\d+(?:\.\d+)?)\s*(?:m|metres?|meters?)\b(?![²2\d])/gi, "m");
  add(/(\d[\d,]*)\s*(?:seats?|seated)\b(?!\s*(?:per|\/))/gi, "seats");
  add(/(\d+)\s+(?:[A-Za-z-]+\s+){0,2}?(?:screens?|displays?|scoreboards?)\b/gi, "screens");
  add(/(\d+)\s+(?:[A-Za-z-]+\s+){0,2}?positions?\b/gi, "positions");
  add(/\b(\d+|one|two|three|four)\s+(?:[A-Za-z-]+\s+){0,2}?(?:perimeters?|perimeter lines?)\b/gi, "lines");
  // keep the most specific reading where two patterns hit the same digits (for example "5 seats per point")
  return found.filter(
    (q, i) => !found.some((o, j) => j !== i && o.index <= q.index && o.index + o.length >= q.index + q.length && o.length > q.length),
  );
}

// ---------- which requirement a line is about ----------
// any: phrases that name the requirement; not: phrases that mean the line is about something else.
const KEYWORDS = {
  "STA-0004": { any: ["seating capacity", "total seats", "total capacity", "spectator capacity", "gross capacity", "net capacity", "stadium capacity"], not: ["bench", "accessible", "wheelchair", "media", "hospitality", "vip", "press"], atLeast: 5000 },
  "STA-0007": { any: ["accessible seating", "accessible seats", "wheelchair", "disabled spectator", "disabled seating", "accessible spaces", "mobility"] },
  "STA-0015": { any: ["concession", "point of sale", "points of sale", "food and beverage", "food service"] },
  "STA-0020": { any: ["run off", "runoff", "auxiliary area", "touchline", "goal line", "perimeter run"] },
  "STA-0028": { any: ["warm up area", "warm up", "warming up"], not: ["gym", "exercise", "room"] },
  "STA-0029": { any: ["bench", "technical area", "substitutes"] },
  "STA-0030": { any: ["tunnel"], not: ["height", "high", "length", "long", "staging", "slope", "gradient"] },
  "STA-0034": { any: ["team dressing", "dressing room", "changing room", "players room", "player room", "team room"], not: ["referee", "official", "officials", "delegate", "coach", "ball kid"] },
  "STA-0035": { any: ["referee", "officials dressing", "match officials", "officials room"] },
  "STA-0038": { any: ["medical room", "player medical", "treatment room", "medical treatment"], not: ["spectator", "crowd", "public", "access"] },
  "STA-0039": { any: ["doping", "drug test"] },
  "STA-0040": { any: ["mixed zone"] },
  "STA-0042": { any: ["press conference", "media conference", "news conference"] },
  "STA-0043": { any: ["match delegate", "event management office", "event management", "delegate room"] },
  "STA-0047": { any: ["perimeter"] },
  "STA-0066": { any: ["commentary position", "commentary positions", "commentator", "tv commentary", "radio commentary"] },
  "STA-0068": { any: ["broadcast compound", "tv compound", "compound area", "compound"] },
  "STA-0087": { any: ["backup", "generator", "ups", "standby power", "power outage", "autonomy", "emergency power"] },
  "STA-0093": { any: ["speech intelligibility", "sti", "public address", "pa system", "voice alarm"] },
  "STA-0094": { any: ["screen", "scoreboard", "video display", "giant screen"] },
};

function scoreLabel(requirement, label, value) {
  const kw = KEYWORDS[requirement.id];
  if (kw) {
    if (kw.atLeast && !(value >= kw.atLeast)) return 0;
    if ((kw.not || []).some((p) => has(label, p))) return 0;
    const hit = kw.any.filter((p) => has(label, p)).sort((a, b) => b.length - a.length)[0];
    if (hit) return 3 + (hit.length > 8 ? 0.5 : 0);
  }
  return 0;
}

function strongTitleScore(requirement, label) {
  const title = [...new Set(words(requirement.title))];
  const lineWords = new Set(label.split(" "));
  const overlap = title.filter((w) => lineWords.has(w) || lineWords.has(`${w}s`) || (w.endsWith("s") && lineWords.has(w.slice(0, -1)))).length;
  return overlap >= 3 && overlap / title.length >= 0.75 ? overlap : 0;
}

function titleScore(requirement, label) {
  const title = [...new Set(words(requirement.title))];
  if (title.length < 2) return 0;
  const lineWords = new Set(label.split(" "));
  const overlap = title.filter((w) => lineWords.has(w) || lineWords.has(`${w}s`) || (w.endsWith("s") && lineWords.has(w.slice(0, -1)))).length;
  return overlap >= 2 && overlap / title.length >= 0.6 ? overlap : 0;
}

// ---------- the agent ----------
/**
 * Analyse one document.
 * doc: { name, size, pages: [{ n, text }], readable }
 * records: the assessment records (lib/store/assessments getAssessments())
 * now: today's date (a Date), for due dates and for judging how old a document is.
 */
export function analyseDocument(doc, records, now = new Date(), options = {}) {
  const pages = doc.readable ? doc.pages : [];
  const fullText = pages.map((p) => p.text).join("\n");
  const fileText = String(doc.name || "").replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ");
  const steps = [];
  const step = (label, detail, ok = true) => steps.push({ label, detail, ok });
  const lines = [];
  for (const p of pages) p.text.split("\n").forEach((text, i) => text.trim() && lines.push({ text: text.trim(), page: p.n, line: i + 1 }));

  step(
    "Read the document",
    doc.readable
      ? `${doc.name}: ${lines.length} lines on ${pages.length} page${pages.length === 1 ? "" : "s"}.`
      : `${doc.name}: no text could be read from this file, so it was identified from the file name only.`,
    doc.readable,
  );

  // 1. the stadium
  const inText = stadiumMentions(fullText);
  const inName = stadiumMentions(fileText);
  const textTop = top(inText);
  const nameTop = top(inName);
  const stadiumId = options.stadiumId || textTop?.[0] || nameTop?.[0] || null;
  const stadium = FACILITY_REGISTER.stadiums.find((s) => s.id === stadiumId) || null;
  const inconsistencies = [];
  const missing = [];
  if (options.stadiumId && textTop && textTop[0] !== options.stadiumId) {
    const chosen = FACILITY_REGISTER.stadiums.find((s) => s.id === options.stadiumId)?.name;
    const named = FACILITY_REGISTER.stadiums.find((s) => s.id === textTop[0])?.name;
    inconsistencies.push({ severity: "medium", kind: "stadium", text: `You assigned this document to ${chosen}, but its text is about ${named}.` });
  } else if (!options.stadiumId && textTop && nameTop && textTop[0] !== nameTop[0]) {
    const a = FACILITY_REGISTER.stadiums.find((s) => s.id === nameTop[0]).name;
    const b = FACILITY_REGISTER.stadiums.find((s) => s.id === textTop[0]).name;
    inconsistencies.push({ severity: "medium", kind: "stadium", text: `The file name points to ${a}, but the document is about ${b}.` });
  }
  const second = [...inText].sort((a, b) => b[1] - a[1])[1];
  if (textTop && second && second[1] >= 2 && second[1] >= textTop[1] / 2) {
    const other = FACILITY_REGISTER.stadiums.find((s) => s.id === second[0]).name;
    inconsistencies.push({ severity: "low", kind: "stadium", text: `The document also refers to ${other}; check that it belongs to one stadium only.` });
  }
  step(
    "Identified the stadium",
    stadium ? `${stadium.name}${textTop && textTop[0] === stadium.id ? ` (named ${textTop[1]} time${textTop[1] === 1 ? "" : "s"} in the text)` : options.stadiumId ? " (chosen by you)" : " (from the file name)"}.` : "No registered stadium is named in the document or its file name.",
    !!stadium,
  );

  const revision = findRevision(fullText) || findRevision(fileText);
  const fileDate = /\b(20\d{2})(\d{2})(\d{2})\b/.exec(doc.name);
  const asOfDate = findDate(fullText) || (fileDate ? iso(+fileDate[1], +fileDate[2], +fileDate[3]) : null);

  // 2. requirements and values
  const reqs = currentRequirements().filter((r) => r.appliesTo.includes("stadium"));
  const inScope = (r) => (stadium ? stadiumApplicability(stadium, r).value !== "not-applicable" : true);
  const matches = new Map(); // requirement id -> { requirement, items: [{ value, unit, line, page, via }], via }
  const claim = (req, item) => {
    const cur = matches.get(req.id) || { requirement: req, items: [], via: item.via };
    cur.items.push(item);
    matches.set(req.id, cur);
  };

  // explicit requirement ids
  for (const [index, ln] of lines.entries()) {
    for (const idm of ln.text.matchAll(/\b(STA|ASS)-\d{4}\b/g)) {
      const req = reqs.find((r) => r.id === idm[0]);
      if (!req || !inScope(req)) continue;
      const want = UNIT_KEY[req.criterion.unit];
      const near = [ln, lines[index + 1]].filter(Boolean);
      let taken = false;
      for (const l of near) {
        const q = PRIOR.test(l.text) ? null : quantities(l.text).find((x) => x.unit === want);
        if (q && want) { claim(req, { ...q, text: l.text, page: l.page, via: "id" }); taken = true; break; }
      }
      if (!taken) claim(req, { value: null, unit: want, text: ln.text, page: ln.page, via: "id" });
    }
  }
  // file name ids (when the text could not be read)
  for (const idm of fileText.matchAll(/\b(STA|ASS)\s?-?\s?(\d{4})\b/gi)) {
    const req = reqs.find((r) => r.id === `${idm[1].toUpperCase()}-${idm[2]}`);
    if (req && inScope(req) && !matches.has(req.id)) claim(req, { value: null, unit: UNIT_KEY[req.criterion.unit], text: doc.name, page: 1, via: "name" });
  }

  // values by what the line is about
  let previous = null;
  for (const ln of lines) {
    const qs = PRIOR.test(ln.text) ? [] : quantities(ln.text);
    if (qs.length) {
      let label = normal(ln.text.replace(/\d[\d,]*(?:\.\d+)?/g, " "));
      if (words(label).length === 0 && previous) label = normal(previous.text);
      for (const q of qs) {
        const scored = reqs
          .filter((r) => (r.criterion.operator !== "manual" || r.id === "STA-0004") && (r.id === "STA-0004" ? q.unit === "seats" : UNIT_KEY[r.criterion.unit] === q.unit) && inScope(r))
          .map((r) => ({ r, s: scoreLabel(r, label, q.value) || (r.id === "STA-0004" ? 0 : titleScore(r, label)) }))
          .filter((x) => x.s >= 2)
          .sort((a, b) => b.s - a.s);
        if (!scored.length) continue;
        if (scored.length > 1 && scored[0].s === scored[1].s && scored[0].r.id !== scored[1].r.id) continue; // ambiguous: leave it to the reviewer
        claim(scored[0].r, { ...q, text: ln.text, page: ln.page, via: "keyword" });
      }
    }
    previous = ln;
  }
  // the field of play is stated as one size, length by width
  const fieldReq = reqs.find((r) => r.id === "STA-0018");
  if (fieldReq && inScope(fieldReq)) {
    for (const ln of lines) {
      const m = /(\d{2,3}(?:\.\d+)?)\s*(?:m|metres?|meters?)?\s*(?:[x×]|by)\s*(\d{2,3}(?:\.\d+)?)\s*(?:m|metres?|meters?)?/i.exec(ln.text);
      if (m && /field of play|playing (?:field|area)|pitch/i.test(ln.text)) {
        const a = Number(m[1]);
        const b = Number(m[2]);
        const ok = Math.abs(a - 105) < 0.01 && Math.abs(b - 68) < 0.01;
        claim(fieldReq, { value: `${fmtNum(a)} × ${fmtNum(b)}`, unit: "m", text: ln.text, page: ln.page, via: "keyword", override: ok ? "pass" : "fail" });
        break;
      }
    }
  }
  // requirements named without a figure (no value to check, but the reviewer should see them)
  const manual = reqs
    .filter((r) => r.criterion.operator === "manual" && inScope(r) && !matches.has(r.id) && r.id !== "STA-0018")
    .map((r) => {
      let best = null;
      for (const ln of lines) {
        const s = strongTitleScore(r, normal(ln.text));
        if (s && (!best || s > best.s)) best = { s, ln };
      }
      return best && { r, ...best };
    })
    .filter(Boolean)
    .sort((a, b) => b.s - a.s)
    .slice(0, 5);
  for (const m of manual) claim(m.r, { value: null, unit: null, text: m.ln.text, page: m.ln.page, via: "title" });

  // 3. check each match
  const stadiumRecords = (req) => (stadium ? records[assessmentKey(stadium.id, req)] : null);
  const results = [];
  for (const { requirement: req0, items, via } of matches.values()) {
    const req = req0.id === "STA-0004" && stadium ? { ...req0, ...capacityRequirement(stadium), id: req0.id } : req0;
    const op = req.criterion.operator;
    const numeric = items.filter((i) => typeof i.value === "number");
    let item = items[0];
    if (numeric.length) {
      // the worst figure is the one that decides it
      item = [...numeric].sort((a, b) => (op === "max" || op === "lte" || op === "lt" ? b.value - a.value : a.value - b.value))[0];
      if (op === "eq" || op === "range") item = numeric.find((n) => evaluate(req.criterion, n.value) === "fail") || numeric[0];
    }
    const hasValue = item.value !== null && item.value !== undefined;
    const check = item.override || (hasValue && op !== "manual" ? evaluate(req.criterion, item.value) : "needs-review");
    const record = stadiumRecords(req0);
    const onRecord = record
      ? { status: record.status, partial: !!record.partial, value: record.evidence?.at(-1)?.value ?? null, file: record.evidence?.at(-1)?.file ?? null, on: record.evidence?.at(-1)?.on ?? null }
      : null;
    const verdict = !hasValue ? (via === "title" ? "review" : "not-stated") : check === "pass" ? "meets" : check === "fail" ? "below" : "review";
    results.push({
      requirement_id: req.id,
      title: req.title,
      family_id: req.familyId,
      family: familyById(req.familyId)?.name || req.category,
      section: req.section,
      criterion_label: op === "manual" ? (req.id === "STA-0018" ? "105 × 68 m" : "Threshold to be confirmed") : criterionLabel(req.criterion),
      value: hasValue ? (typeof item.value === "number" ? String(item.value) : item.value) : null,
      unit: op === "manual" ? (item.unit || null) : req.criterion.unit,
      check,
      verdict,
      quote: item.text.length > 150 ? `${item.text.slice(0, 147)}…` : item.text,
      page: item.page,
      via,
      record: via !== "title", // a requirement only mentioned by name is shown, not recorded
      all_values: numeric.map((n) => n.value),
      on_record: onRecord,
    });
  }
  results.sort((a, b) => ({ below: 0, "not-stated": 1, review: 2, meets: 3 })[a.verdict] - ({ below: 0, "not-stated": 1, review: 2, meets: 3 })[b.verdict] || a.requirement_id.localeCompare(b.requirement_id));

  const nMeet = results.filter((r) => r.verdict === "meets").length;
  const nBelow = results.filter((r) => r.verdict === "below").length;
  const nOther = results.length - nMeet - nBelow;
  const families = [...new Set(results.map((r) => r.family_id))].sort();
  step(
    "Matched requirements in the register",
    results.length
      ? `${results.length} requirement${results.length === 1 ? "" : "s"} in ${families.length} chapter${families.length === 1 ? "" : "s"}: ${results.slice(0, 4).map((r) => r.requirement_id).join(", ")}${results.length > 4 ? "…" : ""}.`
      : "Nothing in the document matches a requirement that applies to this stadium.",
    results.length > 0,
  );
  const stated = results.filter((r) => r.value !== null);
  step(
    "Read the stated values",
    stated.length ? stated.slice(0, 3).map((r) => `${r.title}: ${r.value}${r.unit ? ` ${r.unit}` : ""}`).join("; ") + (stated.length > 3 ? "…" : "") + "." : "The document states no figure that matches a requirement.",
    stated.length > 0 || results.length === 0,
  );
  step(
    "Checked against the criteria",
    results.length ? `${nMeet} meet the criterion, ${nBelow} fall below it, ${nOther} need a reviewer's judgement.` : "Nothing to check.",
    nBelow === 0,
  );

  // 4. cross-check with the register
  for (const r of results) {
    const rec = r.on_record;
    const resubmission = SUPERSEDES.test(fullText) && !!revision;
    if (rec && r.value !== null && rec.value !== null && rec.value !== "" && Number.isFinite(Number(rec.value)) && Number.isFinite(Number(r.value))) {
      const a = Number(r.value);
      const b = Number(rec.value);
      const rel = Math.abs(a - b) / Math.max(Math.abs(b), 1e-9);
      const failing = rec.status === "non-compliant";
      if (rel > 0.02 && failing && r.verdict === "meets") {
        r.note = `Improves on the ${withUnit(b, r.unit)} on record; the reviewer decides whether it clears the finding.`;
        r.improves = true;
      } else if (rel > 0.05 && !resubmission && !(rec.status === "compliant" && r.verdict === "below"))
        inconsistencies.push({ severity: "medium", kind: "record", requirement_id: r.requirement_id, text: `${r.title}: this document states ${fmtNum(a)}${r.unit ? ` ${r.unit}` : ""}, but ${fmtNum(b)} is on record${rec.file ? ` (${rec.file})` : ""}.` });
      else if (rel > 0.05 && resubmission)
        r.note = `Revised figure: ${fmtNum(b)} on record, ${fmtNum(a)} now.`;
    }
    if (rec && rec.status === "compliant" && r.verdict === "below") {
      r.reopens = true;
      inconsistencies.push({ severity: "high", kind: "reopen", requirement_id: r.requirement_id, text: `${r.title} is recorded as compliant, but this document states ${r.value}${r.unit ? ` ${r.unit}` : ""}, which is below ${r.criterion_label}.` });
    }
  }
  const claimLine = lines.find((l) => CLAIMS.test(l.text) && !/\b(not|no longer|does not|fails?|below|except)\b/i.test(l.text) && !/\d/.test(l.text));
  const falling = results.filter((r) => r.verdict === "below");
  if (claimLine && falling.length)
    inconsistencies.push({
      severity: "high",
      kind: "claim",
      requirement_id: falling[0].requirement_id,
      text: `The document states “${claimLine.text.length > 90 ? `${claimLine.text.slice(0, 87)}…` : claimLine.text}”, but ${falling.map((r) => `${r.title.toLowerCase()} (${r.value}${r.unit ? ` ${r.unit}` : ""})`).join(" and ")} fall${falling.length === 1 ? "s" : ""} below the criterion.`,
    });
  // the declared capacity
  if (stadium) {
    for (const ln of lines) {
      if (!/\bgross\b/i.test(ln.text)) continue;
      const q = quantities(ln.text).find((x) => x.unit === "seats");
      if (!q) continue;
      const diff = Math.abs(q.value - stadium.grossCapacity) / stadium.grossCapacity;
      if (diff > 0.02) {
        inconsistencies.push({ severity: "medium", kind: "capacity", requirement_id: "STA-0003", text: `Gross capacity is stated as ${fmtNum(q.value)} seats, but the register declares ${fmtNum(stadium.grossCapacity)} (${(diff * 100).toFixed(1)}% apart).` });
        break;
      }
    }
  }
  // age
  if (asOfDate && stadium) {
    const newest = results.map((r) => r.on_record?.on).filter(Boolean).sort().at(-1);
    if (newest && asOfDate < newest)
      inconsistencies.push({ severity: "low", kind: "age", text: `The document is dated ${asOfDate}, earlier than evidence already on record (${newest}).` });
    if (daysBetween(asOfDate, now.toISOString().slice(0, 10)) > 365)
      inconsistencies.push({ severity: "low", kind: "age", text: `The document is dated ${asOfDate}, more than a year ago.` });
  }
  step(
    "Cross-checked with the register",
    inconsistencies.length ? `${inconsistencies.length} inconsistenc${inconsistencies.length === 1 ? "y" : "ies"} found.` : "The figures agree with what is already on record.",
    inconsistencies.length === 0,
  );

  // 5. what is missing
  for (const r of results) {
    if (r.verdict === "not-stated" && r.via !== "title")
      missing.push({ severity: "medium", kind: "value", requirement_id: r.requirement_id, text: `${r.title}: the document names the requirement but states no figure.` });
  }
  if (doc.readable && results.length) {
    if (!SIGNED.test(fullText)) missing.push({ severity: "medium", kind: "approval", text: "No approval, sign-off or certification is stated, so the document is not yet usable as evidence." });
    if (!asOfDate) missing.push({ severity: "medium", kind: "date", text: "The document has no date." });
    if (!revision) missing.push({ severity: "low", kind: "revision", text: "The document has no revision or issue status." });
    if (!DOC_TYPE.test(fullText)) missing.push({ severity: "low", kind: "type", text: "The document does not identify itself as a drawing, calculation, test record or certificate." });
  }
  if (stadium) {
    const done = new Set(results.map((r) => r.requirement_id));
    const sections = [...new Set(results.map((r) => r.section))];
    for (const section of sections.slice(0, 3)) {
      const open = reqs.filter(
        (r) => r.section === section && !done.has(r.id) && inScope(r) && !records[assessmentKey(stadium.id, r)]?.evidence?.length,
      );
      if (open.length)
        missing.push({ severity: "low", kind: "gap", requirement_id: open[0].id, text: `Section ${section.split(" ")[0]} still has no evidence for ${open.slice(0, 3).map((r) => `${r.id} ${r.title}`).join("; ")}${open.length > 3 ? ` and ${open.length - 3} more` : ""}.` });
    }
  }
  step("Checked what is missing", missing.length ? `${missing.length} gap${missing.length === 1 ? "" : "s"} found.` : "Nothing is missing.", missing.length === 0);

  // 6. alerts for the owners
  const rank = { high: 0, medium: 1, low: 2 };
  const alerts = [];
  const ownerOf = (id) => {
    const req = reqs.find((r) => r.id === id) || reqs.find((r) => r.id === results[0]?.requirement_id);
    return req && stadium ? ownerFor(stadium.id, req) : "Stadium delivery team";
  };
  for (const r of results) {
    if (r.verdict === "below")
      alerts.push({
        requirement_id: r.requirement_id, kind: "below-criterion", severity: "high", owner: ownerOf(r.requirement_id),
        title: `${r.title}: ${r.value}${r.unit ? ` ${r.unit}` : ""} is below ${r.criterion_label}`,
        detail: `${doc.name} states ${r.value}${r.unit ? ` ${r.unit}` : ""}${r.reopens ? "; the requirement is currently recorded as compliant" : ""}.`,
        action: `Resubmit evidence that meets ${r.criterion_label}, or raise a design change.`,
      });
  }
  const docGaps = missing.filter((x) => ["approval", "date", "revision", "type"].includes(x.kind));
  if (docGaps.length && docGaps.some((x) => x.severity === "medium")) {
    const parts = docGaps.map((x) => ({ approval: "approval or sign-off", date: "a date", revision: "a revision", type: "a document type" })[x.kind]);
    const what = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0];
    alerts.push({
      requirement_id: results[0]?.requirement_id || null,
      kind: "missing-evidence",
      severity: "medium",
      owner: ownerOf(results[0]?.requirement_id),
      title: `${doc.name} cannot be used as evidence yet: it is missing ${what}`,
      detail: docGaps.map((x) => x.text).join(" "),
      action: "Resubmit the document with what is missing.",
    });
  }
  for (const x of [...inconsistencies, ...missing]) {
    if (x.kind === "reopen" || x.kind === "age" || x.kind === "gap" || x.kind === "revision" || x.kind === "type") continue;
    if (["approval", "date"].includes(x.kind)) continue; // combined above
    if (x.severity === "low") continue;
    alerts.push({
      requirement_id: x.requirement_id || null,
      kind: missing.includes(x) ? "missing-evidence" : "inconsistency",
      severity: x.severity,
      owner: ownerOf(x.requirement_id),
      title: x.text.length > 110 ? `${x.text.slice(0, 107)}…` : x.text,
      detail: x.text,
      action: missing.includes(x) ? "Resubmit the document with what is missing." : "Confirm which figure is right and correct the document or the register.",
    });
  }
  alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
  const seen = new Set();
  const unique = alerts.filter((a) => {
    const key = `${a.kind}|${a.requirement_id}|${a.title}`;
    return seen.has(key) ? false : (seen.add(key), true);
  });
  step("Prepared alerts for the owners", unique.length ? `${unique.length} alert${unique.length === 1 ? "" : "s"}, for ${[...new Set(unique.map((a) => a.owner))].join(" and ")}.` : "No alert is needed.", unique.length === 0);

  // 7. what to file
  const named = results.filter((r) => r.via === "id" || r.via === "keyword" || r.via === "name");
  const confidence = !stadium || !results.length || !doc.readable ? "low" : textTop && !inconsistencies.some((i) => i.kind === "stadium" && i.severity !== "low") && named.length ? "high" : "medium";
  const lead = results.find((r) => r.value !== null) || results[0];
  return {
    kind: stadium && results.length ? "evidence" : "other",
    stadium_id: stadium?.id || null,
    as_of: asOfDate,
    revision,
    confidence,
    evidence_quote: lead ? lead.quote : null,
    evidence_page: lead ? lead.page : null,
    requirement_ids: results.map((r) => r.requirement_id),
    analysis: {
      steps,
      matches: results,
      missing,
      inconsistencies,
      alerts: unique.slice(0, 8),
      readable: !!doc.readable,
    },
  };
}
