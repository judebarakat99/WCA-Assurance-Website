"use client";

import { useState } from "react";
import StatusPill from "@/components/atoms/StatusPill";
import { EXPOSURE, EXPOSURE_ORDER, nextGate, schedulePosition, stadiumExposure } from "@/lib/domain/exposure.mjs";
import { criterionLabel } from "@/lib/domain/fifa-catalogue.mjs";
import { dueDate, evidenceLine, formatDue, mitigationAction, ownerFor } from "@/lib/domain/mitigation.mjs";
import { pct } from "@/lib/format";

const FAMILY_ORDER = ["Capacity", "Pitch", "Lighting", "Access"];

function groupByFamily(findings) {
  const groups = new Map();
  for (const f of findings) {
    const family = f.row.requirement.category;
    groups.set(family, [...(groups.get(family) || []), f]);
  }
  return [...groups.entries()].sort(
    (a, b) => (FAMILY_ORDER.indexOf(a[0]) + 1 || 99) - (FAMILY_ORDER.indexOf(b[0]) + 1 || 99),
  );
}

function Finding({ finding }) {
  const { row, record, level, reason } = finding;
  const evidence = evidenceLine(record);
  const due = dueDate(level);
  return (
    <li className="xp-item">
      <div className="xp-item-head">
        <span className="mono">{row.requirement.id}</span>
        <b>{row.requirement.title}</b>
        <span className="muted small">{criterionLabel(row.requirement.criterion)}</span>
      </div>
      <dl className="xp-dl">
        <dt>Why this class</dt>
        <dd>{reason}</dd>
        {evidence && (
          <>
            <dt>Evidence</dt>
            <dd>{evidence}</dd>
          </>
        )}
        <dt>Mitigation</dt>
        <dd>{mitigationAction(finding)}</dd>
        <dt>Owner</dt>
        <dd>{ownerFor(row.requirement.category)}</dd>
        <dt>Due</dt>
        <dd>{formatDue(due)}</dd>
      </dl>
    </li>
  );
}

/**
 * Executive view of one stadium: where it is exposed and how hard recovery will be.
 * Tile -> family -> finding, with evidence, mitigation, owner and due date.
 */
export default function StadiumExposure({ stadium, records }) {
  const { counts, findings, total } = stadiumExposure(stadium, records);
  const firstOpen = EXPOSURE_ORDER.find((k) => counts[k] > 0) || "controlled";
  const [picked, setPicked] = useState(null);
  const selected = picked || firstOpen;
  const schedule = schedulePosition(counts);
  const assured = total ? findings.filter((f) => f.record?.status === "compliant").length / total : 0;
  const families = groupByFamily(findings.filter((f) => f.level === selected));
  return (
    <section className="xp" aria-labelledby="xp-title">
      <div className="xp-head">
        <h3 id="xp-title">Mitigation exposure</h3>
        <StatusPill tone={schedule.tone}>{schedule.label}</StatusPill>
        <span className="muted small">Next gate: {nextGate(stadium)}</span>
        <span className="muted small">{pct(assured)}% assured</span>
      </div>
      <p className="muted small xp-lead">
        Where this stadium is exposed and how difficult recovery will be. Each finding sits in one class, based on the
        cost of fixing it at the stadium's current stage.
      </p>

      <div className="mini-grid four xp-tiles" role="group" aria-label="Exposure classes">
        {EXPOSURE_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            className={`mini ${EXPOSURE[key].tone}`}
            aria-pressed={selected === key}
            onClick={() => setPicked(key)}
          >
            <b>{counts[key]}</b>
            <span>{EXPOSURE[key].label}</span>
          </button>
        ))}
      </div>
      <p className="muted small xp-def">{EXPOSURE[selected].definition}</p>

      {families.length === 0 ? (
        <p className="muted">No findings in this class.</p>
      ) : (
        families.map(([family, list]) => (
          <details key={family} className="xp-family" open={selected !== "controlled"}>
            <summary>
              <b>{family}</b>
              <span className={`nat-x ${EXPOSURE[selected].tone}`}>{list.length}</span>
            </summary>
            <ul className="xp-list">
              {list.map((f) => (
                <Finding key={f.row.key} finding={f} />
              ))}
            </ul>
          </details>
        ))
      )}
    </section>
  );
}
