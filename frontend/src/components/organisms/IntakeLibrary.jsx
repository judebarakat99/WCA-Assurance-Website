"use client";

import StatusPill from "@/components/atoms/StatusPill";
import { filedDocuments, intake, removeDocument } from "@/lib/store/intake";

const elementName = (id) => intake.elements.find((e) => e.id === id)?.name || id;

function Doc({ d, newer }) {
  return (
    <li className={d.superseded ? "superseded" : undefined}>
      <span className="intake-name">{d.name}</span>
      <span className="muted small">
        {d.revision ? `rev ${d.revision} · ` : ""}
        {d.as_of || "no date"}
        {d.superseded && newer ? ` · superseded by rev ${newer.revision}` : ""}
      </span>
      <button
        type="button"
        className="linkish small"
        disabled={!!intake.busy[d.document_id]}
        onClick={() => removeDocument(d.document_id)}
      >
        Remove
      </button>
    </li>
  );
}

/** Library: filed documents per stadium, with gaps the latest check found. */
export default function IntakeLibrary() {
  const filed = filedDocuments();
  const stadiums = intake.stadiums.filter((s) => filed.some((d) => d.stadium_id === s.id));
  return (
    <section className="comp-block" aria-labelledby="intake-library">
      <div className="comp-block-head">
        <div>
          <span className="eyebrow">3 · Library</span>
          <h2 id="intake-library">What&apos;s on file</h2>
          <p>Only the newest revision of each document counts in checks; older ones are kept.</p>
        </div>
      </div>
      {!stadiums.length && <p className="muted small">Nothing filed yet.</p>}
      <div className="intake-lib">
        {stadiums.map((s) => {
          const docs = filed.filter((d) => d.stadium_id === s.id);
          const reports = docs.filter((d) => d.kind === "progress-report");
          const others = docs.filter((d) => d.kind === "other");
          const byElement = intake.elements
            .map((e) => [e, docs.filter((d) => d.kind === "detailed-plan" && d.element === e.id)])
            .filter(([, list]) => list.length);
          const missing = (intake.checks[s.id]?.packages || []).filter((p) => p.status === "evidence-missing");
          return (
            <div key={s.id} className="block intake-stadium">
              <h3>
                {s.name} <span className="muted small">{s.city}</span>
              </h3>
              <h4>Progress report</h4>
              {reports.length ? (
                <ul>
                  {reports.map((d) => (
                    <Doc key={d.document_id} d={d} newer={reports.find((x) => !x.superseded)} />
                  ))}
                </ul>
              ) : (
                <p className="small">
                  <StatusPill tone="warn">No progress report on file</StatusPill>
                </p>
              )}
              {byElement.map(([e, list]) => (
                <div key={e.id}>
                  <h4>{e.name} plan</h4>
                  <ul>
                    {list.map((d) => (
                      <Doc key={d.document_id} d={d} newer={list.find((x) => !x.superseded)} />
                    ))}
                  </ul>
                </div>
              ))}
              {missing.map((p) => (
                <p key={p.element} className="small">
                  <StatusPill tone="warn">Gap</StatusPill> The report claims {elementName(p.element).toLowerCase()}{" "}
                  progress, but no plan is on file.
                </p>
              ))}
              {others.length > 0 && (
                <>
                  <h4>Other</h4>
                  <ul>
                    {others.map((d) => (
                      <Doc key={d.document_id} d={d} />
                    ))}
                  </ul>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
