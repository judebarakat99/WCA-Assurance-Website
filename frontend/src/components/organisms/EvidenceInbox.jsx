"use client";

import { useRef, useState } from "react";
import StatusPill from "@/components/atoms/StatusPill";
import { ELEMENTS } from "@/lib/domain/progressCheck.mjs";
import {
  TYPE_OPTIONS,
  UPLOAD_STAGES,
  assessment,
  dismissUpload,
  fileDocument,
  intake,
  proposedDocuments,
  removeDocument,
  stadiumName,
  typeValue,
} from "@/lib/store/intake";

const longDate = (iso) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null;

/** Drop zone for contractors' documents. */
export function DropZone({ onFiles }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);
  const take = (files) => files?.length && onFiles(files);
  return (
    <div
      className={`ev-drop ${over ? "over" : ""}`.trim()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files);
      }}
    >
      <div>
        <b>Drop documents here</b>
        <span className="muted small">
          Drawings, calculations, test records and certificates as evidence; progress reports and detailed plans.
          <br />
          PDF, TXT or Markdown, up to 10 MB each.
        </span>
      </div>
      <button type="button" className="primary" onClick={() => input.current?.click()}>
        Choose files
      </button>
      <input
        ref={input}
        type="file"
        multiple
        accept=".pdf,.txt,.md"
        hidden
        aria-label="Contractor documents"
        onChange={(e) => {
          take(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** Files being read, with what the agent is doing. */
export function Uploads() {
  if (!intake.uploads.length) return null;
  return (
    <div className="ev-uploads">
      {intake.uploads.map((u) => (
        <div key={u.key} className="ev-upload">
          <b className="ev-name">{u.name}</b>
          {u.error ? (
            <>
              <span role="alert" className="small">
                <StatusPill tone="bad">Not added</StatusPill> {u.error}
              </span>
              <button type="button" className="linkish small" onClick={() => dismissUpload(u.key)}>
                Dismiss
              </button>
            </>
          ) : (
            <>
              <span className="small muted">{u.stage == null ? "Waiting…" : `${UPLOAD_STAGES[u.stage]}…`}</span>
              <span className="agent-bar ev-upload-bar" aria-hidden="true">
                <i style={{ width: `${u.stage == null ? 4 : ((u.stage + 1) / UPLOAD_STAGES.length) * 100 - 12}%` }} />
              </span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function Steps({ steps }) {
  return (
    <ol className="ev-steps">
      {steps.map((s) => (
        <li key={s.label} className={s.ok ? "ok" : "flag"}>
          <i aria-hidden="true">{s.ok ? "✓" : "!"}</i>
          <b>{s.label}</b>
          <span>{s.detail}</span>
        </li>
      ))}
    </ol>
  );
}

function summary(doc, result) {
  const r = doc.reading || {};
  if (doc.kind === "progress-report")
    return r.progress
      ? `A progress report for ${stadiumName(doc.stadium_id) || "an unidentified stadium"}, claiming ${r.progress.data.overall_claimed}% overall at ${longDate(r.progress.data.as_of)}.`
      : "A progress report whose tables could not be read.";
  if (doc.kind === "detailed-plan")
    return r.progress
      ? `A detailed plan for ${ELEMENTS[doc.element]?.toLowerCase() || "an unidentified scope element"}: ${r.progress.data.activities.length} activities with weights, planned dates and actual completion.`
      : "A detailed plan whose activity table could not be read.";
  if (!result.matches.length) return "The agent found no requirement in the register that this document speaks to.";
  return `The agent found ${result.matches.length} requirement${result.matches.length === 1 ? "" : "s"} in the register that this document speaks to${result.failing.length ? `; ${result.failing.length} ${result.failing.length === 1 ? "is" : "are"} below the criterion` : ", all meeting their criteria"}.`;
}

function detailsOf(doc) {
  return {
    type: typeValue(doc),
    stadium_id: doc.stadium_id || "",
    element: doc.element || "",
    as_of: doc.as_of || "",
    revision: doc.revision || "",
  };
}

const toDetails = (f) => {
  const [kind, evidenceType] = f.type.split(":");
  return {
    kind,
    evidenceType: evidenceType || null,
    stadium_id: f.stadium_id || null,
    element: kind === "detailed-plan" ? f.element || null : null,
    as_of: f.as_of || null,
    revision: f.revision || null,
  };
};

/** One document waiting to be confirmed: what the agent found, what confirming does, and its details. */
export function DocumentCard({ doc }) {
  const [form, setForm] = useState(() => detailsOf(doc));
  const [details, setDetails] = useState(true);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const d = toDetails(form);
  const result = assessment(doc, d);
  const busy = !!intake.busy[doc.document_id];
  const meta = [
    stadiumName(d.stadium_id),
    d.revision && `revision ${d.revision}`,
    longDate(d.as_of),
    `${doc.pages} page${doc.pages === 1 ? "" : "s"}`,
  ].filter(Boolean);
  return (
    <article className="ev-card" aria-label={doc.name}>
      <header className="ev-card-head">
        <div>
          <b className="ev-name">{doc.name}</b>
          <span className="muted small">{meta.join(" · ")}</span>
        </div>
        {result.blocker ? <StatusPill tone="warn">Needs your input</StatusPill> : <StatusPill tone="good">Ready to confirm</StatusPill>}
      </header>
      <h4 className="ev-h">What the agent found</h4>
      <div className="ev-box">
        {!doc.reading?.readable ? (
          <p className="m0">
            <StatusPill tone="warn">Text not readable</StatusPill> This file has no text the agent can read (it may be a
            scan), so it was identified from the file name only. Check the details before confirming.
          </p>
        ) : (
          <p className="m0">{summary({ ...doc, ...d }, result)}</p>
        )}
        <details className="ev-how">
          <summary>How the agent checked this document</summary>
          <Steps steps={result.steps} />
        </details>
      </div>
      <div className="ev-box ev-confirm">
        <h4 className="ev-h m0">If you confirm</h4>
        <ul>{(result.blocker ? [result.blocker.text] : result.effects).map((e) => <li key={e}>{e}</li>)}</ul>
      </div>
      {details && (
        <>
          <h4 className="ev-h">Details</h4>
          <div className="ev-fields">
            <label className="f">
              Type
              <select value={form.type} onChange={set("type")}>
                {TYPE_OPTIONS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="f">
              Stadium
              <select value={form.stadium_id} onChange={set("stadium_id")}>
                <option value="">Choose…</option>
                {intake.stadiums.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            {d.kind === "detailed-plan" && (
              <label className="f">
                Scope element
                <select value={form.element} onChange={set("element")}>
                  <option value="">Choose…</option>
                  {intake.elements.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="f">
              Date
              <input type="date" value={form.as_of} onChange={set("as_of")} />
            </label>
            <label className="f">
              Revision
              <input value={form.revision} maxLength={20} onChange={set("revision")} />
            </label>
          </div>
        </>
      )}
      <div className="ev-actions">
        <button type="button" className="primary" disabled={!!result.blocker || busy} onClick={() => fileDocument(doc.document_id, d)}>
          {busy ? "Confirming…" : result.blocker ? result.blocker.button : "Confirm"}
        </button>
        <button type="button" className="ghost" onClick={() => setDetails(!details)}>
          {details ? "Hide details" : "Show details"}
        </button>
        <button type="button" className="ghost ev-remove" disabled={busy} onClick={() => removeDocument(doc.document_id)}>
          Remove
        </button>
        {result.blocker && <span className="muted small">{result.blocker.button} to continue.</span>}
      </div>
    </article>
  );
}

/** To confirm: documents the agent has read, waiting for a person. */
export default function EvidenceInbox() {
  const docs = proposedDocuments();
  const ready = docs.filter((doc) => !assessment(doc).blocker);
  return (
    <section aria-label="To confirm">
      {ready.length > 1 && (
        <div className="ev-bulk">
          <span className="muted small">
            {ready.length} of {docs.length} documents are ready to confirm as the agent read them.
          </span>
          <button
            type="button"
            className="primary"
            onClick={async () => {
              for (const doc of ready) {
                const f = detailsOf(doc);
                await fileDocument(doc.document_id, toDetails(f));
              }
            }}
          >
            Confirm all {ready.length}
          </button>
        </div>
      )}
      {!docs.length && <p className="muted small">Nothing to confirm. Drop a document above and the agent reads it.</p>}
      <div className="ev-cards">
        {docs.map((doc) => (
          <DocumentCard key={doc.document_id} doc={doc} />
        ))}
      </div>
    </section>
  );
}
