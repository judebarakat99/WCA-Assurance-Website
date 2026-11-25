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
      note: `Filed from the Evidence page${doc.revision ? `, revision ${doc.revision}` : ""}`,
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
