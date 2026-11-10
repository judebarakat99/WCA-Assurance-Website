"use client";

import { pct } from "@/lib/domain/data";
import { pinLabel } from "@/lib/domain/geo";
import { aiAsk } from "@/legacy/views/ai";

const plural = (n, word) => `${word}${n === 1 ? "" : "s"}`;

function VenueBrief({ venue: v, stats: s, onClear }) {
  const failing = s.gate ? s.gate.rules.filter((r) => !r.ok) : [];
  const focus = failing.length
    ? failing[0].text +
      (failing[0].blockers.length
        ? ` (${failing[0].blockers
            .slice(0, 3)
            .map((o) => o.code)
            .join(", ")})`
        : "")
    : "Gate rules are met. The venue can request the gate pass.";
  return (
    <>
      <div className="ov-nabd-k">✦ Nabd · {pinLabel(v)} brief</div>
      <h3>{v.name}</h3>
      <p className="ov-sub">{v.role || v.type} · simulated insight from live demo data</p>
      <ul className="ov-points">
        <li>
          <b>{pct(s.sc.assured)}%</b> of readiness is backed by validated evidence, against {pct(s.sc.declared)}%
          declared by owners.
        </li>
        <li>
          {s.f ? (
            <>
              <b>{pct(s.f.prob)}%</b> chance of meeting {s.f.gate.id} {s.f.gate.name} on time.
            </>
          ) : (
            "All FIFA gates are passed."
          )}
        </li>
        <li>
          <b>{s.criticalUnverified}</b> Critical {plural(s.criticalUnverified, "obligation")} not yet verified and{" "}
          <b>{s.open.length}</b> open corrective {plural(s.open.length, "action")}.
        </li>
      </ul>
      <div className="ov-focus">
        <span>Recommended focus</span>
        <p>{focus}</p>
      </div>
      <button className="ov-ask" type="button" onClick={() => aiAsk(`Why is ${v.name} at risk?`)}>
        ✦ Ask Nabd about {pinLabel(v)}
      </button>
      <button className="ov-link" type="button" onClick={onClear}>
        ← Back to programme view
      </button>
    </>
  );
}

function ProgrammeBrief({ summary: x, worst, onSelect }) {
  return (
    <>
      <div className="ov-nabd-k">✦ Nabd readiness brief</div>
      <h3>What leadership needs to know</h3>
      <p className="ov-sub">Simulated insight from live demo data</p>
      <ul className="ov-points">
        <li>
          <b>
            {x.onTrack} of {x.total}
          </b>{" "}
          venues and base camps make their next FIFA gate at P80.
        </li>
        <li>
          <b>{x.criticalUnverified}</b> Critical obligations remain unverified by the second line.
        </li>
        <li>
          <b>{x.openDecisions}</b> executive {x.openDecisions === 1 ? "decision is" : "decisions are"} open.
        </li>
        <li>
          <b>{x.openIssues}</b> corrective actions are open{x.overdue ? `, ${x.overdue} past SLA` : ""}.
        </li>
      </ul>
      {worst && (
        <button className="ov-priority" type="button" onClick={() => onSelect(worst.venue.id)}>
          <span>Priority</span>
          <b>{worst.venue.name}</b>
          <small>
            {pct(worst.forecast.prob)}% on-time probability · {worst.forecast.status}
          </small>
        </button>
      )}
      <button className="ov-ask" type="button" onClick={() => aiAsk("Which venue is highest risk?")}>
        ✦ Ask Nabd a question
      </button>
    </>
  );
}

/** Nabd side panel: the programme brief, or a brief for the selected venue. */
export default function OverviewBrief({ venue, stats, summary, worst, onSelect }) {
  return (
    <aside className="ov-card ov-nabd">
      {venue ? (
        <VenueBrief venue={venue} stats={stats} onClear={() => onSelect(null)} />
      ) : (
        <ProgrammeBrief summary={summary} worst={worst} onSelect={onSelect} />
      )}
    </aside>
  );
}
