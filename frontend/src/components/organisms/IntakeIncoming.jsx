"use client";

import { useRef, useState } from "react";
import StatusPill from "@/components/atoms/StatusPill";
import {
  KIND_LABEL,
  dismissUpload,
  fileDocument,
  intake,
  proposalReady,
  proposedDocuments,
  removeDocument,
  uploadFiles,
} from "@/lib/store/intake";

const FILING = ["kind", "stadium_id", "element", "as_of", "revision"];
const filingOf = (d) => Object.fromEntries(FILING.map((k) => [k, d[k] ?? null]));

function DropZone() {
  const input = useRef(null);
  const [over, setOver] = useState(false);
  const take = (files) => files?.length && uploadFiles(files);
  return (
    <div
      className={`intake-drop ${over ? "over" : ""}`.trim()}
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
      <b>Drop contractor documents here</b>
      <span className="muted small">
        Progress reports and detailed plans · PDF, TXT or Markdown, 10 MB each.{" "}
        {intake.mode === "offline"
          ? "Offline demo: only the sample documents in data/progress can be read."
          : "Text is sent to Azure to read it."}
      </span>
      <button type="button" onClick={() => input.current?.click()}>
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

function Proposal({ doc }) {
  const [form, setForm] = useState(() => filingOf(doc));
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v || null }));
  const ready = proposalReady({ ...doc, ...form, confidence: doc.confidence });
  const complete = form.kind && form.kind !== "other" && form.stadium_id && (form.kind !== "detailed-plan" || form.element);
  const busy = !!intake.busy[doc.document_id];
  return (
    <li className="rq-item intake-row">
      <div className="rq-where">
        <b className="intake-name">{doc.name}</b>
        <span className="muted small">
          {doc.pages} page{doc.pages === 1 ? "" : "s"}
        </span>
        <div>
          {ready ? (
            <StatusPill tone="good">Ready to file</StatusPill>
          ) : (
            <StatusPill tone="warn">Needs your input</StatusPill>
          )}
        </div>
      </div>
      <div className="rq-what">
        <div className="intake-fields">
          <label className="f">
            Type
            <select value={form.kind || ""} onChange={(e) => set("kind", e.target.value)}>
              <option value="">Choose…</option>
              {Object.entries(KIND_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="f">
            Stadium
            <select value={form.stadium_id || ""} onChange={(e) => set("stadium_id", e.target.value)}>
              <option value="">Choose…</option>
              {intake.stadiums.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          {form.kind === "detailed-plan" && (
            <label className="f">
              Scope element
              <select value={form.element || ""} onChange={(e) => set("element", e.target.value)}>
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
            <input type="date" value={form.as_of || ""} onChange={(e) => set("as_of", e.target.value)} />
          </label>
          <label className="f intake-rev">
            Revision
            <input value={form.revision || ""} maxLength={20} onChange={(e) => set("revision", e.target.value)} />
          </label>
        </div>
        <p className="muted small m0">
          {doc.evidence_quote ? (
            <>
              Agent&apos;s reading: “{doc.evidence_quote}” (p. {doc.evidence_page}) · confidence {doc.confidence}
            </>
          ) : (
            "The agent could not identify this document with confidence. Check the details before filing."
          )}
        </p>
      </div>
      <div className="rq-act">
        <button
          type="button"
          className="primary"
          disabled={!complete || busy}
          onClick={() => fileDocument(doc.document_id, form)}
        >
          File
        </button>
        <button type="button" className="ghost" disabled={busy} onClick={() => removeDocument(doc.document_id)}>
          Remove
        </button>
      </div>
    </li>
  );
}

/** Incoming: upload, see what the agent proposes, confirm and file. */
export default function IntakeIncoming() {
  const proposals = proposedDocuments();
  const ready = proposals.filter(proposalReady);
  return (
    <section className="comp-block" aria-labelledby="intake-incoming">
      <div className="comp-block-head">
        <div>
          <span className="eyebrow">1 · Incoming</span>
          <h2 id="intake-incoming">Drop documents; the agent sorts them</h2>
          <p>
            For each document the agent proposes its type, stadium, scope element and date, and quotes what it based
            that on. Confirm or correct, then file.
          </p>
        </div>
        {ready.length > 1 && (
          <button
            type="button"
            className="primary"
            onClick={async () => {
              for (const d of ready) await fileDocument(d.document_id, filingOf(d));
            }}
          >
            File all {ready.length} ready
          </button>
        )}
      </div>
      <DropZone />
      {(intake.uploads.length > 0 || proposals.length > 0) && (
        <ol className="rq-list">
          {intake.uploads.map((u) => (
            <li key={u.key} className="rq-item intake-row">
              <div className="rq-where">
                <b className="intake-name">{u.name}</b>
              </div>
              <div className="rq-what">
                {u.error ? (
                  <span role="alert" className="small">
                    <StatusPill tone="bad">Not uploaded</StatusPill> {u.error}
                  </span>
                ) : (
                  <span className="muted small intake-working">Reading and classifying…</span>
                )}
              </div>
              <div className="rq-act">
                {u.error && (
                  <button type="button" className="ghost" onClick={() => dismissUpload(u.key)}>
                    Dismiss
                  </button>
                )}
              </div>
            </li>
          ))}
          {proposals.map((d) => (
            <Proposal key={`${d.document_id}:${d.kind}:${d.stadium_id}:${d.element}`} doc={d} />
          ))}
        </ol>
      )}
    </section>
  );
}
