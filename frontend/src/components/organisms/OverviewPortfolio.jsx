"use client";

import { LEVELS } from "@/lib/overview/model.mjs";

const pct = (v) => (v == null ? "–" : `${Math.round(v * 100)}%`);

/** The stadium portfolio: one row per stadium, worst first. Click a row to open that stadium in the column on the right. */
export default function OverviewPortfolio({ rows, selectedId, hoverId, onSelect, onHover, chapter }) {
  return (
    <section className="ov-card ov-port" aria-labelledby="ov-port-title">
      <h2 id="ov-port-title" className="ov-h">
        {rows.length}-stadium portfolio{chapter ? <small>{chapter}</small> : null}
      </h2>
      <div className="ov-table" role="table" aria-label="Stadium portfolio">
        <div className="ov-tr ov-th" role="row">
          <span role="columnheader">Stadium</span>
          <span role="columnheader">Readiness</span>
          <span role="columnheader">Schedule</span>
          <span role="columnheader" title="Critical findings">Issues</span>
          <span role="columnheader">Next gate</span>
        </div>
        <div className="ov-tbody">
          {rows.map((r) => (
            <div
              key={r.id}
              role="row"
              className={`ov-tr${r.id === selectedId ? " sel" : ""}${r.id === hoverId ? " hov" : ""}`}
              data-level={r.level}
              onMouseEnter={() => onHover(r.id)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onSelect(r.id)}
            >
              <span role="cell" className="ov-name">
                <i className="ov-dot" aria-hidden="true" />
                <button type="button" aria-pressed={r.id === selectedId} onClick={(e) => { e.stopPropagation(); onSelect(r.id); }}>
                  {r.name}
                  <small>
                    {r.city} · due {r.year}
                  </small>
                </button>
              </span>
              <span role="cell" className="ov-num">{pct(r.readiness)}</span>
              <span role="cell" className={`ov-sch ${r.schedule.tone}`}>{r.schedule.label}</span>
              <span role="cell" className="ov-iss" data-has={r.counts.critical ? "1" : "0"}>
                <b>{r.counts.critical}</b>
                {r.counts.material > 0 && <small>{r.counts.material} material</small>}
              </span>
              <span role="cell" className="ov-gate">{r.gate}</span>
            </div>
          ))}
          {!rows.length && <p className="muted">No stadiums.</p>}
        </div>
      </div>
      <p className="ov-foot">
        Readiness is the share of requirements a reviewer has accepted{chapter ? " in this chapter" : ""}. Schedule shows the forecast slip of the next gate; a
        stadium with no forecast shows its risk position. Issues are critical findings.
        <span className="ov-key" aria-hidden="true">
          {LEVELS.map((k) => (
            <i key={k} data-level={k} className="ov-dot" />
          ))}
        </span>
      </p>
    </section>
  );
}
