"use client";

import Link from "next/link";
import { useState } from "react";
import MiniMap from "@/components/molecules/MiniMap";
import ViewToggle from "@/components/molecules/ViewToggle";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";
import { pct } from "@/lib/format";

const SHOWN = 6; // exceptions shown before the rest collapse into a summary row
const RISK_LABEL = {
  bad: "Critical",
  warn: "At risk",
  good: "On track",
  mute: "Not started",
};
const REGION = Object.fromEntries(
  FACILITY_REGISTER.hostCities.map((c) => [c.id, c.region]),
);

function Kpi({ label, value, note, tone, href }) {
  const body = (
    <>
      <span className="pv-kpi-label">{label}</span>
      <b>{value}</b>
      {note && (
        <span className={`pv-kpi-note ${tone || ""}`.trim()}>{note}</span>
      )}
    </>
  );
  return href ? (
    <Link className="pv-kpi" href={href}>
      {body}
    </Link>
  ) : (
    <div className="pv-kpi">{body}</div>
  );
}

function Kpis({ kpis }) {
  const { compliance, atRisk, issues, milestones } = kpis;
  return (
    <div className="pv-kpis">
      <Kpi
        label="National compliance"
        value={compliance.reviewed ? `${pct(compliance.assured)}%` : "–"}
        note={`${pct(compliance.coverage)}% assessed`}
        tone="muted"
      />
      <Kpi
        label="Stadiums at risk"
        value={`${atRisk.count} of ${atRisk.total}`}
        note={`${atRisk.critical} critical`}
        tone={atRisk.critical ? "bad" : "good"}
      />
      <Kpi
        label="Critical issues"
        value={issues.total}
        note={
          issues.awaiting
            ? `${issues.awaiting} awaiting review`
            : `${issues.nonCompliant} non-compliant`
        }
        tone={issues.total ? "bad" : "good"}
        href="/review"
      />
      <Kpi
        label="Milestones at risk"
        value={milestones.count}
        note={`of ${milestones.due} handovers by ${milestones.horizon}`}
        tone={milestones.count ? "bad" : "good"}
      />
    </div>
  );
}

function Row({ r, selected, onSelect }) {
  const issueNote = [
    r.issues.nonCompliant && `${r.issues.nonCompliant} non-compliant`,
    r.issues.failing && `${r.issues.failing} failing check`,
    r.issues.claims && "claim not supported",
  ].filter(Boolean);
  return (
    <tr
      className={selected ? "sel" : undefined}
      tabIndex={0}
      aria-selected={selected}
      onClick={() => onSelect(r.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(r.id);
        }
      }}
    >
      <td>
        <span className="pv-stadium">
          <i className={`pv-dot ${r.risk}`} title={RISK_LABEL[r.risk]} />
          <span>
            <b>{r.name}</b>
            <small>
              {r.city} · due {r.due}
            </small>
          </span>
        </span>
      </td>
      <td className={`num ${r.readiness == null ? "muted" : r.assuranceTone}`}>
        {r.readiness == null ? "–" : `${pct(r.readiness)}%`}
      </td>
      <td className={r.schedule.tone || "muted"}>
        {r.schedule.label}
        {r.overstated && <small className="bad">claim overstated</small>}
      </td>
      <td
        className={`num ${r.issues.total ? (r.risk === "bad" ? "bad" : "warn") : "good"}`}
      >
        {r.issues.total}
        {issueNote.length > 0 && <small>{issueNote.join(" · ")}</small>}
      </td>
      <td>
        {r.stage}
        <small>due {r.due}</small>
      </td>
    </tr>
  );
}

function Selected({ r, onShowOnMap }) {
  if (!r) return null;
  return (
    <div className={`pv-card pv-selected ${r.risk}`}>
      <span className="pv-eyebrow">Selected stadium</span>
      <h3>{r.name}</h3>
      <p className="pv-sel-figs">
        <b>
          {r.readiness == null
            ? "Not reviewed"
            : `${pct(r.readiness)}% readiness`}
        </b>
        <span aria-hidden="true"> · </span>
        <b>{r.schedule.label}</b>
      </p>
      <p className="small muted m0">
        {RISK_LABEL[r.risk]} · {r.stage} · due {r.due}
      </p>
      <div className="pv-sel-actions">
        <Link href={`/facilities/${r.id}`}>
          {r.issues.total
            ? `${r.issues.total} issue${r.issues.total === 1 ? "" : "s"} → `
            : ""}
          Open detail
        </Link>
        {r.check && (
          <Link
            href={`/evidence?tab=onfile&stadium=${encodeURIComponent(r.id)}`}
          >
            Progress finding
          </Link>
        )}
        <button type="button" className="linkish" onClick={onShowOnMap}>
          Show on map
        </button>
      </div>
    </div>
  );
}

/**
 * National programme status: headline figures, the stadium portfolio with
 * exceptions first, and map navigation. A row or a city pin selects; the
 * selected stadium links to its detail, its progress finding and the map.
 */
export default function PortfolioView({
  data,
  view,
  onView,
  city,
  onCity,
  stadium,
  onStadium,
  onShowOnMap,
}) {
  const [all, setAll] = useState(false);
  const rows = city ? data.rows.filter((r) => r.cityId === city) : data.rows;
  const selected = rows.find((r) => r.id === stadium) || rows[0] || null;
  const shown = all ? rows : rows.slice(0, SHOWN);
  const rest = rows.slice(SHOWN);
  const cityName = data.cities.find((c) => c.id === city)?.name;
  return (
    <div className="pview">
      <div className="pv-head">
        <div>
          <span className="pv-eyebrow">FIFA assurance · Saudi Arabia 2034</span>
          <h2>National programme status</h2>
          <p className="muted m0">
            Portfolio health and exceptions at a glance, without opening each
            stadium. Select a stadium for its detail.
          </p>
        </div>
        <ViewToggle view={view} onChange={onView} />
      </div>
      <Kpis kpis={data.kpis} />
      <div className="pv-grid">
        <section className="pv-card pv-table" aria-labelledby="pv-portfolio">
          <div className="pv-card-head">
            <h3 id="pv-portfolio">
              {cityName
                ? `${cityName} · ${rows.length}-stadium portfolio`
                : `${data.rows.length}-stadium portfolio`}
            </h3>
            {city && (
              <button
                type="button"
                className="linkish small"
                onClick={() => onCity(null)}
              >
                All host cities
              </button>
            )}
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Stadium</th>
                  <th className="num">Readiness</th>
                  <th>Schedule</th>
                  <th className="num">Issues</th>
                  <th>Stage</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <Row
                    key={r.id}
                    r={r}
                    selected={r.id === selected?.id}
                    onSelect={onStadium}
                  />
                ))}
                {!all && rest.length > 0 && (
                  <tr className="pv-summary" onClick={() => setAll(true)}>
                    <td>
                      <span className="pv-stadium">
                        <i className="pv-dot mute" />
                        <span>
                          <b>
                            Stadiums {SHOWN + 1}–{rows.length}
                          </b>
                          <small>
                            <button type="button" className="linkish">
                              Show all
                            </button>
                          </small>
                        </span>
                      </span>
                    </td>
                    <td className="num muted">Portfolio summary</td>
                    <td>
                      {
                        rest.filter(
                          (r) => r.risk === "bad" || r.risk === "warn",
                        ).length
                      }{" "}
                      at risk
                    </td>
                    <td className="num">
                      {rest.reduce((t, r) => t + r.issues.total, 0)}
                    </td>
                    <td>Multiple stages</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="pv-foot muted">
            Readiness is the share of in-scope FIFA requirements a reviewer has
            accepted. Schedule is days behind the contractor&apos;s detailed
            plans on Evidence, at the report date. Issues are non-compliant
            requirements, evidence failing its check and progress claims not
            supported.
          </p>
        </section>
        <div className="pv-side">
          <section className="pv-card" aria-labelledby="pv-mapnav">
            <h3 id="pv-mapnav">Map navigation</h3>
            <MiniMap
              cities={data.cities}
              regionsByCity={REGION}
              selectedCity={city}
              highlightCity={selected?.cityId}
              onSelectCity={onCity}
            />
            <p className="small muted m0">
              Click a city to filter the portfolio, or a row to select its
              stadium.
            </p>
          </section>
          <Selected
            r={selected}
            onShowOnMap={() => selected && onShowOnMap(selected)}
          />
        </div>
      </div>
    </div>
  );
}
