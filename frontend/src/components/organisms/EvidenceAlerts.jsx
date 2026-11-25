"use client";

import { useState } from "react";
import StatusPill from "@/components/atoms/StatusPill";
import { getAlerts, setAlertStatus } from "@/lib/store/alerts";

const SHOW = [
  ["agent", "Raised by the agents"],
  ["change", "From requirement changes"],
  ["all", "All open alerts"],
  ["resolved", "Resolved"],
];

/** Alerts to requirement owners, with filters. */
export default function EvidenceAlerts() {
  const [show, setShow] = useState("agent");
  const [owner, setOwner] = useState("");
  const all = getAlerts();
  const bySource = all.filter((a) =>
    show === "resolved" ? a.status === "resolved" : a.status === "open" && (show === "all" || a.source === show),
  );
  const owners = [...new Set(bySource.map((a) => a.owner))].sort();
  const list = owner ? bySource.filter((a) => a.owner === owner) : bySource;
  return (
    <section aria-label="Alerts">
      <div className="ev-filters">
        <label className="f">
          Show
          <select value={show} onChange={(e) => setShow(e.target.value)}>
            {SHOW.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="f">
          Owner
          <select value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">All owners ({owners.length})</option>
            {owners.map((o) => (
              <option key={o} value={o}>
                {o} ({bySource.filter((a) => a.owner === o).length})
              </option>
            ))}
          </select>
        </label>
      </div>
      {!list.length ? (
        <p className="muted small">
          {all.length
            ? "No alerts match these filters."
            : "No alerts yet. When you confirm a document with a gap, or apply a requirement change, the owners are alerted here."}
        </p>
      ) : (
        <ol className="ev-alerts">
          {list.map((a) => (
            <li key={a.id} className={a.status}>
              <StatusPill tone={a.severity === "High" ? "bad" : "warn"}>{a.severity}</StatusPill>
              <div>
                <b>{a.title || a.requirementId}</b>
                <p className="m0">{a.message}</p>
                <span className="muted small">
                  {[a.stadiumName, a.requirementId, a.owner, a.at, a.source === "change" ? "Requirement change" : "Raised by the agent", a.document]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <button type="button" className="ghost" onClick={() => setAlertStatus(a.id, a.status === "open" ? "resolved" : "open")}>
                {a.status === "open" ? "Resolve" : "Reopen"}
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
