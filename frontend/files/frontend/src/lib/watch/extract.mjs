// The requirement extraction agent. Given the text of a FIFA circular, an amendment or a note typed by a person, it
// finds the statements that set a requirement, reads the figure in each, and decides for each one whether it
//   - amends a requirement that is already in the register (a new figure for the same requirement),
//   - is already in force (the register has that figure),
//   - or is a new requirement that the register does not have yet.
// Pure: no storage and no UI. lib/watch/custom stores what a person chooses to add; lib/watch/actions assesses it.
import { currentRequirements } from "@/lib/domain/requirementVersions.mjs";
import { FAMILIES } from "@/lib/register/data.mjs";
import { criterionText } from "@/lib/reports/text.mjs";
import { describeShift } from "@/lib/watch/impact.mjs";

// ---------- text ----------
const STOP = new Set(
  ("a an the of for to in on at is are be and or with from by as this that these those it its per all any each every " +
    "stadium stadiums room rooms area areas facility facilities requirement requirements shall must should will can may").split(" "),
);
function normal(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/back[\s-]?up/g, "backup")
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

// ---------- quantities ----------
const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12 };
const toNumber = (s) => {
  const lower = String(s).toLowerCase();
  return NUMBER_WORDS[lower] ?? Number(lower.replace(/,/g, ""));
};
const N = String.raw`(\d[\d,]*(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|twelve)`;
const UNITS = [
  { key: "sti", unit: "STI", re: /\bSTI\b\s*(?:of|is|at least|[:=])?\s*(\d?\.\d+)/gi },
  { key: "seats-per-pos", unit: "seats per point of sale", re: new RegExp(`${N}\\s*seats?\\s*(?:per|\\/)\\s*(?:point|pos\\b|outlet|concession)`, "gi") },
  { key: "%", unit: "%", re: new RegExp(`${N}\\s*(?:%|per ?cent|percent)`, "gi") },
  { key: "m²", unit: "m²", re: new RegExp(`${N}\\s*(?:m²|m2|sqm|sq\\.?\\s?m\\b|square\\s+met(?:re|er)s?)`, "gi") },
  { key: "hours", unit: "hours", re: new RegExp(`${N}\\s*(?:hours?|hrs?)\\b`, "gi") },
  { key: "minutes", unit: "minutes", re: new RegExp(`${N}\\s*(?:minutes?|mins?)\\b`, "gi") },
  { key: "m", unit: "m", re: new RegExp(`${N}\\s*(?:m|metres?|meters?)\\b(?![²2\\d])`, "gi") },
  { key: "seats", unit: "seats", re: new RegExp(`${N}\\s*(?:seats?|seated)\\b(?!\\s*(?:per|\\/))`, "gi") },
  { key: "screens", unit: "screens", re: new RegExp(`${N}\\s+(?:[A-Za-z-]+\\s+){0,2}?(?:screens?|displays?|scoreboards?)\\b`, "gi") },
  { key: "positions", unit: "TV positions", re: new RegExp(`${N}\\s+(?:[A-Za-z-]+\\s+){0,2}?positions?\\b`, "gi") },
  { key: "lines", unit: "perimeter lines", re: new RegExp(`${N}\\s+(?:[A-Za-z-]+\\s+){0,2}?(?:perimeters?|perimeter lines?)\\b`, "gi") },
];
// A number followed by a plural noun that no unit above covers: "4 quiet rooms", "two exits".
const COUNT = new RegExp(`${N}\\s+((?:[a-z-]+\\s+){0,2}?[a-z]{3,}s)\\b`, "gi");
const NOT_COUNT = /^(days?|years?|months?|weeks?|times|minutes|hours|metres|meters|per|percent|points?|pages?|stadiums|seats|screens)$/i;

/** Every quantity in a sentence: { value, unit, key, index, length }. */
export function quantities(line) {
  const found = [];
  for (const u of UNITS)
    for (const m of line.matchAll(u.re)) {
      const value = toNumber(m[1]);
      if (Number.isFinite(value)) found.push({ value, unit: u.unit, key: u.key, index: m.index, length: m[0].length });
    }
  for (const m of line.matchAll(COUNT)) {
    const noun = m[2].trim();
    const last = noun.split(/\s+/).at(-1);
    if (NOT_COUNT.test(last)) continue;
    const value = toNumber(m[1]);
    if (!Number.isFinite(value)) continue;
    const span = { index: m.index, length: m[0].length };
    if (found.some((q) => q.index < span.index + span.length && span.index < q.index + q.length)) continue;
    found.push({ value, unit: noun.toLowerCase(), key: "count", noun: noun.toLowerCase(), ...span });
  }
  return found
    .filter((q, i) => !found.some((o, j) => j !== i && o.index <= q.index && o.index + o.length >= q.index + q.length && o.length > q.length))
    .sort((a, b) => a.index - b.index);
}

// ---------- which requirement a statement is about ----------
// Words that name each requirement that has a figure. not: words that mean the statement is about something else.
const KEYWORDS = {
  "STA-0004": { any: ["seating capacity", "total seats", "total capacity", "spectator capacity", "gross capacity", "stadium capacity"], not: ["bench", "accessible", "wheelchair", "media", "hospitality", "vip", "press"] },
  "STA-0007": { any: ["accessible seating", "accessible seats", "wheelchair", "disabled spectator", "disabled seating", "accessible spaces", "mobility"] },
  "STA-0015": { any: ["concession", "point of sale", "points of sale", "food and beverage", "food service"] },
  "STA-0020": { any: ["run off", "runoff", "auxiliary area", "touchline", "goal line", "perimeter run"] },
  "STA-0028": { any: ["warm up area", "warm up", "warming up"], not: ["gym", "exercise"] },
  "STA-0029": { any: ["bench", "technical area", "substitutes"] },
  "STA-0030": { any: ["tunnel"], not: ["staging", "slope", "gradient"] },
  "STA-0034": { any: ["team dressing", "dressing room", "changing room", "players room", "player room", "team room"], not: ["referee", "official", "officials", "delegate", "coach", "ball kid"] },
  "STA-0035": { any: ["referee", "officials dressing", "match officials", "officials room"] },
  "STA-0038": { any: ["medical room", "player medical", "treatment room", "medical treatment"], not: ["spectator", "crowd", "public", "access"] },
  "STA-0039": { any: ["doping", "drug test"] },
  "STA-0040": { any: ["mixed zone"] },
  "STA-0042": { any: ["press conference", "media conference", "news conference"] },
  "STA-0043": { any: ["match delegate", "event management office", "event management", "delegate room"] },
  "STA-0047": { any: ["perimeter"], not: ["run off", "runoff", "fencing", "fence"] },
  "STA-0066": { any: ["commentary position", "commentary positions", "commentator", "tv commentary", "radio commentary"] },
  "STA-0068": { any: ["broadcast compound", "tv compound", "compound area", "compound"] },
  "STA-0087": { any: ["backup", "generator", "ups", "standby power", "power outage", "autonomy", "emergency power"] },
  "STA-0093": { any: ["speech intelligibility", "sti", "public address", "pa system", "voice alarm"] },
  "STA-0094": { any: ["screen", "scoreboard", "video display", "giant screen"] },
};
function keywordScore(id, label) {
  const kw = KEYWORDS[id];
  if (!kw) return 0;
  if ((kw.not || []).some((p) => has(label, p))) return 0;
  const hit = kw.any.filter((p) => has(label, p)).sort((a, b) => b.length - a.length)[0];
  return hit ? 3 + (hit.length > 8 ? 0.5 : 0) : 0;
}
function titleScore(requirement, label) {
  const title = [...new Set(words(requirement.title))];
  if (title.length < 2) return 0;
  const lineWords = new Set(label.split(" "));
  const overlap = title.filter((w) => lineWords.has(w) || lineWords.has(`${w}s`) || (w.endsWith("s") && lineWords.has(w.slice(0, -1)))).length;
  return overlap >= 2 && overlap / title.length >= 0.6 ? overlap : 0;
}

// ---------- what a statement says ----------
const OPERATOR_WORDS = [
  ["range", /\bbetween\s+[\d.,]+\s*[A-Za-z²%]*\s+(?:and|to)\s+[\d.,]+/i],
  ["gt", /\b(more than|greater than|in excess of|exceeds?|above|over)\b/i],
  ["lt", /\b(less than|below|under|fewer than)\b/i],
  ["min", /\b(at least|a minimum of|minimum|min\.?|no less than|not less than|no fewer than|not fewer than|not be less than)\b/i],
  ["max", /\b(at most|a maximum of|maximum|max\.?|no more than|not more than|not exceed|up to|no greater than)\b/i],
  ["eq", /\b(exactly|equal to)\b/i],
];
const UP_WORDS = /\b(raised?|increas\w+|larger|longer|wider|taller|higher|bigger|more|extended)\b/i;
const DOWN_WORDS = /\b(reduc\w+|lower\w*|smaller|shorter|narrower|fewer|less)\b/i;

function operatorOf(text, quantity) {
  for (const [op, re] of OPERATOR_WORDS) if (re.test(text)) return { op, explicit: true };
  const from = new RegExp(`from\\s+${N}\\s*[^\\s]*\\s+to\\s+${N}`, "i").exec(text);
  if (from) return { op: DOWN_WORDS.test(text) && !UP_WORDS.test(text) ? "max" : "min", explicit: false };
  void quantity;
  return { op: "min", explicit: false };
}

function criterionOf(text, quantities_, primary) {
  const range = new RegExp(`between\\s+${N}\\s*[A-Za-z²%]*\\s+(?:and|to)\\s+${N}`, "i").exec(text);
  const { op, explicit } = operatorOf(text, primary);
  if (op === "range" && range) {
    const a = toNumber(range[1]);
    const b = toNumber(range[2]);
    return { criterion: { operator: "range", minimum: Math.min(a, b), maximum: Math.max(a, b), unit: primary.unit }, explicit };
  }
  // "from 4.5 m to 6 m": the second figure is the new one
  const from = new RegExp(`from\\s+${N}\\s*[A-Za-z²%.]*\\s+to\\s+${N}`, "i").exec(text);
  let value = primary.value;
  if (from && primary.index <= (from.index || 0) + from[0].length) value = toNumber(from[2]);
  const operator = op === "range" ? "min" : op;
  void quantities_;
  return { criterion: { operator, value, unit: primary.unit }, explicit };
}

const sameCriterion = (a, b) => {
  if (a.operator === "range" || b.operator === "range")
    return a.operator === b.operator && a.minimum === b.minimum && a.maximum === b.maximum;
  const group = (op) => (op === "min" || op === "gte" ? "min" : op === "max" || op === "lte" ? "max" : op);
  return group(a.operator) === group(b.operator) && Number(a.value) === Number(b.value);
};

// ---------- sentences ----------
const REQUIREMENT_WORDS = /\b(shall|must|should|required?|requires?|minimum|maximum|at least|at most|no less than|not less than|no more than|not exceed|up to|increas\w+|reduc\w+|raised?|lowered?|amended?|revised?|replaced?|extended)\b/i;
const OBLIGATION = /\b(shall|must|should|needs? to|is required to|are required to)\s+(provide|include|have|install|ensure|maintain|offer|contain|be|allow|incorporate)\b/i;
// What a requirement with no figure has to say before it is worth adding: that something must be provided.
const PROVIDES = /\b(shall|must|should|needs? to|is required to|are required to)\s+(provide|include|have|install|ensure|maintain|offer|contain|allow|incorporate)\b/i;

function sentencesOf(pages) {
  const out = [];
  for (const p of pages) {
    const lines = String(p.text || "").split(/\r?\n/);
    lines.forEach((raw, i) => {
      const line = raw.replace(/^[\s•·*\-–\d.)]+(?=[A-Za-z"“(])/, "").trim();
      if (!line) return;
      for (const s of line.split(/(?<=[.!?;])\s+(?=[A-Z0-9“"(])/)) {
        const text = s.trim();
        if (text.length >= 18 && text.length <= 420 && /[A-Za-z]{3}/.test(text)) out.push({ text, page: p.n, line: i + 1 });
      }
    });
  }
  return out;
}

// ---------- new requirements ----------
const FAMILY_WORDS = {
  "01": /\b(master plan|zoning|environmental|handover|deviations?|site boundary|water|wastewater|sustainab\w+|legacy)\b/,
  "02": /\b(safety|security|fire|evacuation|cctv|surveillance|stewards?|structural|hostile|control room|medical centre)\b/,
  "03": /\b(parking|egress|wayfinding|signage|queue|perimeter|screening|transport|logistics|concourse|access)\b/,
  "04": /\b(pitch|grass|turf|drainage|irrigation|playing area|playing field|goals?|substitutes?|benches|field of play)\b/,
  "05": /\b(dressing|players?|referees?|officials?|tunnel|warm up|doping|medical room|delegate|welfare|recovery)\b/,
  "06": /\b(spectators?|seating|toilets?|concessions?|accessible|disabled|wheelchair|ticketing|turnstiles?|public address|scoreboards?|screens?|prayer|quiet|sensory|family)\b/,
  "07": /\b(hospitality|vip|vvip|lounges?|skybox\w*|sponsor)\b/,
  "08": /\b(media|broadcast|camera|commentary|press|mixed zone|studio|photographers?|tribune|compound|accreditation)\b/,
  "09": /\b(lighting|power|electrical|generators?|ups|lux|floodlight\w*|commissioning|backup)\b/,
  "10": /\b(communications?|telecom|wi ?fi|network|cyber\w*|fibre|ict|telephones?|flagpoles?)\b/,
  "12": /\b(temporary|overlay|fan fest\w*|demountable|event facilities)\b/,
};
export const DEFAULT_FAMILY = "06";
function familyHits(text) {
  const label = normal(text);
  let best = null;
  for (const [id, re] of Object.entries(FAMILY_WORDS)) {
    const hits = (label.match(new RegExp(re.source, "g")) || []).length;
    if (hits && (!best || hits > best.hits)) best = { id, hits };
  }
  return best ? best.id : null;
}
// What the requirement is about (its title) counts before who it is for, which a sentence often names as well.
const familyFor = (title, sentence) => familyHits(title) || familyHits(sentence) || DEFAULT_FAMILY;
const upperFirst = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function titleFor(text) {
  const m = /\b(?:provide|include|have|install|ensure|maintain|offer|contain|incorporate)\s+(?:at least|a minimum of|minimum of|no fewer than|a|an|the)?\s*(?:\d[\d.,]*|one|two|three|four|five|six)?\s*([a-z][a-z' -]{2,48}?)(?=\s+(?:of|with|for|in|on|at|that|which|to|within|per|and)\b|[,.;]|$)/i.exec(text);
  const phrase = m ? m[1].trim() : words(text).slice(0, 4).join(" ");
  return upperFirst(phrase.replace(/\s+/g, " ")) || "New requirement";
}

const PREFERRED = ["m²", "m", "hours", "minutes", "%", "seats", "screens", "positions", "lines", "sti", "seats-per-pos", "count"];
const primaryOf = (qs) => [...qs].sort((a, b) => PREFERRED.indexOf(a.key) - PREFERRED.indexOf(b.key))[0];
const clip = (s, n = 200) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Read a document or a typed text and find its requirements.
 * source: { name, kind: "text" | "document", pages: [{ n, text }], readable }
 * Returns { items, steps, readable, statements } where each item is
 *   { key, kind: "amendment" | "new" | "unchanged", requirementId?, title, quote, page, oldCrit, newCrit, criterion,
 *     shift?, confidence, familyId?, alsoStates? }.
 */
export function extractRequirements(source) {
  const pages = source.readable === false ? [] : source.pages || [];
  const steps = [];
  const step = (label, detail, ok = true) => steps.push({ label, detail, ok });
  const sentences = sentencesOf(pages);
  step(
    "Read the text",
    source.readable === false
      ? `${source.name}: no text could be read from this file. It may be a scan, so no requirement can be found in it.`
      : `${source.name}: ${sentences.length} statement${sentences.length === 1 ? "" : "s"} on ${pages.length} page${pages.length === 1 ? "" : "s"}.`,
    source.readable !== false && sentences.length > 0,
  );

  const statements = sentences
    .map((s) => ({ ...s, qs: quantities(s.text) }))
    .filter((s) => REQUIREMENT_WORDS.test(s.text) && (s.qs.length > 0 || OBLIGATION.test(s.text)));
  step(
    "Found the statements that set a requirement",
    statements.length ? `${statements.length} of ${sentences.length} read as requirements (they say what must be provided, and how much).` : "None of the statements sets a requirement.",
    statements.length > 0,
  );

  const reqs = currentRequirements().filter((r) => r.appliesTo.includes("stadium"));
  const items = [];
  const seenReq = new Set();
  const seenNew = new Set();
  for (const s of statements) {
    const label = normal(s.text.replace(/\d[\d,]*(?:\.\d+)?/g, " "));
    const primary = s.qs.length ? primaryOf(s.qs) : null;
    // an existing requirement: its words, and a figure in its unit
    let best = null;
    const tied = [];
    for (const r of reqs) {
      const numeric = r.criterion.operator !== "manual";
      const unitKey = numeric ? UNITS.find((u) => u.unit === r.criterion.unit || (r.criterion.unit || "").startsWith(u.unit))?.key : null;
      const q = numeric ? s.qs.find((x) => x.key === unitKey) : primary;
      if (numeric && !q) continue;
      if (!numeric && !q) continue;
      const score = keywordScore(r.id, label) || titleScore(r, label);
      if (score < 2) continue;
      if (!best || score > best.score) {
        best = { r, q, score };
        tied.length = 0;
      } else if (score === best.score) tied.push(r.id);
    }
    if (best && tied.length) best = null; // two requirements fit equally: leave it to a person
    if (best) {
      if (seenReq.has(best.r.id)) continue;
      seenReq.add(best.r.id);
      const { criterion, explicit } = criterionOf(s.text, s.qs, best.q);
      const before = best.r;
      const oldCrit = criterionText(before.criterion);
      const newCrit = criterionText(criterion);
      const unchanged = before.criterion.operator !== "manual" && sameCriterion(before.criterion, criterion);
      items.push({
        key: `${before.id}`,
        kind: unchanged ? "unchanged" : "amendment",
        requirementId: before.id,
        title: before.title,
        chapter: `${before.familyId} ${before.category}`,
        quote: clip(s.text),
        page: s.page,
        oldCrit,
        newCrit,
        criterion,
        shift: unchanged ? null : describeShift(before, { ...before, criterion }),
        confidence: explicit && keywordScore(before.id, label) ? "high" : "medium",
      });
      continue;
    }
    // a requirement the register does not have
    if (!PROVIDES.test(s.text) && !s.qs.length) continue;
    const title = titleFor(s.text);
    if (seenNew.has(title.toLowerCase())) continue;
    seenNew.add(title.toLowerCase());
    let criterion;
    let confidence = "medium";
    if (primary) {
      const c = criterionOf(s.text, s.qs, primary);
      criterion = c.criterion;
      if (primary.key === "count") criterion.unit = primary.noun;
      confidence = c.explicit ? "high" : "medium";
    } else criterion = { operator: "manual", description: clip(s.text, 160) };
    const others = s.qs.filter((q) => q !== primary).map((q) => `${q.value} ${q.unit}`);
    items.push({
      key: `new:${title.toLowerCase()}`,
      kind: "new",
      title,
      chapter: null,
      familyId: familyFor(title, s.text),
      quote: clip(s.text),
      page: s.page,
      oldCrit: null,
      newCrit: criterionText(criterion),
      criterion,
      confidence,
      alsoStates: others.length ? others.join(", ") : null,
    });
  }

  const amend = items.filter((i) => i.kind === "amendment").length;
  const fresh = items.filter((i) => i.kind === "new").length;
  const same = items.filter((i) => i.kind === "unchanged").length;
  step(
    "Matched them to the register",
    items.length
      ? `${amend} change${amend === 1 ? "s" : ""} to a requirement in the register, ${fresh} new requirement${fresh === 1 ? "" : "s"}, ${same} already in force.`
      : "No requirement was found to match.",
    items.length > 0,
  );
  step(
    "Compared each figure with the requirement in force",
    amend ? `${items.filter((i) => i.kind === "amendment").map((i) => `${i.requirementId}: ${i.oldCrit} to ${i.newCrit}`).slice(0, 3).join("; ")}${amend > 3 ? "…" : ""}.` : "No figure differs from what the register has.",
    true,
  );
  return { items, steps, readable: source.readable !== false, statements: statements.length };
}

export const FAMILY_CHOICES = FAMILIES.filter((f) => f.forStadiums).map((f) => ({ id: f.id, label: `${f.id} ${f.name}` }));
