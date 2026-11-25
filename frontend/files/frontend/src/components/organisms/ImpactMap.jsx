"use client";

import { useMemo, useState } from "react";
import regions from "../../../../data/geo/sa-regions.geo.json" with { type: "json" };
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";
import { OUTCOME } from "@/lib/watch/impact.mjs";

// The impact heat map: the same regions, host-city shading, city pins with a count badge and stadium pins as the
// Overview map, drawn as SVG so it fits inside a card. Click a city to zoom to its stadiums; Recenter goes back.
// Positions use a plain projection (longitude scaled by cos of the latitude), the same extent as the Overview map.
const COUNTRY = { west: 34.49, south: 16.38, east: 55.67, north: 32.15 };
const K = Math.cos((24 * Math.PI) / 180);
const ASPECT = 1.4;

const TONE_ORDER = ["bad", "warn", "good", "mute"];
const worse = (a, b) => (TONE_ORDER.indexOf(a) <= TONE_ORDER.indexOf(b) ? a : b);

/** A rectangle of the projected plane that holds a geographic box, widened to the map's shape. */
function viewOf(west, south, east, north) {
  const x0 = west * K;
  const x1 = east * K;
  const y0 = -north;
  const y1 = -south;
  let w = x1 - x0;
  let h = y1 - y0;
  if (w / h < ASPECT) w = h * ASPECT;
  else h = w / ASPECT;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}
const COUNTRY_VIEW = viewOf(COUNTRY.west - 0.4, COUNTRY.south - 0.4, COUNTRY.east + 0.4, COUNTRY.north + 0.4);

const ringPath = (ring) => ring.map((p, i) => `${i ? "L" : "M"}${(p[0] * K).toFixed(3)},${(-p[1]).toFixed(3)}`).join("") + "Z";
function featurePath(geometry) {
  if (!geometry) return "";
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
  return polygons.map((rings) => rings.map(ringPath).join("")).join("");
}
const LAND = (regions.features || []).map((f) => ({ name: f.properties?.name || "", d: featurePath(f.geometry) }));

const pct = (v, total) => `${(v / total) * 100}%`;
const at = (view, lon, lat) => ({ left: pct(lon * K - view.x, view.w), top: pct(-lat - view.y, view.h) });

/** The colour a row is drawn in: the outcome's tone, with "info" (still passes, could now pass) read as good. */
export function rowTone(row, kind) {
  if (kind === "new") return row.actionable ? "warn" : "mute";
  const t = OUTCOME[row.outcome]?.tone || "mute";
  return t === "info" ? "good" : t;
}

function coordsOf(stadium, city) {
  const c = stadium.location?.coordinates;
  if (Array.isArray(c) && c.length === 2) return c;
  return city?.coordinates || null;
}

/** Group the rows by host city, with the city's tone, its pin position and its stadiums' positions. */
function groupCities(rows, kind) {
  const by = new Map();
  for (const r of rows) {
    const id = r.stadium.cityId;
    if (!by.has(id)) by.set(id, []);
    by.get(id).push(r);
  }
  return [...by].map(([id, list]) => {
    const city = FACILITY_REGISTER.hostCities.find((c) => c.id === id);
    const tones = list.map((r) => rowTone(r, kind));
    const tone = tones.reduce(worse, "mute");
    const acting = list.filter((r) => r.actionable).length;
    const reopened = list.filter((r) => r.outcome === "reopened").length;
    return {
      id,
      name: city?.name || list[0].city,
      region: city?.region || "",
      coordinates: city?.coordinates || null,
      tone,
      acting,
      reopened,
      rows: list.map((r) => ({ ...r, tone: rowTone(r, kind), coordinates: coordsOf(r.stadium, city) })),
    };
  });
}

function smallText(city, kind) {
  if (kind === "new") return city.acting ? `${city.acting} to start soon` : "Later";
  if (city.reopened) return `${city.reopened} would reopen`;
  if (city.acting) return `${city.acting} would fail in review`;
  return city.tone === "mute" ? "No evidence yet" : "Not affected";
}

function Card({ title, lines, style }) {
  return (
    <div className="im-card" style={style} role="status">
      <b>{title}</b>
      {lines.filter(Boolean).map(([text, tone], i) => (
        <span key={i} className={tone || undefined}>
          {text}
        </span>
      ))}
    </div>
  );
}

/**
 * Heat map of a proposed requirement change. rows: the assessment's rows. kind: "amendment" or "new".
 * selected: the open city id, or null for the whole country; onSelect(cityId | null).
 */
export default function ImpactMap({ rows, kind, crit, selected, onSelect }) {
  const cities = useMemo(() => groupCities(rows, kind), [rows, kind]);
  const [hover, setHover] = useState(null); // { type: "city" | "stadium", id }
  const city = cities.find((c) => c.id === selected) || null;

  const view = useMemo(() => {
    if (!city) return COUNTRY_VIEW;
    const pts = city.rows.map((r) => r.coordinates).filter(Boolean);
    if (!pts.length && city.coordinates) pts.push(city.coordinates);
    if (!pts.length) return COUNTRY_VIEW;
    const lons = pts.map((p) => p[0]);
    const lats = pts.map((p) => p[1]);
    const pad = 0.1;
    let west = Math.min(...lons) - pad;
    let east = Math.max(...lons) + pad;
    let south = Math.min(...lats) - pad;
    let north = Math.max(...lats) + pad;
    const minLon = 0.5;
    if (east - west < minLon) {
      const m = (east + west) / 2;
      west = m - minLon / 2;
      east = m + minLon / 2;
    }
    return viewOf(west, south, east, north);
  }, [city]);

  const regionTone = new Map(cities.filter((c) => c.region).map((c) => [c.region, c.tone]));
  const hoverCity = hover?.type === "city" ? cities.find((c) => c.id === hover.id) : null;
  const hoverRow = hover?.type === "stadium" ? cities.flatMap((c) => c.rows).find((r) => r.stadium.id === hover.id) : null;
  const legend =
    kind === "new"
      ? [["warn", "Start assessing soon"], ["mute", "Later"]]
      : [["bad", "Would reopen or fail in review"], ["warn", "Already short of it"], ["good", "Still meets it"], ["mute", "No evidence yet"]];

  return (
    <div className="im-wrap">
    <div className={`im-map${city ? " zoomed" : ""}`} role="group" aria-label={`Heat map of the stadiums affected by ${crit}`}>
      <svg className="im-svg" viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} preserveAspectRatio="none" aria-hidden="true" onClick={() => onSelect(null)}>
        {LAND.map((r, i) => (
          <path key={i} d={r.d} className="im-region" data-tone={regionTone.get(r.name) || undefined} fillRule="evenodd" />
        ))}
      </svg>

      {!city &&
        cities.map((c) => {
          if (!c.coordinates) return null;
          const pos = at(view, c.coordinates[0], c.coordinates[1]);
          return (
            <button
              key={c.id}
              type="button"
              className="im-pin im-city"
              data-tone={c.tone}
              style={pos}
              aria-label={`${c.name}: ${smallText(c, kind)}. Zoom to its stadiums.`}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(c.id);
              }}
              onMouseEnter={() => setHover({ type: "city", id: c.id })}
              onFocus={() => setHover({ type: "city", id: c.id })}
              onMouseLeave={() => setHover(null)}
              onBlur={() => setHover(null)}
            >
              <i className="im-glow" />
              <i className="im-dot" />
              {c.acting > 0 && <em className="im-badge">{c.acting}</em>}
              <span className="im-label">
                <b>{c.name}</b>
                <small>{smallText(c, kind)}</small>
              </span>
            </button>
          );
        })}

      {city &&
        city.rows.map((r) => {
          if (!r.coordinates) return null;
          const pos = at(view, r.coordinates[0], r.coordinates[1]);
          return (
            <button
              key={r.stadium.id}
              type="button"
              className="im-pin im-stad"
              data-tone={r.tone}
              style={pos}
              aria-label={`${r.stadium.name}: ${OUTCOME[r.outcome].label}`}
              onMouseEnter={() => setHover({ type: "stadium", id: r.stadium.id })}
              onFocus={() => setHover({ type: "stadium", id: r.stadium.id })}
              onMouseLeave={() => setHover(null)}
              onBlur={() => setHover(null)}
              onClick={(e) => e.stopPropagation()}
            >
              <i className="im-glow" />
              <i className="im-dot" />
              {(r.tone === "bad" || r.tone === "warn") && (
                <span className="im-label">
                  <b>{r.stadium.name.replace(/ (Sports City )?Stadium$/, "").replace(/ Sports City$/, "")}</b>
                </span>
              )}
            </button>
          );
        })}

      {hoverCity && hoverCity.coordinates && (
        <Card
          style={at(view, hoverCity.coordinates[0], hoverCity.coordinates[1])}
          title={hoverCity.name}
          lines={[
            [`${hoverCity.rows.length} stadium${hoverCity.rows.length === 1 ? "" : "s"}`, "muted"],
            [kind === "new" ? `${hoverCity.acting} to start assessing soon` : `${hoverCity.reopened} compliant would reopen`, hoverCity.acting ? "bad" : "muted"],
            [kind === "new" ? null : `${hoverCity.rows.filter((r) => r.outcome === "failsInReview").length} in review would fail`, "warn"],
          ]}
        />
      )}
      {hoverRow && hoverRow.coordinates && (
        <Card
          style={at(view, hoverRow.coordinates[0], hoverRow.coordinates[1])}
          title={hoverRow.stadium.name}
          lines={[
            [`Due ${hoverRow.stadium.completionYear} · ${hoverRow.city}`, "muted"],
            [kind === "new" ? (hoverRow.actionable ? "Should start assessing it soon" : "Not assessed yet") : OUTCOME[hoverRow.outcome].label, hoverRow.tone === "bad" ? "bad" : hoverRow.tone === "warn" ? "warn" : null],
            [hoverRow.valueText ? `Recorded ${hoverRow.valueText}, required ${crit}` : null, "muted"],
          ]}
        />
      )}

      <div className="im-title">
        <b>{city ? city.name : "Where this lands"}</b>
        <span>{city ? `${city.rows.length} stadium${city.rows.length === 1 ? "" : "s"}` : "Click a city to zoom in"}</span>
      </div>
      {city && (
        <button type="button" className="im-recenter" onClick={() => onSelect(null)}>
          Recenter
        </button>
      )}
    </div>
    <ul className="im-legend" aria-label="Legend">
      {legend.map(([tone, label]) => (
        <li key={tone}>
          <i data-tone={tone} /> {label}
        </li>
      ))}
    </ul>
    </div>
  );
}
