// The Evidence page's agent, in the browser: reads a document's text (or only
// its file name when no text can be read), identifies what it is and which
// stadium it concerns, matches stated values to register checks, checks them
// against their criteria, and says what confirming would change.
import { evaluate, stadiumRequirements } from "@/lib/domain/assessment.mjs";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";
import { CHAPTERS, criterionLabel } from "@/lib/domain/fifa-catalogue.mjs";
import { ELEMENTS } from "@/lib/domain/progressCheck.mjs";

/** Owner of each chapter, who is alerted about its requirements. */
export const CHAPTER_OWNER = {
  "01": "Programme and planning lead",
  "02": "Safety and security lead",
  "03": "Transport and access lead",
  "04": "Pitch and turf lead",
  "05": "Team facilities lead",
  "06": "Spectator experience lead",
  "07": "Hospitality lead",
  "08": "Media and broadcast lead",
  "09": "Electrical and lighting lead",
  "10": "ICT and systems lead",
  "11": "Overlay and event lead",
};
export const PROGRAMME_OWNER = CHAPTER_OWNER["01"];
export const EVIDENCE_TYPES = ["Drawing", "Calculation", "Test record", "Certificate"];

// Short codes used in contractors' file names.
const CODES = { ksis: "king-salman-international", kfsc: "king-fahad-sports-city", ars: "aramco", pfbf: "prince-faisal-bin-fahad" };
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, "0");

function isoDate(text) {
  let m = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = text.match(/\b(\d{1,2}) (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* (\d{4})\b/i);
  if (m) return `${m[3]}-${pad(MONTHS[m[2].toLowerCase()])}-${pad(m[1])}`;
  m = text.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

function findStadium(text, name) {
  const hay = `${text || ""}\n${name}`.toLowerCase();
  const byName = FACILITY_REGISTER.stadiums.find((s) => hay.includes(s.name.toLowerCase()) || hay.includes(s.name.toLowerCase().replace(/ stadium$/, "")));
  if (byName) return { stadium: byName, where: text && text.toLowerCase().includes(byName.name.toLowerCase().replace(/ stadium$/, "")) ? "document" : "file name" };
  const token = name.toLowerCase().split(/[^a-z0-9]+/).find((t) => CODES[t]);
  if (token) return { stadium: FACILITY_REGISTER.stadiums.find((s) => s.id === CODES[token]), where: "file name" };
  const slug = FACILITY_REGISTER.stadiums.find((s) => name.toLowerCase().includes(s.id));
  return slug ? { stadium: slug, where: "file name" } : { stadium: null, where: null };
}

function findKind(text, name) {
  const hay = `${text || ""}\n${name}`.toLowerCase();
  if (/progress report/.test(hay) || /progress-report/.test(name.toLowerCase())) return { kind: "progress-report", evidenceType: null };
  if (/delivery plan|works programme|-plan-/.test(hay)) return { kind: "detailed-plan", evidenceType: null };
  const typed = (text || "").match(/Document type:\s*(Drawing|Calculation|Test record|Certificate)/i);
  if (typed) return { kind: "evidence", evidenceType: EVIDENCE_TYPES.find((t) => t.toLowerCase() === typed[1].toLowerCase()) };
  const n = name.toLowerCase();
  if (/drawing|\bga\b|layout/.test(n)) return { kind: "evidence", evidenceType: "Drawing" };
  if (/calc/.test(n)) return { kind: "evidence", evidenceType: "Calculation" };
  if (/test|record|commission/.test(n)) return { kind: "evidence", evidenceType: "Test record" };
  if (/certificate|cert\b/.test(n)) return { kind: "evidence", evidenceType: "Certificate" };
  return { kind: "other", evidenceType: null };
}

const ELEMENT_WORDS = { "pitch-turf": /pitch|turf/, floodlighting: /floodlight/, "seating-stands": /seating|stands/, "broadcast-media": /broadcast/ };
const findElement = (text, name) =>
  Object.keys(ELEMENTS).find((e) => ELEMENT_WORDS[e].test(`${(text || "").split("\n").slice(0, 3).join(" ")} ${name}`.toLowerCase())) || null;

// The first number on a line after a position, with what follows it as the unit.
function valueAfter(line, from) {
  const m = line.slice(from).match(/(-?\d[\d,]*(?:\.\d+)?)\s*([^\s\d][^\d]*)?$/) || line.slice(from).match(/(-?\d[\d,]*(?:\.\d+)?)/);
  if (!m) return null;
  return { value: Number(m[1].replace(/,/g, "")), raw: m[0].trim(), unit: (m[2] || "").trim() };
}

/** Values stated for the stadium's in-scope requirements: by ID, or by title. */
function findMatches(text, stadium) {
  if (!text || !stadium) return [];
  const rows = stadiumRequirements(stadium).filter((r) => r.applicability.value !== "not-applicable");
  const found = new Map();
  for (const line of text.split("\n")) {
    for (const row of rows) {
      const r = row.requirement;
      if (found.has(r.id)) continue;
      let at = line.indexOf(r.id);
      if (at >= 0) at += r.id.length;
      else {
        const t = line.toLowerCase().indexOf(r.title.toLowerCase());
        if (t < 0) continue;
        at = t + r.title.length;
      }
      const v = valueAfter(line, at);
      found.set(r.id, { requirement: r, key: row.key, value: v ? v.value : null, stated: v ? v.raw : null, line: line.trim() });
    }
  }
  return [...found.values()];
}

/**
 * Read a document. text: its text, or null when none could be read.
 * progress: the bundled reading of a sample progress report or plan, if any.
 */
export function readDocument({ name, text, pages = 1, progress = null }) {
  const readable = text != null && text.trim().length > 0;
  const proposal = progress?.proposal;
  const kindInfo = proposal ? { kind: proposal.kind, evidenceType: null } : findKind(readable ? text : null, name);
  const { stadium, where } = proposal
    ? { stadium: FACILITY_REGISTER.stadiums.find((s) => s.id === proposal.stadium_id), where: "document" }
    : findStadium(readable ? text : null, name);
  const revision = proposal?.revision ?? (readable && text.match(/Revision:\s*(\w+)/)?.[1]) ?? name.match(/rev-?([A-Za-z0-9]+)/i)?.[1] ?? null;
  const as_of = proposal?.as_of ?? (readable ? isoDate(text) : null) ?? isoDate(name.replace(/[-_]/g, " "));
  const element = proposal?.element ?? (kindInfo.kind === "detailed-plan" ? findElement(readable ? text : null, name) : null);
  const matches = kindInfo.kind === "evidence" ? findMatches(readable ? text : null, stadium) : [];
  const title = proposal?.title ?? (readable ? text.split("\n").map((l) => l.trim()).filter(Boolean)[1] : null) ?? name;
  return {
    readable: readable || !!progress,
    pages,
    kind: kindInfo.kind,
    evidenceType: kindInfo.evidenceType,
    stadium_id: stadium?.id || null,
    stadiumFoundIn: where,
    element,
    revision,
    as_of,
    title,
    matches: matches.map((m) => ({ requirementId: m.requirement.id, value: m.value, stated: m.stated, line: m.line })),
    progress: progress ? progress.extraction : null,
  };
}

const n = (k, one, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;
const ownerOf = (requirement) => CHAPTER_OWNER[requirement.chapter];

/**
 * What the agent checked, and what confirming would do, for a document with
 * the person's current details. doc: { name, kind, evidenceType, stadium_id,
 * element, revision, reading }. records: assessments. filed: filed documents.
 */
export function assessDocument(doc, records, filed = []) {
  const reading = doc.reading || {};
  const stadium = FACILITY_REGISTER.stadiums.find((s) => s.id === doc.stadium_id) || null;
  const rows = stadium ? Object.fromEntries(stadiumRequirements(stadium).map((r) => [r.requirement.id, r])) : {};
  const matches = (doc.kind === "evidence" ? reading.matches || [] : [])
    .map((m) => ({ ...m, row: rows[m.requirementId] }))
    .filter((m) => m.row && m.row.applicability.value !== "not-applicable");
  const checked = matches
    .filter((m) => m.value != null)
    .map((m) => {
      const record = records[m.row.key];
      const previous = record?.evidence?.at(-1)?.value;
      return { ...m, requirement: m.row.requirement, check: evaluate(m.row.requirement.criterion, m.value), record, previous };
    });
  const failing = checked.filter((m) => m.check === "fail");
  const unvalued = matches.filter((m) => m.value == null);
  const differs = checked.filter((m) => m.previous != null && m.previous !== "" && Number(m.previous) !== m.value);
  const plan = doc.kind === "detailed-plan";
  const report = doc.kind === "progress-report";
  const sameStadium = filed.filter((d) => d.stadium_id === doc.stadium_id && !d.superseded);
  const replaces = sameStadium.find(
    (d) => d.kind === doc.kind && (!plan || d.element === doc.element) && d.document_id !== doc.document_id,
  );
  const claimed = report ? reading.progress?.data?.packages?.map((p) => p.element) || [] : [];
  const plansOnFile = new Set(sameStadium.filter((d) => d.kind === "detailed-plan").map((d) => d.element));
  const missingPlans = claimed.filter((e) => !plansOnFile.has(e));

  const alerts = failing.map((m) => ({
    severity: m.requirement.status === "Book" ? "High" : "Medium",
    requirementId: m.requirement.id,
    title: m.requirement.title,
    chapter: m.requirement.chapter,
    owner: ownerOf(m.requirement),
    message: `${m.requirement.title} is not met at ${stadium.name}: ${m.stated} against ${criterionLabel(m.requirement.criterion)}.`,
  }));
  if (report && stadium && missingPlans.length)
    alerts.push({
      severity: "Medium",
      requirementId: null,
      title: "Progress claim without plans",
      chapter: "01",
      owner: PROGRAMME_OWNER,
      message: `${stadium.name}'s progress report claims ${missingPlans.map((e) => ELEMENTS[e].toLowerCase()).join(", ")} progress with no detailed plan on file.`,
    });

  const kindLabel = { "progress-report": "progress report", "detailed-plan": "detailed plan", evidence: (doc.evidenceType || "evidence").toLowerCase(), other: "document" }[doc.kind];
  const steps = [
    reading.readable
      ? { label: "Read the document", detail: `${doc.name}: read as a ${kindLabel}${reading.pages ? `, ${n(reading.pages, "page")}` : ""}.`, ok: true }
      : { label: "Read the document", detail: `${doc.name}: no text could be read from this file, so it was identified from the file name only.`, ok: false },
    stadium
      ? { label: "Identified the stadium", detail: `${stadium.name}${reading.stadiumFoundIn ? `, named in the ${reading.stadiumFoundIn}` : ""}.`, ok: true }
      : { label: "Identified the stadium", detail: "No registered stadium is named in the document or its file name.", ok: false },
    report || plan
      ? { label: "Matched requirements in the register", detail: report ? "A progress report: its claims are checked against the detailed plans, not register checks." : `A detailed plan for ${ELEMENTS[doc.element]?.toLowerCase() || "an unknown scope element"}: it is the evidence behind a progress claim.`, ok: !plan || !!doc.element }
      : matches.length
        ? { label: "Matched requirements in the register", detail: `${n(matches.length, "requirement")}: ${matches.map((m) => `${m.requirementId} ${m.row.requirement.title}`).join(", ")}.`, ok: true }
        : { label: "Matched requirements in the register", detail: "Nothing in the document matches a requirement that applies to this stadium.", ok: false },
    report || plan
      ? { label: "Read the stated values", detail: reading.progress ? (report ? `Claims ${reading.progress.data.overall_claimed}% overall at ${reading.progress.data.as_of}.` : `${n(reading.progress.data.activities.length, "activity", "activities")} with weights, planned dates and actual completion.`) : "The tables could not be read from this file.", ok: !!reading.progress }
      : checked.length
        ? { label: "Read the stated values", detail: checked.map((m) => `${m.stated} for ${m.requirementId}`).join(", ") + ".", ok: true }
        : { label: "Read the stated values", detail: "The document states no figure that matches a requirement.", ok: true },
    report || plan
      ? { label: "Checked against the criteria", detail: "Progress is recalculated from the plans when the document is filed.", ok: true }
      : checked.length
        ? { label: "Checked against the criteria", detail: failing.length ? `${n(checked.length - failing.length, "meets", "meet")} its criterion; ${failing.map((m) => `${m.requirementId} ${m.stated} against ${criterionLabel(m.requirement.criterion)}`).join(", ")} does not.` : `All ${n(checked.length, "value")} meet their criteria.`, ok: !failing.length }
        : { label: "Checked against the criteria", detail: "Nothing to check.", ok: true },
    differs.length
      ? { label: "Cross-checked with the register", detail: `Differs from what is on record: ${differs.map((m) => `${m.requirementId} ${m.previous} on record, ${m.value} now`).join(", ")}.`, ok: false }
      : replaces
        ? { label: "Cross-checked with the register", detail: `Replaces ${replaces.name}${replaces.revision ? ` (rev ${replaces.revision})` : ""} on file.`, ok: true }
        : { label: "Cross-checked with the register", detail: "The figures agree with what is already on record.", ok: true },
    missingPlans.length
      ? { label: "Checked what is missing", detail: `No detailed plan on file for ${missingPlans.map((e) => ELEMENTS[e].toLowerCase()).join(", ")}.`, ok: false }
      : unvalued.length
        ? { label: "Checked what is missing", detail: `Named without a value: ${unvalued.map((m) => m.requirementId).join(", ")}.`, ok: false }
        : { label: "Checked what is missing", detail: "Nothing is missing.", ok: true },
    alerts.length
      ? { label: "Prepared alerts for the owners", detail: alerts.map((a) => `${a.owner}${a.requirementId ? ` (${a.requirementId})` : ""}`).join("; ") + ".", ok: false }
      : { label: "Prepared alerts for the owners", detail: "No alert is needed.", ok: true },
  ];

  // What confirming does, and whether it can be confirmed yet.
  let blocker = null;
  const effects = [];
  if (!doc.kind || doc.kind === "other") blocker = { button: "Choose a type", text: "A document of this type is not recorded anywhere. Choose what it is to continue." };
  else if (!stadium) blocker = { button: "Choose a stadium", text: "Choose the stadium this document is for to continue." };
  else if (plan && !doc.element) blocker = { button: "Choose a scope element", text: "Choose the scope element this plan covers to continue." };
  else if (doc.kind === "evidence") {
    if (!checked.length) effects.push(`Nothing is recorded against a requirement; the ${kindLabel} is kept on file for ${stadium.name}.`);
    for (const m of checked)
      effects.push(
        `Records ${m.stated} as evidence for ${m.requirementId} ${m.requirement.title}, which ${m.check === "pass" ? "meets" : m.check === "fail" ? "does not meet" : "a reviewer checks against"} ${criterionLabel(m.requirement.criterion)}. It goes to the review queue${m.record?.status === "compliant" ? ", reopening a compliant item" : ""}.`,
      );
  } else if (report) {
    effects.push(`Files the progress report for ${stadium.name}${replaces ? `, replacing ${replaces.name}` : ""}, and re-checks its claimed progress against the plans on file.`);
  } else if (plan) {
    effects.push(`Files the ${ELEMENTS[doc.element].toLowerCase()} plan for ${stadium.name}${replaces ? `, replacing revision ${replaces.revision}` : ""}, and re-checks the stadium's progress claim.`);
  }
  if (!blocker) for (const a of alerts) effects.push(`Alerts the ${a.owner}: ${a.message}`);
  return { stadium, matches: checked, failing, alerts, steps, effects, blocker };
}
