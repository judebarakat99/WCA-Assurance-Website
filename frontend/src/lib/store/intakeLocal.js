// Contractor documents, kept in this browser. Sample progress reports and plans
// are read from their bundled readings (data/progress/offline-readings.json);
// any other document goes through the evidence agent (lib/intake/evidenceAgent).
import readings from "../../../../data/progress/offline-readings.json" with { type: "json" };
import { ELEMENTS, buildCheck } from "@/lib/domain/progressCheck.mjs";
import { stadiumApplicability } from "@/lib/domain/assessment.mjs";
import { FACILITY_REGISTER, capacityRequirement } from "@/lib/domain/facilities.mjs";
import { currentRequirement } from "@/lib/domain/requirementVersions.mjs";
import { EVIDENCE_PAGE_NOTE } from "@/lib/domain/reviewQueue.mjs";
import { analyseDocument } from "@/lib/intake/evidenceAgent.mjs";
import { readDocument } from "@/lib/intake/readDocument.mjs";
import { clearAlerts, raiseAlerts, removeAlertsFor } from "@/lib/store/alerts";
import { getAssessments, recordEvidence } from "@/lib/store/assessments";

const KEY = "wca-intake-offline-v1";
const FILES = new Map(readings.files.map((f) => [f.name, f]));
const CITY = Object.fromEntries(FACILITY_REGISTER.hostCities.map((c) => [c.id, c.name]));
const STADIUMS = FACILITY_REGISTER.stadiums.map((s) => ({ id: s.id, name: s.name, city: CITY[s.cityId] }));

let db = null; // { documents: [...rows], checks: { stadiumId: result } }

function load() {
  if (db) return db;
  try {
    db = JSON.parse(localStorage.getItem(KEY)) || null;
  } catch {
    db = null;
  }
  db = db && Array.isArray(db.documents) ? db : { documents: [], checks: {} };
  return db;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // Private mode or full storage: keep working for this page load.
  }
}

const now = () => new Date().toISOString().slice(0, 19) + "+00:00";
const reading = (doc) => FILES.get(doc.name).extraction;
const current = (stadiumId) =>
  load().documents.filter((d) => d.status === "filed" && !d.superseded && d.stadium_id === stadiumId);

// Within a stadium (and scope element, for plans) only the newest filed document counts.
function resupersede() {
  const groups = new Map();
  for (const d of load().documents.filter((x) => x.status === "filed")) {
    const key = [d.kind, d.stadium_id, d.kind === "detailed-plan" ? d.element : d.kind === "evidence" ? (d.requirement_ids || []).join(",") : ""].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(d);
  }
  const rank = (d) => `${d.as_of || ""}|${String(d.revision || "").padStart(8)}`;
  for (const group of groups.values()) {
    group.sort((a, b) => (rank(a) < rank(b) ? 1 : -1));
    group.forEach((d, i) => (d.superseded = i > 0 ? 1 : 0));
  }
}

function checks() {
  const out = {};
  for (const [id, check] of Object.entries(load().checks)) {
    const used = new Set([check.report?.document_id, ...check.packages.map((p) => p.document?.id).filter(Boolean)]);
    const live = current(id).filter((d) => d.kind === "progress-report" || d.kind === "detailed-plan");
    const stale = live.length !== used.size || live.some((d) => !used.has(d.document_id));
    out[id] = { ...check, stadium_id: id, stale };
  }
  return out;
}

export function localState() {
  load();
  return {
    stadiums: STADIUMS,
    elements: Object.entries(ELEMENTS).map(([id, name]) => ({ id, name })),
    documents: db.documents.map((d) => ({ ...d })),
    checks: checks(),
  };
}

/** Add a sample progress report or plan, from its bundled reading. */
export function localUpload(file) {
  const sample = FILES.get(file.name);
  if (!sample || sample.size !== file.size)
    throw new Error("This document could not be read. Use a progress report or detailed plan as a PDF, TXT or Markdown file.");
  const existing = load().documents.find((d) => d.name === sample.name);
  if (existing) return { ...existing, duplicate: true };
  const row = {
    document_id: `offline:${sample.name}`,
    ...sample.proposal,
    status: "proposed",
    superseded: 0,
    filed_at: null,
    name: sample.name,
    pages: sample.pages,
    created_at: now(),
  };
  db.documents.unshift(row);
  save();
  return row;
}

export function localFile(id, filing) {
  const d = load().documents.find((x) => x.document_id === id);
  if (!d) throw new Error("Document not found in intake");
  Object.assign(d, filing, {
    element: filing.kind === "detailed-plan" ? filing.element : null,
    status: "filed",
    filed_at: now(),
  });
  resupersede();
  save();
}

export function localRemove(id) {
  load().documents = db.documents.filter((d) => d.document_id !== id);
  removeAlertsFor(id);
  resupersede();
  save();
}

export function localCheck(stadiumId) {
  const stadium = STADIUMS.find((s) => s.id === stadiumId);
  const docs = current(stadiumId);
  const report = docs.find((d) => d.kind === "progress-report");
  const plans = docs.filter((d) => d.kind === "detailed-plan");
  const result = buildCheck(
    stadium,
    report && { document: report, reading: reading(report) },
    plans.map((d) => ({ document: d, reading: reading(d) })),
  );
  load().checks[stadiumId] = result;
  save();
  return checks()[stadiumId];
}

export function localDecide(stadiumId, decision, note) {
  const check = load().checks[stadiumId];
  if (!check) throw new Error("No check for this stadium");
  Object.assign(check, { decision, decision_note: note, decided_at: now() });
  save();
  return checks()[stadiumId];
}

/** File and check the preloaded sample documents. */
export function localSeed() {
  const stadiums = [];
  for (const f of readings.files.filter((x) => x.folder === "preloaded")) {
    const row = localUpload({ name: f.name, size: f.size });
    localFile(row.document_id, {
      kind: f.proposal.kind,
      stadium_id: f.proposal.stadium_id,
      element: f.proposal.element,
      as_of: f.proposal.as_of,
      revision: f.proposal.revision,
    });
    if (!stadiums.includes(f.proposal.stadium_id)) stadiums.push(f.proposal.stadium_id);
  }
  for (const id of stadiums) localCheck(id);
  return localState();
}

export function localClear() {
  db = { documents: [], checks: {} };
  clearAlerts();
  save();
}

// ---------------------------------------------------------------- evidence documents
// Any other document is read here (PDFs through lib/intake/pdfText) and analysed by the evidence agent in
// lib/intake/evidenceAgent. The proposal carries what the agent found. Nothing is recorded until the person
// confirms: filing then records the document as evidence in the register (lib/store/assessments) and raises the
// agent's alerts for the owners.
let docSeq = 0;
const MAX_TEXT = 120000; // characters of text kept with a proposal, so the agent can read it again for another stadium

function keepText(pages) {
  let room = MAX_TEXT;
  const out = [];
  for (const p of pages || []) {
    if (room <= 0) break;
    const text = p.text.slice(0, room);
    room -= text.length;
    out.push({ n: p.n, text });
  }
  return out;
}

/** Add a document: the bundled sample documents as before, anything else through the evidence agent. */
export async function localIngest(file, context = {}) {
  const sample = FILES.get(file.name);
  if (sample && sample.size === file.size) return localUpload(file);
  const existing = load().documents.find((d) => d.name === file.name && d.size === file.size);
  if (existing) return { ...existing, duplicate: true };
  const read = await readDocument(file);
  const result = analyseDocument({ name: file.name, size: file.size, ...read }, getAssessments(), new Date(), {
    stadiumId: context.stadiumId || undefined,
  });
  const row = {
    document_id: `local:${Date.now().toString(36)}-${++docSeq}`,
    kind: result.kind,
    stadium_id: result.stadium_id,
    element: null,
    as_of: result.as_of,
    revision: result.revision,
    confidence: result.confidence,
    evidence_quote: result.evidence_quote,
    evidence_page: result.evidence_page,
    requirement_ids: result.requirement_ids,
    analysis: result.analysis,
    text_pages: keepText(read.pages),
    status: "proposed",
    superseded: 0,
    filed_at: null,
    name: file.name,
    size: file.size,
    pages: read.pageCount || 1,
    created_at: now(),
  };
  db.documents.unshift(row);
  save();
  return row;
}

/** Read a proposed evidence document again for the stadium the person chose. */
export function localReanalyse(id, stadiumId) {
  const d = load().documents.find((x) => x.document_id === id);
  if (!d || d.status !== "proposed" || !d.text_pages) return null;
  const result = analyseDocument(
    { name: d.name, size: d.size, pages: d.text_pages, readable: d.analysis?.readable !== false },
    getAssessments(),
    new Date(),
    { stadiumId },
  );
  Object.assign(d, {
    kind: result.kind,
    stadium_id: result.stadium_id,
    as_of: result.as_of ?? d.as_of,
    revision: result.revision ?? d.revision,
    confidence: result.confidence,
    evidence_quote: result.evidence_quote,
    evidence_page: result.evidence_page,
    requirement_ids: result.requirement_ids,
    analysis: result.analysis,
  });
  save();
  return d;
}

/** Record a filed document as evidence against each requirement it was matched to. Returns their ids. */
function syncEvidenceToRegister(doc) {
  const stadium = FACILITY_REGISTER.stadiums.find((s) => s.id === doc.stadium_id);
  if (!stadium) return [];
  const done = [];
  for (const match of doc.analysis?.matches || []) {
    if (!match.record) continue; // mentioned by name only: shown, not recorded
    const base = currentRequirement(match.requirement_id);
    if (!base || stadiumApplicability(stadium, base).value === "not-applicable") continue;
    // the capacity rule depends on the stadium's highest match
    const requirement = base.id === "STA-0004" ? capacityRequirement(stadium) || base : base;
    recordEvidence(stadium.id, requirement, {
      file: doc.name,
      value: match.value ?? "",
      note: `${EVIDENCE_PAGE_NOTE}${doc.revision ? `, revision ${doc.revision}` : ""}`,
    });
    done.push(match.requirement_id);
  }
  return done;
}

/** File a document. An evidence document is also recorded in the register, and its alerts go to the owners. */
export function localFileAndSync(id, filing) {
  localFile(id, filing);
  const d = load().documents.find((x) => x.document_id === id);
  if (d && d.kind === "evidence" && d.analysis) {
    d.registered = syncEvidenceToRegister(d);
    raiseAlerts(d.analysis.alerts, { id: d.document_id, name: d.name, stadium_id: d.stadium_id });
  }
  if (d) delete d.text_pages;
  save();
}
