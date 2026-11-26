"use client";

import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";

/**
 * Where documents come in, with optional context for the agent (the stadium, and what the evidence is for; a link
 * from the review queue fills both). onFiles(files, context) starts the agent; nothing is recorded yet.
 */
export default function EvidenceDrop({ onFiles }) {
  const input = useRef(null);
  const params = useSearchParams();
  const [over, setOver] = useState(false);
  const [stadiumId, setStadiumId] = useState(() => params.get("stadium") || "");
  const [purpose, setPurpose] = useState(() => params.get("purpose") || "");
  const take = (files) => {
    if (files?.length) onFiles(Array.from(files), { stadiumId, purpose });
  };
  return (
    <section aria-label="Add documents">
      <div className="ev-context">
        <div className="ev-fields">
          <label className="f">
            Stadium (optional)
            <select value={stadiumId} onChange={(e) => setStadiumId(e.target.value)}>
              <option value="">Let the agent identify it</option>
              {FACILITY_REGISTER.stadiums.map((stadium) => (
                <option key={stadium.id} value={stadium.id}>
                  {stadium.name}
                </option>
              ))}
            </select>
          </label>
          <label className="f">
            What is this evidence for? (optional)
            <input
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. accessible seating distribution"
            />
          </label>
        </div>
        <p className="muted small ev-context-note">
          Filling these details is optional. The agent will attempt to recognize which stadium the document belongs to
          and what the evidence is for.
        </p>
      </div>
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
            Drawings, calculations, test records and certificates as evidence; progress reports and detailed plans. PDF,
            TXT or Markdown, up to 10 MB each.
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
    </section>
  );
}
