// Evidence documents and progress checks, kept in this browser. Documents are
// read by the in-browser agent (lib/domain/evidenceReader): text files and the
// sample documents are read in full; other files are identified from their name.
import progressReadings from "../../../../data/progress/offline-readings.json" with { type: "json" };
import evidenceReadings from "../../../../data/evidence/readings.json" with { type: "json" };
import { readDocument } from "@/lib/domain/evidenceReader.mjs";
import { ELEMENTS, buildCheck } from "@/lib/domain/progressCheck.mjs";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";

const KEY = "wca-evidence-v1";
const PROGRESS = new Map(progressReadings.files.map((f) => [f.name, f]));
const EVIDENCE = new Map(evidenceReadings.files.map((f) => [f.name, f]));
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
const progressOf = (doc) => doc.reading?.progress || null;
const current = (stadiumId) =>
  load().documents.filter((d) => d.status === "filed" && !d.superseded && d.stadium_id === stadiumId);

// Within a stadium (and scope element, for plans) only the newest report or plan counts.
function resupersede() {
  const groups = new Map();
  for (const d of load().documents.filter((x) => x.status === "filed")) {
    const key =
      d.kind === "progress-report" || d.kind === "detailed-plan"
        ? [d.kind, d.stadium_id, d.kind === "detailed-plan" ? d.element : ""].join("|")
        : d.document_id;
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

/**
 * Add a document; the agent reads it and proposes how to file it.
 * text: the file's text when it could be read in the browser (TXT, Markdown).
 */
export function localUpload(file, text = null) {
  const existing = load().documents.find((d) => d.name === file.name);
  if (existing) return { ...existing, duplicate: true };
  const progress = PROGRESS.get(file.name);
  const evidence = EVIDENCE.get(file.name);
  const sampleText = evidence ? evidence.pages.map((p) => p.text).join("\n") : null;
  const reading = readDocument({
    name: file.name,
    text: sampleText ?? text,
    pages: progress?.pages ?? evidence?.pages.length ?? 1,
    progress: progress && { proposal: progress.proposal, extraction: progress.extraction },
  });
  const row = {
    document_id: `doc:${file.name}`,
    kind: reading.kind,
    evidenceType: reading.evidenceType,
    stadium_id: reading.stadium_id,
    element: reading.element,
    as_of: reading.as_of,
    revision: reading.revision,
    title: reading.title,
    status: "proposed",
    superseded: 0,
    filed_at: null,
    name: file.name,
    pages: reading.pages,
    created_at: now(),
    reading,
  };
  db.documents.unshift(row);
  save();
  return row;
}

export function localFile(id, filing) {
  const d = load().documents.find((x) => x.document_id === id);
  if (!d) throw new Error("Document not found");
  Object.assign(d, filing, {
    element: filing.kind === "detailed-plan" ? filing.element : null,
    evidenceType: filing.kind === "evidence" ? filing.evidenceType : null,
    status: "filed",
    filed_at: now(),
  });
  resupersede();
  save();
}

export function localRemove(id) {
  load().documents = db.documents.filter((d) => d.document_id !== id);
  resupersede();
  save();
}

export function localCheck(stadiumId) {
  const stadium = STADIUMS.find((s) => s.id === stadiumId);
  const docs = current(stadiumId);
  const report = docs.find((d) => d.kind === "progress-report");
  if (report && !progressOf(report)) throw new Error(`The progress report for ${stadium.name} could not be read, so its claim cannot be checked.`);
  const plans = docs.filter((d) => d.kind === "detailed-plan" && progressOf(d));
  const result = buildCheck(
    stadium,
    report && { document: report, reading: progressOf(report) },
    plans.map((d) => ({ document: d, reading: progressOf(d) })),
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

/** File and check the preloaded sample progress documents. */
export function localSeed() {
  const stadiums = [];
  for (const f of progressReadings.files.filter((x) => x.folder === "preloaded")) {
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
  save();
}
