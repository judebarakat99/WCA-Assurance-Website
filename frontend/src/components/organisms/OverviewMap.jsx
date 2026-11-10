"use client";

import StatusPill from "@/components/atoms/StatusPill";
import { pct } from "@/lib/domain/data";
import { BORDER_PATH, GEO, MAP_H, MAP_W, mapPosition, pinLabel, px } from "@/lib/domain/geo";
import { publicAssetUrl } from "@/lib/assets.mjs";
import { openVenue } from "@/lib/navigation";
import { toneOf } from "@/lib/ui/tones";

export const MARK = publicAssetUrl("/Assets/saudi-2034-logo.svg", process.env.NEXT_PUBLIC_BASE_PATH || "");

function SeaLabel({ at, children }) {
  const [x, y] = px(at);
  return (
    <text className="ov-sea" x={x.toFixed(0)} y={y.toFixed(0)} textAnchor="middle">
      {children}
    </text>
  );
}

function Popup({ venue, stats: s, onClose }) {
  const pos = mapPosition(GEO[venue.id]);
  return (
    <div
      className={`ov-pop ${pos.x / MAP_W > 0.55 ? "l" : "r"}`}
      style={{ left: pos.left, top: pos.top }}
      role="dialog"
      aria-label={`${venue.name} readiness`}
    >
      <div className="ov-pop-h">
        <div>
          <b>{pinLabel(venue)}</b>
          <span>{venue.name}</span>
        </div>
        <button className="ov-x" type="button" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="ov-pop-m">
        <div>
          <b>{pct(s.sc.assured)}%</b>
          <span>assured readiness</span>
        </div>
        <div>
          <b>{s.f ? `${pct(s.f.prob)}%` : "n/a"}</b>
          <span>on-time probability</span>
        </div>
      </div>
      <dl className="ov-pop-d">
        <div>
          <dt>Next gate</dt>
          <dd>{s.f ? `${s.f.gate.id} ${s.f.gate.name}` : "All gates passed"}</dd>
        </div>
        <div>
          <dt>Open issues</dt>
          <dd>
            {s.open.length}
            {s.crit ? ` · ${s.crit} Critical` : ""}
          </dd>
        </div>
        <div>
          <dt>Forecast</dt>
          <dd>
            <StatusPill tone={s.f ? toneOf(s.f.cls) : "good"}>{s.f ? s.f.status : "Complete"}</StatusPill>
          </dd>
        </div>
      </dl>
      <button className="ov-go" type="button" onClick={() => openVenue(venue.id)}>
        View stadium →
      </button>
    </div>
  );
}

/** Illustrative map of Saudi Arabia with a pin per venue and a popup for the selection. */
export default function OverviewMap({ venues, stats, selected, onSelect }) {
  const current = venues.find((v) => v.id === selected);
  const country = px([45, 23]);
  return (
    <div className="ov-map">
      <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} aria-hidden="true">
        <path className="ov-land" d={BORDER_PATH} />
        <SeaLabel at={[37.2, 21.6]}>RED SEA</SeaLabel>
        <SeaLabel at={[52.6, 27.6]}>ARABIAN GULF</SeaLabel>
        <SeaLabel at={[36.6, 31.9]}>JORDAN</SeaLabel>
        <SeaLabel at={[43.8, 31.7]}>IRAQ</SeaLabel>
        <SeaLabel at={[46.5, 16.3]}>YEMEN</SeaLabel>
        <text className="ov-country" x={country[0].toFixed(0)} y={country[1].toFixed(0)} textAnchor="middle">
          SAUDI ARABIA
        </text>
      </svg>
      {venues.map((v) => {
        const pos = mapPosition(GEO[v.id]);
        const s = stats[v.id];
        return (
          <button
            key={v.id}
            type="button"
            className={`ov-pin ${selected === v.id ? "sel" : ""}`.trim()}
            style={{ left: pos.left, top: pos.top }}
            aria-label={`${v.name}, ${pct(s.sc.assured)}% assured readiness`}
            aria-pressed={selected === v.id}
            onClick={() => onSelect(v.id)}
          >
            <img src={MARK} alt="" />
            <small>{pinLabel(v)}</small>
            <i className={s.tone} />
          </button>
        );
      })}
      {current && <Popup venue={current} stats={stats[current.id]} onClose={() => onSelect(null)} />}
      <div className="ov-legend">
        <span>
          <i className="good" />
          On track
        </span>
        <span>
          <i className="warn" />
          At risk at P80
        </span>
        <span>
          <i className="bad" />
          Late at P50
        </span>
      </div>
    </div>
  );
}
