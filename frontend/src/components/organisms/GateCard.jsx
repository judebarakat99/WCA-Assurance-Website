"use client";

import Ring from "@/components/atoms/Ring";
import StatusPill from "@/components/atoms/StatusPill";
import GateTrack from "@/components/molecules/GateTrack";
import { fmtD } from "@/lib/domain/data";
import { requestGatePass, escalateGateBlockers } from "@/lib/domain/actions";
import { openDrawer } from "@/lib/drawer";

const MAX_BLOCKERS = 6;

function Rule({ rule }) {
  const extra = rule.blockers.length - MAX_BLOCKERS;
  return (
    <li className={rule.ok ? "ok" : "no"}>
      <span className={`ic ${rule.ok ? "ok" : "no"}`} aria-hidden="true">
        {rule.ok ? "✓" : "✕"}
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="rt">{rule.text}</div>
        {!rule.ok && (
          <div className="bch">
            {rule.blockers.slice(0, MAX_BLOCKERS).map((o) => (
              <button key={o.id} type="button" className="bchip" onClick={() => openDrawer(o.id)}>
                {o.code}
                <small>{o.state}</small>
              </button>
            ))}
            {extra > 0 && <span className="muted small">and {extra} more</span>}
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * A venue's next gate: the five-gate track, each gate rule with its blockers,
 * and the gate pass / escalation actions.
 * meta: venue reference data; venue: venue state; evaluation: gateEval() result or null.
 */
export default function GateCard({ meta, venue, evaluation: e }) {
  if (!e) {
    return (
      <div className="panel gcard" id={`gate-${meta.id}`}>
        <div className="gc-head">
          <div>
            <h3>{meta.name}</h3>
            <div className="muted small">{meta.city}</div>
          </div>
          <StatusPill tone="good">All gates passed</StatusPill>
        </div>
        <GateTrack index={venue.gateIdx} />
        <div className="okbig">
          <i>✓</i>
          <span>All gates passed</span>
        </div>
      </div>
    );
  }
  const okCount = e.rules.filter((r) => r.ok).length;
  return (
    <div className="panel gcard" id={`gate-${meta.id}`}>
      <div className="gc-head">
        <div style={{ minWidth: 0 }}>
          <h3>{meta.name}</h3>
          <div className="muted small">
            {meta.city} · gate{" "}
            <b>
              {e.gate.id} {e.gate.name}
            </b>{" "}
            due {fmtD(venue.gateDate)} · {e.scope.length} obligations in scope
          </div>
        </div>
        <StatusPill tone={e.pass ? "good" : "bad"}>{e.pass ? "Ready to pass" : "Gate blocked"}</StatusPill>
      </div>
      <GateTrack index={venue.gateIdx} />
      <div className="gc-body">
        <ul className="rules">
          {e.rules.map((r) => (
            <Rule key={r.text} rule={r} />
          ))}
        </ul>
        <div className="gc-side">
          <Ring
            parts={[
              { n: okCount, c: "var(--good)" },
              { n: e.rules.length - okCount, c: "var(--bad)" },
            ]}
            value={`${okCount}/${e.rules.length}`}
            label="rules pass"
            size="sm"
          />
          <button type="button" className={e.pass ? "gold" : undefined} onClick={() => requestGatePass(meta.id)}>
            Request gate pass
          </button>
          {!e.pass && (
            <button type="button" className="danger" onClick={() => escalateGateBlockers(meta.id)}>
              Escalate blockers
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
