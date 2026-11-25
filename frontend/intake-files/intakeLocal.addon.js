export function localClear() {
  db = { documents: [], checks: {} };
  clearAlerts();
  save();
}

// ---------------------------------------------------------------- evidence documents
// Any other document is read here (PDFs through lib/intake/pdfText) and analysed by the evidence agent in
// lib/intake/evidenceAgent. The proposal carries what the agent found; filing records the document as evidence
// in the register (lib/store/assessments), where every page reads it from.
let docSeq = 0;

/** Add a document: the bundled sample documents as before, anything else through the evidence agent. */
export async function localIngest(file) {
  const sample = FILES.get(file.name);
  if (sample && sample.size === file.size) return localUpload(file);
  const existing = load().documents.find((d) => d.name === file.name && d.size === file.size);
  if (existing) return { ...existing, duplicate: true };
  const read = await readDocument(file);
  const result = analyseDocument({ name: file.name, size: file.size, ...read }, getAssessments());
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
    status: "proposed",
    superseded: 0,
    filed_at: null,
    name: file.name,
    size: file.size,
    pages: read.pageCount || 1,
    created_at: now(),
  };
  db.documents.unshift(row);
  if (row.stadium_id) raiseAlerts(result.analysis.alerts, { id: row.document_id, name: row.name, stadium_id: row.stadium_id });
  save();
  return row;
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
      note: `Filed from intake${doc.revision ? `, revision ${doc.revision}` : ""}`,
    });
    done.push(match.requirement_id);
  }
  return done;
}

/** File a document; an evidence document is also recorded in the register. */
export function localFileAndSync(id, filing) {
  localFile(id, filing);
  const d = load().documents.find((x) => x.document_id === id);
  if (d && d.kind === "evidence" && d.analysis) {
    d.registered = syncEvidenceToRegister(d);
    retargetAlerts(id, d.stadium_id);
    save();
  }
}
