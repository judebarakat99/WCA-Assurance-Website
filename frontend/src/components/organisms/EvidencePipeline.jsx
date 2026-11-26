"use client";

import StatusPill from "@/components/atoms/StatusPill";
import { UPLOAD_STAGES, dismissUpload } from "@/lib/store/intake";

const CHECKS = [
  "Reading the document and extracting its text",
  "Identifying the stadium and evidence type",
  "Comparing the evidence with the FIFA requirement register",
  "Preparing the proposed review-queue change",
];
const last = UPLOAD_STAGES.length - 1;

/** The agent at work on a batch: each file's place in the pipeline, and the checks for the batch so far. */
export default function EvidencePipeline({ uploads }) {
  const working = uploads.filter((u) => !u.error);
  const reached = working.length ? Math.min(...working.map((u) => u.stage ?? -1)) : last;
  return (
    <section className="ev-agent" aria-live="polite" aria-labelledby="ev-agent-title">
      <h2 id="ev-agent-title">Evidence intake</h2>
      <p className="ev-section-sub">
        Incoming reports, plans, audit documents and evidence move through a visible pipeline before anything is
        confirmed.
      </p>
      <ol className="ev-queue">
        {uploads.map((u) => (
          <li key={u.key} className="ev-queue-item">
            <div className="ev-queue-file">
              <b>{u.name}</b>
              {u.error ? (
                <span role="alert" className="small">
                  <StatusPill tone="bad">Not added</StatusPill> {u.error}{" "}
                  <button type="button" className="linkish small" onClick={() => dismissUpload(u.key)}>
                    Dismiss
                  </button>
                </span>
              ) : (
                <StatusPill tone={u.stage === last ? "good" : "warn"}>{UPLOAD_STAGES[u.stage ?? 0]}</StatusPill>
              )}
            </div>
            {!u.error && (
              <div className="ev-pipeline" aria-label={`Pipeline for ${u.name}`}>
                {UPLOAD_STAGES.map((stage, i) => (
                  <span
                    key={stage}
                    className={i < (u.stage ?? -1) || u.stage === last ? "done" : i === u.stage ? "now" : undefined}
                  >
                    {stage}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
      <h2>Agent checks</h2>
      <p className="ev-section-sub">
        The agent is reading the documents and preparing the evidence for your confirmation.
      </p>
      <ul className="ev-checks">
        {CHECKS.map((label, i) => (
          <li key={label} className={reached === last || reached > i ? "done" : undefined}>
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}
