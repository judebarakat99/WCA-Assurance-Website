"use client";

import Link from "next/link";
import StatusPill from "@/components/atoms/StatusPill";
import { CHECK_STATUS, KIND_LABEL, filedDocuments, intake, removeDocument } from "@/lib/store/intake";

const stadiumName = (id) => intake.stadiums.find((s) => s.id === id)?.name || id;
const elementName = (id) => intake.elements.find((e) => e.id === id)?.name || id;
const dateText = (iso) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "no date";

function What({ d }) {
  if (d.superseded) return <span className="muted">Replaced by a newer revision</span>;
  if (d.kind === "evidence")
    return d.registered?.length ? (
      <>
        Evidence for{" "}
        {d.registered.map((id, i) => (
          <span key={id}>
            {i ? ", " : ""}
            <span className="mono">{id}</span>
          </span>
        ))}
      </>
    ) : (
      <span className="muted">Kept on file; no requirement was recorded</span>
    );
  const check = intake.checks[d.stadium_id];
  const s = check && CHECK_STATUS[check.status];
  return (
    <>
      {d.kind === "progress-report" ? "Current progress report" : `Current ${elementName(d.element).toLowerCase()} plan`}
      {s && (
        <>
          {" · "}
          <StatusPill tone={s.tone}>{s.label}</StatusPill>{" "}
          <Link className="linkish small" href={`/evidence?tab=checks&stadium=${encodeURIComponent(d.stadium_id)}`}>
            View check
          </Link>
        </>
      )}
    </>
  );
}

/** What has been confirmed: each document, what it did, and the stadium it belongs to. */
export default function EvidenceOnFile() {
  const docs = filedDocuments();
  if (!docs.length) return <p className="muted ev-empty">Nothing on file yet. Documents you confirm appear here.</p>;
  const hasEvidence = docs.some((d) => d.kind === "evidence");
  return (
    <>
      <div className="tablewrap">
        <table className="ev-table">
          <thead>
            <tr>
              <th scope="col">Document</th>
              <th scope="col">Type</th>
              <th scope="col">Stadium</th>
              <th scope="col">Revision and date</th>
              <th scope="col">What it did</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.document_id} className={d.superseded ? "muted" : undefined}>
                <td>
                  <b className="ev-name">{d.name}</b>
                </td>
                <td>{KIND_LABEL[d.kind] || d.kind}</td>
                <td>
                  <Link href={`/facilities/${d.stadium_id}`}>{stadiumName(d.stadium_id)}</Link>
                </td>
                <td className="small">
                  {d.revision ? `rev ${d.revision} · ` : ""}
                  {dateText(d.as_of)}
                </td>
                <td className="small">
                  <What d={d} />
                </td>
                <td>
                  <button type="button" className="linkish small" disabled={!!intake.busy[d.document_id]} onClick={() => removeDocument(d.document_id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasEvidence && (
        <p className="muted small">
          Removing a document withdraws its alerts. Evidence it already recorded in the register stays; a reviewer can reject it in the review queue.
        </p>
      )}
    </>
  );
}
