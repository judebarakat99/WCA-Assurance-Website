"use client";

import regions from "../../../../data/geo/sa-regions.geo.json" with { type: "json" };

// Saudi Arabia's extent, as on the main map; equirectangular, scaled for ~24°N.
const W = 320;
const [WEST, SOUTH, EAST, NORTH] = [34.4, 16.3, 55.7, 32.2];
const KX = Math.cos((24 * Math.PI) / 180);
const SCALE = W / ((EAST - WEST) * KX);
const H = Math.round((NORTH - SOUTH) * SCALE);
const project = ([lon, lat]) => [(lon - WEST) * KX * SCALE, (NORTH - lat) * SCALE];

// Region outlines, computed once (every 3rd point is plenty at this size).
const PATHS = regions.features.map((f) => ({
  name: f.properties.name,
  d: f.geometry.coordinates
    .flatMap((poly) =>
      poly.map(
        (ring) =>
          "M" +
          ring
            .filter((_, i) => i % 3 === 0 || i === ring.length - 1)
            .map((p) => project(p).map((v) => v.toFixed(1)).join(","))
            .join("L") +
          "Z",
      ),
    )
    .join(""),
}));

/**
 * Small map for the portfolio view: host cities coloured by their worst
 * stadium risk, with the stadium count. Clicking a city filters the portfolio.
 * cities: [{ id, name, coordinates, count, risk, region }]
 */
export default function MiniMap({ cities, regionsByCity, selectedCity, highlightCity, onSelectCity }) {
  const hostTone = Object.fromEntries(cities.map((c) => [regionsByCity[c.id], c.risk]));
  return (
    <svg className="minimap" viewBox={`-6 -6 ${W + 12} ${H + 12}`} role="group" aria-label="Host cities">
      {PATHS.map((r) => (
        <path key={r.name} d={r.d} className={hostTone[r.name] ? `host ${hostTone[r.name]}` : undefined} />
      ))}
      {cities.map((c) => {
        const [x, y] = project(c.coordinates);
        const sel = c.id === selectedCity;
        return (
          <g
            key={c.id}
            className={`mm-pin ${c.risk} ${sel ? "sel" : ""} ${c.id === highlightCity ? "hl" : ""}`.trim()}
            transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}
            role="button"
            tabIndex={0}
            aria-pressed={sel}
            aria-label={`${c.name}: ${c.count} stadium${c.count === 1 ? "" : "s"}. ${sel ? "Show all cities" : "Show only this city"}.`}
            onClick={() => onSelectCity(sel ? null : c.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectCity(sel ? null : c.id);
              }
            }}
          >
            <circle r={c.count > 1 ? 13 : 9} />
            {c.count > 1 && (
              <text dy="4" textAnchor="middle">
                {c.count}
              </text>
            )}
            <text className="mm-name" y={c.count > 1 ? 26 : 22} textAnchor="middle">
              {c.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
