"use client";

import Link from "next/link";
import { useState } from "react";
import StatusPill from "@/components/atoms/StatusPill";
import { currentRequirement } from "@/lib/domain/requirementVersions.mjs";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";
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
          {KIND_LABEL[alert.kind] || alert.kind} · {alert.source.type === "document" ? alert.source.name : alert.source.name} · for{" "}
          <b>{alert.owner}</b> · due {dateText(alert.due)} · raised {dateText(alert.raised_on)}
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

/** Alerts to the owners of requirements: raised from the documents the agent reads, and from the register itself. */
export default function AlertsPanel() {
  const records = getAssessments();
  const all = allAlerts(records);
  const [owner, setOwner] = useState("");
  const [showAll, setShowAll] = useState(false);
  const owners = [...new Set(all.map((a) => a.owner))].sort();
  const mine = owner ? all.filter((a) => a.owner === owner) : all;
  const shown = showAll ? mine : mine.slice(0, LIMIT);
  const open = all.filter((a) => a.status === "open");
  const tiles = [
    [open.length, "open alerts", open.length ? "warn" : "good"],
    [open.filter((a) => a.severity === "high").length, "high severity", open.some((a) => a.severity === "high") ? "bad" : ""],
    [all.filter((a) => a.source.type === "document" && a.status === "open").length, "from documents", ""],
    [new Set(open.map((a) => a.owner)).size, "owners to act", ""],
  ];
  return (
    <section className="comp-block" aria-labelledby="intake-alerts">
      <div className="comp-block-head">
        <div>
          <span className="eyebrow">4 · Alerts</span>
          <h2 id="intake-alerts">Alerts to owners</h2>
          <p>
            The agent watches every document that comes in and the register itself. When it finds a gap, an inconsistency
            or a figure below its criterion, it alerts the owner of that requirement with what to do and by when.
          </p>
        </div>
      </div>
      <div className="mini-grid four">
        {tiles.map(([n, label, tone]) => (
          <div key={label} className={`mini ${tone}`.trim()}>
            <b>{n}</b>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="filters">
        <label className="f">
          Owner
          <select value={owner} onChange={(e) => { setOwner(e.target.value); setShowAll(false); }}>
            <option value="">All owners ({all.length})</option>
            {owners.map((o) => (
              <option key={o} value={o}>
                {o} ({all.filter((a) => a.owner === o).length})
              </option>
            ))}
          </select>
        </label>
      </div>
      {mine.length === 0 ? (
        <p className="muted small">No alerts.</p>
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
    </section>
  );
}
