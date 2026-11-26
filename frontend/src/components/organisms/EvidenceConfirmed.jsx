"use client";

import Link from "next/link";

const plural = (n, one) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** What confirming did, per document, with where to go next. results: from confirmDocument(). */
export default function EvidenceConfirmed({ results, onMore }) {
  const filed = results.filter((r) => !r.failed);
  const evidence = filed.some((r) => r.kind === "evidence");
  const checks = filed.filter((r) => r.checkStarted);
  return (
    <section className="ev-agent" aria-live="polite">
      <h2 className="ev-confirmed-title">
        Evidence confirmed <span className="ev-new">★ New</span>
      </h2>
      <ul className="ev-confirmed">
        {results.map((r) => (
          <li key={r.id}>
            <b>{r.name}</b>{" "}
            {r.failed ? (
              <span className="bad">could not be filed: {r.error}</span>
            ) : r.kind === "evidence" ? (
              <span>
                {r.registered.length
                  ? `recorded against ${plural(r.registered.length, "requirement")} at ${r.stadium}`
                  : `kept on file for ${r.stadium}`}
                {r.alerts ? `; ${plural(r.alerts, "alert")} sent to ${r.owners.join(" and ")}` : ""}.
              </span>
            ) : (
              <span>
                filed for {r.stadium}
                {r.checkStarted ? "; the progress check is running." : "."}
              </span>
            )}
          </li>
        ))}
      </ul>
      <div className="ev-confirm">
        {evidence && (
          <Link className="btn primary" href="/review">
            Open Review Queue
          </Link>
        )}
        {checks.length > 0 && (
          <Link className="btn" href={`/project-progress?stadium=${encodeURIComponent(checks[0].stadiumId)}#finding`}>
            Open the progress finding
          </Link>
        )}
        <button type="button" className="linkish" onClick={onMore}>
          Add more documents
        </button>
      </div>
    </section>
  );
}
