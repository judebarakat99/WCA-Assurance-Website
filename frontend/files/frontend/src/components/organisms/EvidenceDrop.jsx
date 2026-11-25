"use client";

import { useRef, useState } from "react";
import StatusPill from "@/components/atoms/StatusPill";
import { UPLOAD_STAGES, dismissUpload, intake, uploadFiles } from "@/lib/store/intake";

/** Where documents come in. Dropping a file starts the agent reading it; nothing is recorded yet. */
export default function EvidenceDrop() {
  const input = useRef(null);
  const [over, setOver] = useState(false);
  const take = (files) => files?.length && uploadFiles(files);
  return (
    <section aria-label="Add documents">
      <div
        className={`ev-drop${over ? " over" : ""}`}
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
          aria-label="Documents"
          onChange={(e) => {
            take(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {intake.uploads.length > 0 && (
        <ul className="ev-uploads" aria-live="polite">
          {intake.uploads.map((u) => (
            <li key={u.key}>
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
                  <span className="small ev-working">{u.stage == null ? "Waiting…" : `${UPLOAD_STAGES[u.stage]}…`}</span>
                  <span className="ev-bar" aria-hidden="true">
                    <i style={{ width: `${u.stage == null ? 4 : Math.round(((u.stage + 1) / UPLOAD_STAGES.length) * 100)}%` }} />
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
