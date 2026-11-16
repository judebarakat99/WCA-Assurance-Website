// Offline demo of document intake, used when the backend is not running.
// It has the backend's API shape, but reads the sample documents from bundled
// readings (data/progress/offline-readings.json, exported from the backend
// pipeline) instead of asking the model; only those files can be added.
// State is kept in this browser.
import readings from "../../../../data/progress/offline-readings.json" with { type: "json" };
import { ELEMENTS, buildCheck } from "@/lib/domain/progressCheck.mjs";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";

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
    const key = [d.kind, d.stadium_id, d.kind === "detailed-plan" ? d.element : ""].join("|");
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

/** Add a sample document; the proposal is the backend pipeline's own reading of it. */
export function localUpload(file) {
  const sample = FILES.get(file.name);
  if (!sample || sample.size !== file.size)
    throw new Error("Offline demo: without the backend only the sample documents in data/progress can be read.");
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

/** File and check the preloaded sample documents (as the backend's seed does). */
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
  save();
}
