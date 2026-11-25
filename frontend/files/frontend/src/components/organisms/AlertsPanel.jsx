"use client";

import Link from "next/link";
import { useState } from "react";
import StatusPill from "@/components/atoms/StatusPill";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";
import { currentRequirement } from "@/lib/domain/requirementVersions.mjs";
import { KIND_LABEL, SEVERITY, allAlerts, setAcknowledged } from "@/lib/store/alerts";
import { getAssessments } from "@/lib/store/assessments";

const LIMIT = 8;
const stadiumName = (id) => FACILITY_REGISTER.stadiums.find((s) => s.id === id)?.name || id;
const dateText = (iso) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "";

function Alert({ alert }) {
  const sev = SEVERITY[alert.severity];
  const req = alert.requirement_id ? currentRequirement(alert.requirement_id) : null;
  const done = alert.status === "acknowledged";
  return (
    <li className={`rq-item al-row${done ? " al-done" : ""}`}>
      <div className="rq-where">
        <Link href={`/facilities/${alert.stadium_id}`}>
          <b>{stadiumName(alert.stadium_id)}</b>
        </Link>
        <span className="muted small">
          {req ? (
            <>
              <span className="mono">{req.id}</span> {req.title}
            </>
          ) : (
            "Document"
          )}
        </span>
        <div>
          <StatusPill tone={sev.tone}>{sev.label}</StatusPill>
        </div>
      </div>
      <div className="rq-what">
        <div>
          <b>{alert.title}</b>
        </div>
        <div className="muted small">{alert.detail}</div>
        <div className="small">
          <b>Action:</b> {alert.action}
        </div>
        <div className="muted fine">
          {KIND_LABEL[alert.kind] || alert.kind} · {alert.source.name} · for <b>{alert.owner}</b> · due {dateText(alert.due)}
          {done && ` · acknowledged ${dateText(alert.acknowledged_on)}`}
        </div>
      </div>
      <div className="rq-act">
        {done ? (
          <button type="button" className="ghost" onClick={() => setAcknowledged(alert.id, false)}>
            Reopen
          </button>
        ) : (
          <button type="button" className="primary" onClick={() => setAcknowledged(alert.id, true)}>
            Acknowledge
          </button>
        )}
        <Link className="btnlink" href={`/facilities/${alert.stadium_id}`}>
          Open stadium →
        </Link>
      </div>
    </li>
  );
}

/**
 * Alerts to the owners of requirements. By default the ones the agents raised (from documents confirmed on the
 * Evidence page and from proposed requirement changes); the register's own critical findings can be shown too.
 */
export default function AlertsPanel() {
  const all = allAlerts(getAssessments());
  const [source, setSource] = useState("agents");
  const [owner, setOwner] = useState("");
  const [showAll, setShowAll] = useState(false);
  const bySource = all.filter((a) => (source === "agents" ? a.source.type !== "register" : source === "register" ? a.source.type === "register" : true));
  const owners = [...new Set(bySource.map((a) => a.owner))].sort();
  const mine = owner ? bySource.filter((a) => a.owner === owner) : bySource;
  const shown = showAll ? mine : mine.slice(0, LIMIT);
  return (
    <div>
      <div className="filters">
        <label className="f">
          Show
          <select value={source} onChange={(e) => { setSource(e.target.value); setOwner(""); setShowAll(false); }}>
            <option value="agents">Raised by the agents</option>
            <option value="register">Critical findings in the register</option>
            <option value="all">Both</option>
          </select>
        </label>
        <label className="f">
          Owner
          <select value={owner} onChange={(e) => { setOwner(e.target.value); setShowAll(false); }}>
            <option value="">All owners ({bySource.length})</option>
            {owners.map((o) => (
              <option key={o} value={o}>
                {o} ({bySource.filter((a) => a.owner === o).length})
              </option>
            ))}
          </select>
        </label>
      </div>
      {mine.length === 0 ? (
        <p className="muted ev-empty">
          {source === "agents" ? "No alerts yet. When you confirm a document with a gap, or notify the owners of a requirement change, they are alerted here." : "No alerts."}
        </p>
      ) : (
        <ol className="rq-list">
          {shown.map((a) => (
            <Alert key={a.id} alert={a} />
          ))}
        </ol>
      )}
      {mine.length > LIMIT && (
        <button type="button" className="linkish" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show fewer" : `Show all ${mine.length}`}
        </button>
      )}
    </div>
  );
}
