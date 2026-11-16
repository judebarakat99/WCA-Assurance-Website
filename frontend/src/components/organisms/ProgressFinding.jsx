"use client";

import { useState } from "react";
import CountUp from "@/components/atoms/CountUp";
import StatusPill from "@/components/atoms/StatusPill";
import { CHECK_STATUS, decideCheck, needsDecision } from "@/lib/store/intake";

const pct = (v) => (v == null ? "–" : `${v}%`);

function Steps({ steps }) {
  return (
    <ol className="pf-steps">
      {steps.map((s, k) => (
        <li key={k} className={s.ok ? "ok" : "flag"}>
          <b>{s.label}</b>
          <span>{s.detail}</span>
        </li>
      ))}
    </ol>
  );
}

function Activities({ pkg }) {
  return (
    <div className="tablewrap">
      <table className="pf-acts">
        <thead>
          <tr>
            <th>Activity</th>
            <th>Weight</th>
            <th>Planned dates</th>
            <th>Planned by now</th>
            <th>Actual</th>
            <th>Page</th>
          </tr>
        </thead>
        <tbody>
          {pkg.activities.map((a) => (
            <tr key={a.ref} className={a.actual + 5 < a.planned ? "behind" : undefined}>
              <td>
                <span className="mono small">{a.ref}</span> {a.name}
              </td>
              <td>{a.weight}%</td>
              <td className="small">
                {a.start} → {a.finish}
              </td>
              <td>{a.planned}%</td>
              <td>
                <b>{a.actual}%</b>
              </td>
              <td className="small">p. {a.page}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Packages({ packages }) {
  const [open, setOpen] = useState(null);
  return (
    <div className="tablewrap">
      <table className="pf-packages">
        <thead>
          <tr>
            <th>Scope element</th>
            <th>Budget (SAR m)</th>
            <th>Reported</th>
            <th>Planned by now</th>
            <th>Recalculated</th>
            <th>Status</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {packages.map((p) => [
            <tr key={p.element}>
              <td>
                {p.activities.length ? (
                  <button
                    type="button"
                    className="linkish"
                    aria-expanded={open === p.element}
                    onClick={() => setOpen(open === p.element ? null : p.element)}
                  >
                    {open === p.element ? "▾" : "▸"} {p.name}
                  </button>
                ) : (
                  p.name
                )}
              </td>
              <td>{p.budget ?? "–"}</td>
              <td>{pct(p.claimed)}</td>
              <td>{pct(p.planned)}</td>
              <td>
                <b>{pct(p.actual)}</b>
              </td>
              <td>
                <StatusPill tone={CHECK_STATUS[p.status].tone}>{CHECK_STATUS[p.status].label}</StatusPill>
              </td>
              <td className="small">{p.document ? p.document.name : "No plan on file"}</td>
            </tr>,
            open === p.element && (
              <tr key={`${p.element}-acts`} className="pf-open">
                <td colSpan={7}>
                  <Activities pkg={p} />
                  {p.problems.length > 0 && (
                    <p className="small">
                      <StatusPill tone="warn">Check</StatusPill> {p.problems.join(" ")}
                    </p>
                  )}
                </td>
              </tr>
            ),
          ])}
        </tbody>
      </table>
    </div>
  );
}

function DecisionBox({ check }) {
  const [note, setNote] = useState("");
  if (check.decision)
    return (
      <p className="small">
        <StatusPill tone={check.decision === "accepted" ? "good" : "mute"}>
          Finding {check.decision} by reviewer
        </StatusPill>
        {check.decision_note && <> · “{check.decision_note}”</>}
      </p>
    );
  if (!needsDecision(check)) return null;
  return (
    <div className="pf-decide">
      <p className="small m0">
        The agent proposes this finding; a reviewer decides whether it stands and goes back to the contractor.
      </p>
      <input
        placeholder="Note for the record (optional)"
        maxLength={1000}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        aria-label="Decision note"
      />
      <button type="button" className="primary" onClick={() => decideCheck(check.stadium_id, "accepted", note)}>
        Accept finding
      </button>
      <button type="button" className="ghost" onClick={() => decideCheck(check.stadium_id, "rejected", note)}>
        Reject finding
      </button>
    </div>
  );
}

/** One stadium's progress finding: claim, recalculation, sources and the agent's steps. */
export default function ProgressFinding({ check }) {
  const s = CHECK_STATUS[check.status];
  return (
    <section className="block pf" id="finding" aria-labelledby="pf-title">
      <div className="pf-head">
        <div>
          <span className="eyebrow">
            Finding · {check.city} · as at {check.as_of}
          </span>
          <h3 id="pf-title">{check.stadium_name}</h3>
        </div>
        <StatusPill tone={s.tone}>{s.label}</StatusPill>
      </div>
      <div className="mini-grid four">
        <div className="mini">
          <b>
            <CountUp value={check.claimed} suffix="%" />
          </b>
          <span>reported by the contractor</span>
        </div>
        <div className={`mini ${check.status === "overstated" ? "bad" : ""}`.trim()}>
          <b>
            <CountUp value={check.recalculated} suffix="%" />
          </b>
          <span>recalculated from the plans</span>
        </div>
        <div className="mini">
          <b>
            <CountUp value={check.planned} suffix="%" />
          </b>
          <span>planned by this date</span>
        </div>
        <div className="mini">
          <b>
            {check.gap < 0 ? check.gap : <CountUp value={check.gap} prefix={check.gap > 0 ? "+" : ""} />}
          </b>
          <span>points claimed above evidence (tolerance {check.tolerance})</span>
        </div>
      </div>
      <p className="pf-summary">{check.summary}</p>
      {check.offline && (
        <p className="muted small">
          Offline demo: figures come from bundled readings of the sample documents; the summary is a plain template.
        </p>
      )}
      <p className="muted small">
        Claim source: {check.report.name}, p. {check.report.page} · “{check.report.quote}”
        {check.stale && (
          <>
            {" "}
            · <StatusPill tone="warn">New evidence since this check</StatusPill>
          </>
        )}
      </p>
      <DecisionBox check={check} />
      <h4>By scope element</h4>
      <Packages packages={check.packages} />
      <h4>What the agent did</h4>
      <Steps steps={check.steps} />
    </section>
  );
}
