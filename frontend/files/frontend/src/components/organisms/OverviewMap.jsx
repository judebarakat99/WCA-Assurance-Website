"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import regions from "../../../../data/geo/sa-regions.geo.json" with { type: "json" };
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";
import { EXPOSURE } from "@/lib/domain/exposure.mjs";
import { LEVELS } from "@/lib/overview/model.mjs";

// The map of Saudi Arabia for the Overview: the same regions as the rest of the site, drawn as SVG so it fits inside the page
// and works without WebGL. Stadiums are dots coloured by their worst exposure class. Host cities with several stadiums show one
// bubble with a count at country level; clicking it (or a row in the portfolio) zooms to that city's stadiums.
const BOUNDS = [34.49, 16.38, 55.67, 32.15]; // west, south, east, north
const K = Math.cos((24 * Math.PI) / 180);
const x = (lon) => lon * K;
const y = (lat) => -lat;

const ringPath = (ring) => ring.map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(3)},${y(p[1]).toFixed(3)}`).join("") + "Z";
function featurePath(g) {
  if (!g) return "";
  const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  return polys.map((rings) => rings.map(ringPath).join("")).join("");
}
const LAND = (regions.features || []).map((f) => ({ name: f.properties?.name || "", d: featurePath(f.geometry) }));

/** A scale and offset that fit a geographic box into a w by h area. */
function fit([west, south, east, north], w, h, pad) {
  const x0 = x(west);
  const y0 = y(north);
  const bw = x(east) - x0;
  const bh = y(south) - y0;
  const s = Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh);
  return { s, ox: (w - bw * s) / 2 - x0 * s, oy: (h - bh * s) / 2 - y0 * s };
}

function boxOf(points, pad = 0.14, minSpan = 0.5) {
  const lons = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  let west = Math.min(...lons) - pad;
  let east = Math.max(...lons) + pad;
  let south = Math.min(...lats) - pad;
  let north = Math.max(...lats) + pad;
  if (east - west < minSpan) [west, east] = [(east + west) / 2 - minSpan / 2, (east + west) / 2 + minSpan / 2];
  if (north - south < minSpan) [south, north] = [(north + south) / 2 - minSpan / 2, (north + south) / 2 + minSpan / 2];
  return [west, south, east, north];
}

const label = (k) => EXPOSURE[k]?.label || k;
const pct = (v) => (v == null ? "–" : `${Math.round(v * 100)}%`);

/**
 * rows: the portfolio rows (id, name, short, cityId, coordinates, level, readiness, counts).
 * focusCity: the host city zoomed to, or null for the whole country. onFocusCity(id | null), onSelect(id), onHover(id | null).
 */
export default function OverviewMap({ rows, selectedId, hoverId, focusCity, onSelect, onHover, onFocusCity }) {
  const box = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [tip, setTip] = useState(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const read = () => setSize({ w: Math.round(el.clientWidth), h: Math.round(el.clientHeight) });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cities = useMemo(() => {
    const info = new Map(FACILITY_REGISTER.hostCities.map((c) => [c.id, c]));
    const by = new Map();
    for (const r of rows) {
      if (!r.coordinates) continue;
      if (!by.has(r.cityId)) by.set(r.cityId, []);
      by.get(r.cityId).push(r);
    }
    return [...by].map(([id, list]) => {
      const c = info.get(id);
      const worst = LEVELS.find((k) => list.some((r) => r.level === k)) || "controlled";
      return { id, name: c?.name || list[0].city, region: c?.region || "", coordinates: c?.coordinates || list[0].coordinates, rows: list, level: worst };
    });
  }, [rows]);

  const focus = cities.find((c) => c.id === focusCity) || null;
  const view = useMemo(() => {
    if (!size.w || !size.h) return null;
    return fit(focus ? boxOf(focus.rows.map((r) => r.coordinates)) : BOUNDS, size.w, size.h, focus ? 40 : 14);
  }, [size, focus]);
  const at = (c) => (view ? [x(c[0]) * view.s + view.ox, y(c[1]) * view.s + view.oy] : [0, 0]);
  const tint = new Map(cities.filter((c) => c.region).map((c) => [c.region, c.level]));
  const selectedRow = rows.find((r) => r.id === selectedId);

  const showTip = (row, pos) => setTip({ row, left: pos[0], top: pos[1] });
  const dot = (r) => {
    const [px, py] = at(r.coordinates);
    const sel = r.id === selectedId;
    return (
      <button
        key={r.id}
        type="button"
        className={`ov-pin ov-sd${sel ? " sel" : ""}${r.id === hoverId ? " hov" : ""}`}
        data-level={r.level}
        style={{ left: px, top: py }}
        aria-label={`${r.name}: ${pct(r.readiness)} readiness, ${label(r.level)}. Open this stadium.`}
        aria-pressed={sel}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(r.id);
        }}
        onMouseEnter={() => {
          onHover(r.id);
          showTip(r, [px, py]);
        }}
        onMouseLeave={() => {
          onHover(null);
          setTip(null);
        }}
        onFocus={() => showTip(r, [px, py])}
        onBlur={() => setTip(null)}
      >
        <i />
        {(sel || r.id === hoverId) && <span className="ov-pin-l">{r.short}</span>}
      </button>
    );
  };

  return (
    <div ref={box} className="ov-mapbox" role="group" aria-label="Map of the stadiums" onClick={() => focus && onFocusCity(null)}>
      {view && (
        <>
          <svg className="ov-svg" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true">
            <g transform={`translate(${view.ox} ${view.oy}) scale(${view.s})`}>
              {LAND.map((r, i) => (
                <path key={i} d={r.d} className="ov-region" data-level={tint.get(r.name) || undefined} fillRule="evenodd" />
              ))}
            </g>
          </svg>

          {!focus &&
            cities.map((c) => {
              if (c.rows.length === 1) return dot(c.rows[0]);
              const [px, py] = at(c.coordinates);
              const hasSel = c.rows.some((r) => r.id === selectedId);
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`ov-pin ov-city${hasSel ? " sel" : ""}`}
                  data-level={c.level}
                  style={{ left: px, top: py }}
                  aria-label={`${c.name}: ${c.rows.length} stadiums, worst class ${label(c.level)}. Zoom to its stadiums.`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onFocusCity(c.id);
                    onSelect(c.rows[0].id);
                  }}
                >
                  <i>{c.rows.length}</i>
                  <span className="ov-pin-l">{c.name}</span>
                </button>
              );
            })}
          {focus && focus.rows.map(dot)}

          {tip && (
            <div className="ov-tip" role="status" style={{ left: tip.left, top: tip.top }} data-level={tip.row.level}>
              <b>{tip.row.name}</b>
              <span>
                {pct(tip.row.readiness)} readiness · {label(tip.row.level)}
              </span>
              <small>
                {tip.row.counts.critical} critical · {tip.row.counts.material} material
              </small>
            </div>
          )}

          <div className="ov-maptitle">
            <b>{focus ? focus.name : "Saudi Arabia"}</b>
            <span>{focus ? `${focus.rows.length} stadium${focus.rows.length === 1 ? "" : "s"}` : `${cities.length} host cities`}</span>
          </div>
          {focus && (
            <button
              type="button"
              className="ov-recenter"
              onClick={(e) => {
                e.stopPropagation();
                onFocusCity(null);
              }}
            >
              Recenter
            </button>
          )}
          {!focus && selectedRow && cities.find((c) => c.rows.length > 1 && c.rows.some((r) => r.id === selectedRow.id)) && (
            <span className="ov-maphint">{selectedRow.short} is in {selectedRow.city}. Click its bubble to zoom in.</span>
          )}
        </>
      )}
    </div>
  );
}
