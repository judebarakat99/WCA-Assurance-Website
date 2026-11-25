"use client";

const pct = (v) => (v == null ? "–" : `${Math.round(v * 100)}%`);

function Card({ label, sub, value, note, tone, title }) {
  return (
    <div className="ov-kpi" title={title}>
      <div className="ov-kpi-l">
        {label}
        {sub && <small>{sub}</small>}
      </div>
      <div className="ov-kpi-row">
        <b>{value}</b>
        {note && <span className={`ov-kpi-n ${tone || ""}`.trim()}>{note}</span>}
      </div>
    </div>
  );
}

/** The four headline figures across the top of the Overview. */
export default function OverviewKpis({ kpis, chapter }) {
  const { compliance: c, atRisk, critical, milestones } = kpis;
  const delta = c.delta;
  const deltaNote = delta == null ? "" : delta === 0 ? "no change" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)} pp`;
  return (
    <div className="ov-kpis" role="group" aria-label="Programme headline figures">
      <Card
        label="National compliance"
        sub={chapter}
        value={pct(c.share)}
        note={deltaNote}
        tone={delta > 0 ? "good" : delta < 0 ? "bad" : "mute"}
        title={`${c.fulfilled.toLocaleString("en-US")} of ${c.total.toLocaleString("en-US")} requirements accepted by a reviewer. The change is against 30 days ago, from the dates each requirement was accepted.`}
      />
      <Card
        label="Stadiums at risk"
        value={`${atRisk.n} of ${atRisk.of}`}
        note={atRisk.offTrack ? `${atRisk.offTrack} off track` : "none off track"}
        tone={atRisk.offTrack ? "bad" : "mute"}
        title="Stadiums whose schedule position is at risk or off track, or whose next gate is forecast to slip."
      />
      <Card
        label="Critical issues"
        sub={chapter}
        value={critical.n.toLocaleString("en-US")}
        note={critical.overdue == null ? "" : critical.overdue ? `${critical.overdue} overdue` : "none overdue"}
        tone={critical.overdue ? "bad" : "mute"}
        title="Critical findings across the programme. Overdue counts high-severity alerts whose due date has passed."
      />
      <Card
        label="Milestones at risk"
        value={milestones.n.toLocaleString("en-US")}
        note={`of ${milestones.of} next gates`}
        tone="mute"
        title="Next gates forecast to slip against their planned date."
      />
    </div>
  );
}
