"use client";

import { useEffect, useState } from "react";
import StatusPill from "@/components/atoms/StatusPill";
import EvidenceAnalysis from "@/components/organisms/EvidenceAnalysis";
import { confirmDocument, describeEffect, primaryLabel, reanalyse, typeOptions } from "@/lib/store/evidence";
import { intake, proposedDocuments, removeDocument } from "@/lib/store/intake";

const FIELDS = ["kind", "stadium_id", "element", "as_of", "revision"];
const formOf = (d) => Object.fromEntries(FIELDS.map((k) => [k, d[k] ?? null]));
const stadiumName = (id) => intake.stadiums.find((s) => s.id === id)?.name;
const dateText = (iso) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "";

function Card({ doc, onDone }) {
  const [form, setForm] = useState(() => formOf(doc));
  const [editing, setEditing] = useState(() => !formOf(doc).stadium_id || !formOf(doc).kind || formOf(doc).kind === "other");
  const [reading, setReading] = useState(false);
  // When the agent reads the document again (another stadium chosen), the form follows what it found.
  const signature = `${doc.stadium_id}|${doc.kind}|${doc.as_of}|${doc.revision}`;
  useEffect(() => {
    setForm(formOf(doc));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  const busy = !!intake.busy[doc.document_id] || reading;
  const effect = describeEffect(doc, form);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v || null }));
  const changeStadium = async (value) => {
    set("stadium_id", value);
    if (doc.analysis && value) {
      setReading(true);
      await reanalyse(doc.document_id, value);
      setReading(false);
    }
  };
  const meta = [stadiumName(form.stadium_id), form.revision ? `revision ${form.revision}` : null, form.as_of ? dateText(form.as_of) : null, `${doc.pages} page${doc.pages === 1 ? "" : "s"}`].filter(Boolean);
  return (
    <li className="ev-card">
      <div className="ev-card-head">
        <div>
          <b className="ev-name">{doc.name}</b>
          <div className="muted small">{meta.join(" · ")}</div>
        </div>
        {effect.ready ? <StatusPill tone="good">Ready to confirm</StatusPill> : <StatusPill tone="warn">Needs your input</StatusPill>}
      </div>

      <div className="ev-section">
        <h4>What the agent found</h4>
        {doc.analysis ? (
          <EvidenceAnalysis doc={doc} />
        ) : (
          <p className="muted small m0">
            {doc.evidence_quote ? (
              <>
                Reading: “{doc.evidence_quote}” (p. {doc.evidence_page}) · confidence {doc.confidence}
              </>
            ) : (
              "The agent could not identify this document with confidence. Check the details before confirming."
            )}
          </p>
        )}
      </div>

      <div className="ev-section ev-effect">
        <h4>If you confirm</h4>
        <ul>
          {effect.lines.map((l, i) => (
            <li key={i} className={`${l.indent ? "indent" : ""} ${l.tone || ""}`.trim()}>
              {l.text}
            </li>
          ))}
        </ul>
      </div>

      {editing && (
        <div className="ev-section ev-edit">
          <h4>Details</h4>
          <div className="intake-fields">
            <label className="f">
              Type
              <select value={form.kind || ""} onChange={(e) => set("kind", e.target.value)}>
                <option value="">Choose…</option>
                {typeOptions(doc).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="f">
              Stadium
              <select value={form.stadium_id || ""} disabled={reading} onChange={(e) => changeStadium(e.target.value)}>
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
        </div>
      )}

      <div className="ev-actions">
        <button
          type="button"
          className="primary ev-cta"
          disabled={!effect.ready || busy}
          onClick={async () => onDone(await confirmDocument(doc, form))}
        >
          {busy ? "Working…" : primaryLabel(form.kind)}
        </button>
        <button type="button" className="ghost" onClick={() => setEditing((v) => !v)}>
          {editing ? "Hide details" : "Edit details"}
        </button>
        <button type="button" className="linkish" disabled={busy} onClick={() => removeDocument(doc.document_id)}>
          Remove
        </button>
        {!effect.ready && <span className="muted small">{effect.blocked}</span>}
      </div>
    </li>
  );
}

/** Documents the agent has read and the person has not yet confirmed. */
export default function EvidenceToConfirm({ onDone }) {
  const docs = proposedDocuments();
  if (!docs.length)
    return <p className="muted ev-empty">Nothing is waiting. Drop a document above and the agent will show what it found here.</p>;
  return (
    <ol className="ev-cards">
      {docs.map((d) => (
        <Card key={d.document_id} doc={d} onDone={onDone} />
      ))}
    </ol>
  );
}
