"use client";

import { useRef, useState } from "react";
import { EV_STEPS, EV_TYPES, VENUES, critText, showVal, venueMeta } from "@/lib/domain/data";
import {
  addIntakeEvidence,
  intakeObligation,
  intakeTargets,
  resetIntake,
  runIntake,
  setIntake,
} from "@/lib/domain/intake";

function Steps({ step, running }) {
  if (step < 0) return null;
  return (
    <ol className="evflow">
      {EV_STEPS.map((s, i) => (
        <li key={s} className={i < step ? "done" : i === step && running ? "cur" : undefined}>
          <i>{i < step ? "✓" : i + 1}</i>
          {s}
        </li>
      ))}
    </ol>
  );
}

function Result({ S, intake }) {
  const r = intake.result;
  if (!r) return null;
  const o = S.obligations.find((x) => x.id === r.oid);
  return (
    <>
      <div className={`result ${r.ok ? "ok" : "no"}`} role="status">
        <b>{r.ok ? "Pass" : "Fail"}</b> · {intake.fileName} · {venueMeta(intake.venue).name}
        <br />
        Matched {o.id}: {o.text}
        <br />
        Extracted value <b>{showVal(o, r.val)}</b> against criterion <b>{critText(o)}</b>.
      </div>
      <div className="flex mt">
        <button type="button" className="primary" id="evAddBtn" disabled={intake.added} onClick={addIntakeEvidence}>
          {intake.added ? "Added as evidence ✓" : "Add as evidence"}
        </button>
        <button type="button" className="ghost" id="evIntakeReset" onClick={resetIntake}>
          Start over
        </button>
      </div>
      {intake.added && (
        <p className="muted fine note">
          The evidence is now in the register: it has updated the obligation state, any corrective action, and the
          readiness and gate calculations.
        </p>
      )}
    </>
  );
}

function DropZone({ fileName }) {
  const input = useRef(null);
  const [dragging, setDragging] = useState(false);
  const choose = () => input.current?.click();
  const take = (file) => file && setIntake({ fileName: file.name });
  return (
    <div
      className={`dropzone${fileName ? " has" : ""}${dragging ? " drag" : ""}`}
      id="evDrop"
      role="button"
      tabIndex={0}
      aria-label="Choose or drop a document"
      onClick={choose}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          choose();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        take(e.dataTransfer?.files?.[0]);
      }}
    >
      <input
        ref={input}
        type="file"
        id="evUpFile"
        hidden
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => take(e.target.files?.[0])}
      />
      {fileName ? (
        <>
          <b>{fileName}</b>
          <span>Click to choose a different document</span>
        </>
      ) : (
        <>
          <b>Drop a document here</b>
          <span>or click to choose a file · nothing is uploaded</span>
        </>
      )}
    </div>
  );
}

/** Simulated evidence intake: pick a target, drop a document, process it and add it as evidence. */
export default function EvidenceIntake({ S, ui }) {
  const intake = ui.intake;
  const { obligations, issues } = intakeTargets();
  const o = intakeObligation();
  return (
    <div className="panel" id="evIntake">
      <div className="eyebrow">Evidence intake · PoC simulation</div>
      <h3>Submit evidence against a requirement</h3>
      <p className="muted section-intro">
        No backend and no real upload: the document is read in the browser and the extraction is simulated. The
        result, however, is real: adding it updates the live register, corrective actions, readiness and gates. Tip:
        include “fail” in the file name to simulate failing evidence.
      </p>
      <div className="formrow evidence-fields">
        <label className="f" htmlFor="evVenueSel">
          Venue
          <select id="evVenueSel" value={intake.venue} onChange={(e) => setIntake({ venue: e.target.value })}>
            {VENUES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <label className="f" htmlFor="evTargetSel">
          Obligation or corrective action
          <select id="evTargetSel" value={intake.target} onChange={(e) => setIntake({ target: e.target.value })}>
            <option value="">Choose…</option>
            {issues.length > 0 && (
              <optgroup label="Open corrective actions">
                {issues.map((i) => (
                  <option key={i.id} value={`iss:${i.id}`}>
                    {i.id} · {i.title}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Obligations">
              {obligations.map((x) => (
                <option key={x.id} value={`obl:${x.id}`}>
                  {x.code} · {x.text}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <label className="f" htmlFor="evTypeSel">
          Evidence type
          <select
            id="evTypeSel"
            value={intake.etype}
            onChange={(e) => setIntake({ etype: Number(e.target.value) })}
          >
            {EV_TYPES.map(([t], i) => (
              <option key={t} value={i}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>
      {o && <div className="criterion mt">{critText(o)}</div>}
      <DropZone fileName={intake.fileName} />
      <div className="flex process-row">
        <button type="button" className="primary" id="evProcess" disabled={intake.running} onClick={runIntake}>
          {intake.running ? "Processing…" : "Process document"}
        </button>
      </div>
      <Steps step={intake.step} running={intake.running} />
      <Result S={S} intake={intake} />
    </div>
  );
}
