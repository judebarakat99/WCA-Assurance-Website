"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import StatusPill from "@/components/atoms/StatusPill";
import PageHead from "@/components/molecules/PageHead";
import CostPerformance from "@/components/organisms/CostPerformance";
import ProgressGantt, { GanttTable, Legend, fmtD, slipLabel } from "@/components/organisms/ProgressGantt";
import PageTemplate from "@/components/templates/PageTemplate";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";
import { LATE_DAYS, ON_TRACK_DAYS, STATUS, delivery } from "@/lib/domain/delivery.mjs";
import { ensureIntake, intake } from "@/lib/store/intake";

const bn = (v) => `SAR ${(v / 1000).toFixed(1)}bn`;
const ATTENTION = ["at-risk", "late", "misses-deadline"];

function Kpi({ label, value, note, tone }) {
  return (
    <div className="pv-kpi">
      <span className="pv-kpi-label">{label}</span>
      <b>{value}</b>
      {note && <span className={`pv-kpi-note ${tone || ""}`.trim()}>{note}</span>}
    </div>
  );
}

function Kpis({ d }) {
  const t = d.totals;
  const behind = Math.round((t.planned - t.actual) * 10) / 10;
  return (
    <div className="pv-kpis pp-kpis">
      <Kpi
        label="Programme progress"
        value={`${t.actual}%`}
        note={behind > 0 ? `${behind} pts behind the ${t.planned}% planned` : `on the ${t.planned}% planned`}
        tone={behind > 5 ? "bad" : behind > 0 ? "warn" : "good"}
      />
      <Kpi
        label="Schedule"
        value={t.late + t.atRisk}
        note={`${t.late} late · ${t.atRisk} at risk · SPI ${t.spi?.toFixed(2) ?? "–"}`}
        tone={t.late ? "bad" : t.atRisk ? "warn" : "good"}
      />
      <Kpi
        label="Cost performance"
        value={t.cpi?.toFixed(2) ?? "–"}
        note={
          t.overBudget
            ? `${t.overBudget} stadium${t.overBudget === 1 ? "" : "s"} forecast ${bn(t.overrun)} over budget`
            : "all within budget at completion"
        }
        tone={t.overBudget ? (t.cpi < 0.9 ? "bad" : "warn") : "good"}
      />
      <Kpi
        label="Spent to date (SAR bn)"
        value={(t.spent / 1000).toFixed(1)}
        note={`of ${(t.budget / 1000).toFixed(1)} · ${Math.round((100 * t.spent) / t.budget)}%`}
        tone="muted"
      />
    </div>
  );
}

function Handovers({ d }) {
  const list = d.totals.handovers;
  return (
    <section className="pv-card pp-side" aria-labelledby="pp-handovers">
      <h3 id="pp-handovers">Handovers in the next 12 months</h3>
      {!list.length && <p className="muted small m0">None before {fmtD(d.totals.next)}.</p>}
      <ul className="pp-list">
        {list.map((r) => (
          <li key={r.id}>
            <span>
              <b>{r.name}</b>
              <small>
                Planned {fmtD(r.finish)}
                {r.forecast !== r.finish ? ` · forecast ${fmtD(r.forecast)}` : ""}
              </small>
            </span>
            <StatusPill tone={STATUS[r.status].tone}>{slipLabel(r)}</StatusPill>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Evidence({ d }) {
  const gaps = d.rows.filter((r) => r.verified && r.reported !== r.actual);
  return (
    <section className="pv-card pp-side" aria-labelledby="pp-evidence">
      <h3 id="pp-evidence">Reported against evidence</h3>
      {!d.totals.verified ? (
        <p className="muted small m0">
          No progress report has been checked yet, so every bar shows the contractor&apos;s reported figure. Add a
          progress report and its plans on the <Link href="/evidence">Evidence page</Link>, or use Load sample data on
          the map.
        </p>
      ) : (
        <ul className="pp-list">
          {gaps.map((r) => (
            <li key={r.id}>
              <span>
                <b>{r.name}</b>
                <small>
                  Reported {r.reported}% · recalculated {r.actual}%
                </small>
              </span>
              <Link className="small" href={`/evidence?tab=onfile&stadium=${encodeURIComponent(r.id)}`}>
                Finding
              </Link>
            </li>
          ))}
          {!gaps.length && <li className="muted small">Every checked report matches its plans.</li>}
        </ul>
      )}
    </section>
  );
}

function ProjectProgress() {
  useEffect(ensureIntake, []);
  const [show, setShow] = useState("all");
  const [city, setCity] = useState("");
  const d = delivery(intake.checks);
  const rows = d.rows
    .filter((r) => (show === "attention" ? ATTENTION.includes(r.status) : true))
    .filter((r) => !city || r.cityId === city)
    .sort((a, b) => a.finish.localeCompare(b.finish) || a.name.localeCompare(b.name));
  const cities = FACILITY_REGISTER.hostCities.filter((c) => d.rows.some((r) => r.cityId === c.id));
  return (
    <>
      <PageHead
        chip={`Project progress · ${d.rows.length} stadiums · data date ${fmtD(d.asOf)}`}
        title="Project progress"
        wideLead
        lead="Delivery schedule, progress and cost for every stadium. Where a contractor's progress report has been checked on the Evidence page, its bar uses the figure recalculated from the detailed plans instead of the reported one."
      />
      <Kpis d={d} />
      <section className="pv-card pp-gantt" aria-labelledby="pp-schedule">
        <div className="pv-card-head">
          <h3 id="pp-schedule">Delivery schedule</h3>
          <div className="pp-filters">
            <label className="f">
              Show
              <select value={show} onChange={(e) => setShow(e.target.value)}>
                <option value="all">All stadiums</option>
                <option value="attention">At risk or late</option>
              </select>
            </label>
            <label className="f">
              Host city
              <select value={city} onChange={(e) => setCity(e.target.value)}>
                <option value="">All host cities</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {rows.length ? (
          <ProgressGantt rows={rows} asOf={d.asOf} milestones={d.milestones} />
        ) : (
          <p className="muted small">No stadiums match these filters.</p>
        )}
        <Legend />
        <p className="muted small pp-note">
          Each bar runs from the start of works to the planned handover and is filled to the stadium&apos;s progress;
          the tick shows where progress should be by the data date on the planned S-curve (or, for checked stadiums, on
          the contractor&apos;s detailed plans). Days behind plan are the gap between today and the date the plan called
          for today&apos;s progress; the forecast finish moves the handover by that gap. Within {ON_TRACK_DAYS} days is
          on track, up to {LATE_DAYS} days at risk, beyond that late. Stadiums marked ✓ expand into their scope
          elements. Below 10% planned and achieved progress, it is too early to forecast.
        </p>
        <GanttTable rows={rows} />
      </section>
      <div className="pp-grid">
        <section className="pv-card pp-cost" aria-labelledby="pp-cost">
          <div className="pv-card-head">
            <h3 id="pp-cost">Cost performance</h3>
          </div>
          <p className="muted small">
            Value of work done is the budget times progress. The cost performance index (CPI) is that value divided by
            the spend; the forecast cost at completion is the budget divided by the CPI. Figures are sample data in SAR
            millions.
          </p>
          <CostPerformance rows={d.rows} />
        </section>
        <div className="pp-sidecol">
          <Handovers d={d} />
          <Evidence d={d} />
        </div>
      </div>
    </>
  );
}

export default function ProjectProgressPage() {
  return <PageTemplate label="Project progress">{() => <ProjectProgress />}</PageTemplate>;
}
