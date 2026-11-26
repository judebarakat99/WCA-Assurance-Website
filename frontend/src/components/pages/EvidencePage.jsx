"use client";

import { Suspense, useEffect, useState } from "react";
import PageHead from "@/components/molecules/PageHead";
import Stepper from "@/components/molecules/Stepper";
import EvidenceConfirmed from "@/components/organisms/EvidenceConfirmed";
import EvidenceDrop from "@/components/organisms/EvidenceDrop";
import EvidencePipeline from "@/components/organisms/EvidencePipeline";
import EvidenceProposal, { filingOf } from "@/components/organisms/EvidenceProposal";
import PageTemplate from "@/components/templates/PageTemplate";
import { confirmDocument, describeEffect } from "@/lib/store/evidence";
import {
  UPLOAD_STAGES,
  clearBatch,
  currentBatch,
  ensureIntake,
  intake,
  removeDocument,
  uploadFiles,
} from "@/lib/store/intake";

const STEPS = [
  { label: "Add", hint: "Drop documents" },
  { label: "Agent checks", hint: "Reads and compares" },
  { label: "Evidence to confirm", hint: "Review extracted content" },
  { label: "Confirmed", hint: "Appears in Review Queue", href: "/review" },
];
const last = UPLOAD_STAGES.length - 1;

/** The batch's documents as they stand now (a proposal can change when the person picks a stadium). */
function batchDocuments(batch) {
  const ids = batch.map((u) => u.document?.document_id).filter(Boolean);
  return intake.documents.filter((d) => ids.includes(d.document_id));
}

function Evidence() {
  useEffect(ensureIntake, []);
  const [results, setResults] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const batch = currentBatch();
  const working = batch.some((u) => !u.error && (u.stage ?? -1) < last);
  const docs = batchDocuments(batch);
  const proposals = docs.filter((d) => d.status === "proposed");
  const ready = proposals.filter((d) => describeEffect(d, filingOf(d)).ready);
  const step = results ? 4 : working ? 2 : proposals.length ? 3 : batch.length ? 2 : 1;

  async function confirm() {
    setConfirming(true);
    const out = [];
    for (const doc of ready) out.push(await confirmDocument(doc, filingOf(doc)));
    setConfirming(false);
    setResults(out);
  }
  // Start again. Proposals not confirmed are discarded, so nothing half-done is left behind.
  function more() {
    if (!results) proposals.forEach((d) => removeDocument(d.document_id));
    clearBatch();
    setResults(null);
  }

  return (
    <>
      <PageHead
        chip="Evidence · contractor documents"
        title="Evidence"
        wideLead
        lead="Add a contractor's document. The agent reads it, checks it against the FIFA requirements or plans, and shows the extracted content before you confirm it."
      />
      <Stepper steps={STEPS} current={step} label="Evidence workflow" />
      {step === 1 && <EvidenceDrop onFiles={(files, context) => uploadFiles(files, context)} />}
      {step === 2 && <EvidencePipeline uploads={batch} />}
      {step === 2 && !working && (
        <p className="ev-confirm">
          <span className="muted small">
            {docs.length ? "These documents are already on file." : "None of these files could be added."}
          </span>
          <button type="button" className="linkish" onClick={more}>
            Add other documents
          </button>
        </p>
      )}
      {step === 3 && (
        <section className="ev-agent" aria-labelledby="ev-confirm-title">
          <h2 id="ev-confirm-title">Evidence to confirm</h2>
          <p className="ev-section-sub">
            The agent found the following affected stadium, requirements and readiness effect. Confirming records the
            evidence and puts it at the top of the Review Queue.
          </p>
          {proposals.map((doc) => (
            <EvidenceProposal key={doc.document_id} doc={doc} />
          ))}
          <div className="ev-confirm">
            <span className="muted small">
              {ready.length < proposals.length
                ? `${proposals.length - ready.length} document${proposals.length - ready.length === 1 ? " needs" : "s need"} your input first.`
                : "Nothing is saved until you confirm."}
            </span>
            <span className="flex">
              <button type="button" className="linkish" onClick={more}>
                Cancel
              </button>
              <button type="button" className="primary" disabled={!ready.length || confirming} onClick={confirm}>
                {confirming
                  ? "Confirming…"
                  : ready.length > 1
                    ? `Confirm ${ready.length} documents`
                    : "Confirm evidence"}
              </button>
            </span>
          </div>
        </section>
      )}
      {step === 4 && <EvidenceConfirmed results={results} onMore={more} />}
    </>
  );
}

export default function EvidencePage() {
  return (
    <PageTemplate label="Evidence">
      {() => (
        <Suspense>
          <Evidence />
        </Suspense>
      )}
    </PageTemplate>
  );
}
