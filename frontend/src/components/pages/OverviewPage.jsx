"use client";

import { useState } from "react";
import OverviewBrief from "@/components/organisms/OverviewBrief";
import OverviewMap, { MARK } from "@/components/organisms/OverviewMap";
import PageTemplate from "@/components/templates/PageTemplate";
import { VENUES, pct, decMeta } from "@/lib/domain/data";
import { GEO, pinLabel } from "@/lib/domain/geo";
import { scores } from "@/lib/domain/scoring";
import { forecasts } from "@/lib/domain/forecast";
import { venueStats } from "@/lib/domain/venueStats";
import { goView } from "@/lib/store/state";
import { openRegister } from "@/lib/navigation";

const MAPPED = VENUES.filter((v) => GEO[v.id]);

function Kpi({ value, label, note, onClick }) {
  return (
    <button className="ov-kpi" type="button" onClick={onClick}>
      <b>{value}</b>
      <span>{label}</span>
      <small>{note}</small>
    </button>
  );
}

function Overview({ S }) {
  const [selected, setSelected] = useState(null);
  const select = (id) => setSelected(id && GEO[id] ? id : null);
  const f = forecasts();
  const sc = scores(S.obligations);
  const stats = Object.fromEntries(MAPPED.map((v) => [v.id, venueStats(v.id)]));
  const openDecisions = S.decisions.filter((d) => d.status === "Open" && decMeta(d.id)).length;
  const openIssues = S.issues.filter((i) => i.status === "Open");
  const summary = {
    onTrack: f.filter((x) => x.late80 <= 0).length,
    total: f.length,
    criticalUnverified: S.obligations.filter((o) => o.crit === "Critical" && o.state !== "Verified").length,
    openDecisions,
    openIssues: openIssues.length,
    overdue: openIssues.filter((i) => S.today > i.due).length,
  };
  const worst = MAPPED.map((v) => ({ venue: v, forecast: stats[v.id].f }))
    .filter((x) => x.forecast)
    .sort((a, b) => a.forecast.prob - b.forecast.prob)[0];
  const current = MAPPED.find((v) => v.id === selected);
  return (
    <section className="ov">
      <div className="ov-hero">
        <div>
          <span className="ov-tag">Saudi Arabia 2034 · Programme overview</span>
          <h2>A ready Saudi Arabia</h2>
          <p>
            Start with the whole programme, select a stadium on the map, then open its full readiness record in the
            Control Tower.
          </p>
        </div>
      </div>
      <div className="ov-grid">
        <OverviewMap venues={MAPPED} stats={stats} selected={selected} onSelect={select} />
        <OverviewBrief
          venue={current}
          stats={current && stats[current.id]}
          summary={summary}
          worst={worst}
          onSelect={select}
        />
      </div>
      <div className="ov-kpis">
        <Kpi
          value={`${summary.onTrack}/${summary.total}`}
          label="Gates on track"
          note="at 80% confidence"
          onClick={() => goView("readiness")}
        />
        <Kpi
          value={`${pct(sc.assured)}%`}
          label="Assured readiness"
          note={`vs ${pct(sc.declared)}% owner-declared`}
          onClick={() => goView("readiness")}
        />
        <Kpi
          value={summary.criticalUnverified}
          label="Critical unverified"
          note="awaiting second-line review"
          onClick={() => openRegister()}
        />
        <Kpi
          value={openDecisions}
          label="Decisions open"
          note={openDecisions ? "awaiting leadership" : "none outstanding"}
          onClick={() => goView("actions")}
        />
      </div>
      <section className="ov-strip">
        <div className="ov-strip-h">
          <div>
            <h3>Venue status</h3>
            <span>Select a venue to see its readiness and Nabd brief</span>
          </div>
          <button className="linkish" type="button" onClick={() => goView("tower")}>
            View all venues →
          </button>
        </div>
        <div className="ov-chips">
          {MAPPED.map((v) => {
            const s = stats[v.id];
            return (
              <button
                key={v.id}
                className={`ov-chip ${selected === v.id ? "sel" : ""}`.trim()}
                type="button"
                aria-pressed={selected === v.id}
                onClick={() => select(v.id)}
              >
                <img src={MARK} alt="" />
                <span>
                  <b>{pinLabel(v)}</b>
                  <small>{v.name}</small>
                </span>
                <i className={s.tone} />
                <em>{pct(s.sc.assured)}%</em>
              </button>
            );
          })}
        </div>
      </section>
    </section>
  );
}

export default function OverviewPage() {
  return <PageTemplate label="Programme overview">{(p) => <Overview S={p.S} />}</PageTemplate>;
}
