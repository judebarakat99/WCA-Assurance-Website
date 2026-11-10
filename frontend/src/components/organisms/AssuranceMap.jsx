"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import regions from "../../../../data/geo/sa-regions.geo.json" with { type: "json" };
import { fmtN, pct } from "@/lib/domain/data";
import { STATUS_LABEL } from "@/lib/domain/facilities.mjs";

// Saudi Arabia's extent ([west, south], [east, north]), from the region data.
const BOUNDS = [
  [34.49, 16.38],
  [55.67, 32.15],
];
// From this zoom the map switches from city pins to stadium pins.
const STADIUM_ZOOM = 7;

// Map colours come from the theme tokens, read at runtime.
function themeColors() {
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  return {
    land: v("--map-land"),
    coast: v("--map-coast"),
    water: v("--sunk"),
    tone: { good: v("--good"), warn: v("--warn"), bad: v("--bad"), mute: v("--muted") },
  };
}

// Host-city regions are shaded by their city's tone; other regions stay plain.
function regionPaint(cities, c) {
  const color = ["match", ["get", "name"]];
  const opacity = ["match", ["get", "name"]];
  for (const city of cities) {
    color.push(city.region, c.tone[city.tone]);
    opacity.push(city.region, city.tone === "mute" ? 0.12 : 0.24);
  }
  color.push(c.land);
  opacity.push(0);
  return { color, opacity };
}

function applyTheme(map, cities) {
  const c = themeColors();
  const host = regionPaint(cities, c);
  map.setPaintProperty("water", "background-color", c.water);
  map.setPaintProperty("regions-fill", "fill-color", c.land);
  map.setPaintProperty("regions-host", "fill-color", host.color);
  map.setPaintProperty("regions-host", "fill-opacity", host.opacity);
  map.setPaintProperty("regions-line", "line-color", c.coast);
}

function markerButton(className, html, { onClick, onEnter, onLeave }) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = className;
  el.innerHTML = html;
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  el.addEventListener("mouseenter", onEnter);
  el.addEventListener("focus", onEnter);
  el.addEventListener("mouseleave", onLeave);
  el.addEventListener("blur", onLeave);
  return el;
}

const reviewedLine = (a) =>
  a.compliant + a["non-compliant"] ? `${pct(a.assured)}% assured` : "Not reviewed yet";

function paintCityPin(el, city, selected) {
  const a = city.assurance;
  el.dataset.tone = city.tone;
  el.dataset.alert = String(a["non-compliant"] > 0);
  el.classList.toggle("sel", selected);
  el.setAttribute("aria-pressed", String(selected));
  el.setAttribute(
    "aria-label",
    `${city.name}: ${pct(a.assured)}% assured, ${pct(a.coverage)}% assessed, ${a.needsAttention} need attention`,
  );
  el.querySelector("b").textContent = city.name;
  el.querySelector("small").textContent = city.dueCount ? reviewedLine(a) : "None due yet";
  const badge = el.querySelector(".amap-badge");
  badge.textContent = a.needsAttention ? String(a.needsAttention) : "";
  badge.hidden = !a.needsAttention;
}

function paintStadiumPin(el, s) {
  el.dataset.tone = s.tone;
  el.dataset.due = String(s.due);
  el.dataset.alert = String(s.due && s.assurance["non-compliant"] > 0);
  el.dataset.approx = String(s.location.accuracy === "approximate");
  el.setAttribute(
    "aria-label",
    `${s.name}: ${pct(s.assurance.assured)}% assured, due ${s.completionYear}. Open the facility.`,
  );
  el.querySelector("b").textContent = s.name.replace(/ Stadium$/, "");
}

// Hover card content, built with textContent only.
function card(title, lines) {
  const root = document.createElement("div");
  const h = document.createElement("b");
  h.textContent = title;
  root.append(h);
  for (const [text, tone] of lines) {
    if (!text) continue;
    const p = document.createElement("span");
    p.textContent = text;
    if (tone) p.className = tone;
    root.append(p);
  }
  return root;
}

function cityCard(city, year) {
  const a = city.assurance;
  return card(city.name, [
    [`${reviewedLine(a)} · ${pct(a.coverage)}% assessed`],
    [a["non-compliant"] ? `${a["non-compliant"]} non-compliant` : null, "bad"],
    [a["evidence-submitted"] ? `${a["evidence-submitted"]} awaiting review` : null, "warn"],
    [year ? `${city.dueCount} of ${city.stadiums.length} stadiums due by ${year}` : `${city.stadiums.length} stadiums`, "muted"],
  ]);
}

function stadiumCard(s, year) {
  const a = s.assurance;
  const approx = s.location.accuracy === "approximate";
  return card(s.name, [
    [`${STATUS_LABEL[s.status]} · due ${s.completionYear} · ${fmtN(s.grossCapacity)} seats`, "muted"],
    [!s.due ? `Not due complete by ${year}` : null, "muted"],
    [`${reviewedLine(a)} · ${pct(a.coverage)}% assessed`],
    [a.needsAttention ? `${a.needsAttention} need attention` : null, a["non-compliant"] ? "bad" : "warn"],
    [approx ? "Approximate location" : "Location from OpenStreetMap", "fine muted"],
  ]);
}

/** Fit the selected city's stadiums, or the whole country when none is selected. */
function fitSelection(map, cities, selected, options = {}) {
  const city = cities.find((c) => c.id === selected);
  if (!city) {
    map.fitBounds(BOUNDS, { essential: true, ...options });
    return;
  }
  const points = city.stadiums.map((s) => s.location.coordinates);
  const lons = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  const pad = 0.08; // degrees around the outermost stadiums
  map.fitBounds(
    [
      [Math.min(...lons) - pad, Math.min(...lats) - pad],
      [Math.max(...lons) + pad, Math.max(...lats) + pad],
    ],
    { maxZoom: 10, essential: true, ...options },
  );
}

/**
 * Interactive map of Saudi Arabia's regions. Host-city regions are shaded by
 * assurance; each host city has a pin with an attention badge, and zooming in
 * shows the stadiums. MapLibre GL JS, no basemap or API key.
 */
export default function AssuranceMap({ cities, year, selected, onSelect, onOpenStadium, recenterSignal }) {
  const box = useRef(null);
  const mapRef = useRef(null);
  const pins = useRef(new Map());
  const stadiumPins = useRef(new Map());
  const popupRef = useRef(null);
  const hoverRef = useRef(null); // () => card element for what is hovered
  // Latest props, for map callbacks created once.
  const live = useRef({ cities, year, selected, onSelect, onOpenStadium });
  useEffect(() => {
    live.current = { cities, year, selected, onSelect, onOpenStadium };
  }, [cities, year, selected, onSelect, onOpenStadium]);

  // Create the map once.
  useEffect(() => {
    let map;
    let observer;
    let media;
    let retheme;
    const cityMarkers = pins.current;
    const stadiumMarkers = stadiumPins.current;
    let cancelled = false;
    (async () => {
      // MapLibre 5 ships a UMD build with its worker inlined (no worker file to host).
      const mod = await import("maplibre-gl");
      const maplibregl = mod.default ?? mod;
      if (cancelled || !box.current) return;
      const c = themeColors();
      const host = regionPaint(live.current.cities, c);
      map = new maplibregl.Map({
        container: box.current,
        bounds: BOUNDS,
        fitBoundsOptions: { padding: 16 },
        minZoom: 3,
        maxZoom: 12,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        style: {
          version: 8,
          sources: { regions: { type: "geojson", data: regions } },
          layers: [
            { id: "water", type: "background", paint: { "background-color": c.water } },
            { id: "regions-fill", type: "fill", source: "regions", paint: { "fill-color": c.land } },
            {
              id: "regions-host",
              type: "fill",
              source: "regions",
              paint: { "fill-color": host.color, "fill-opacity": host.opacity },
            },
            { id: "regions-line", type: "line", source: "regions", paint: { "line-color": c.coast, "line-width": 1 } },
          ],
        },
      });
      map.addControl(
        new maplibregl.AttributionControl({
          compact: true,
          customAttribution: "© OpenStreetMap contributors · geoBoundaries · stadium locations partly approximate",
        }),
      );
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      // Keep the country clear of the briefing card on wide screens.
      if (box.current.clientWidth > 860) {
        map.setPadding({ left: 430, right: 60, top: 80, bottom: 70 });
        map.fitBounds(BOUNDS, { duration: 0 });
      }
      map.on("click", () => live.current.onSelect(null));
      // Switching between city and stadium pins hides the hovered pin, so close its card.
      let zoomed = null;
      const zoomClass = () => {
        const now = map.getZoom() >= STADIUM_ZOOM;
        if (now === zoomed) return;
        zoomed = now;
        box.current?.classList.toggle("amap-zoomed", now);
        hoverRef.current = null;
        popupRef.current?.remove();
      };
      map.on("zoom", zoomClass);
      zoomClass();
      map.once("load", () => applyTheme(map, live.current.cities));
      retheme = () => map.isStyleLoaded() && applyTheme(map, live.current.cities);
      observer = new MutationObserver(retheme);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      media = window.matchMedia("(prefers-color-scheme: dark)");
      media.addEventListener("change", retheme);

      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 16,
        maxWidth: "260px",
        className: "amap-card",
      });
      popupRef.current = popup;
      const hover = (lngLat, build) => () => {
        hoverRef.current = build;
        popup.setLngLat(lngLat).setDOMContent(build()).addTo(map);
      };
      const leave = () => {
        hoverRef.current = null;
        popup.remove();
      };

      for (const city of live.current.cities) {
        const findCity = () => live.current.cities.find((x) => x.id === city.id);
        const el = markerButton(
          "amap-pin",
          '<i class="amap-glow"></i><i class="amap-dot"></i><em class="amap-badge" hidden></em><span class="amap-label"><b></b><small></small></span>',
          {
            onClick: () => live.current.onSelect(city.id),
            onEnter: hover(city.coordinates, () => cityCard(findCity(), live.current.year)),
            onLeave: leave,
          },
        );
        const marker = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(city.coordinates).addTo(map);
        cityMarkers.set(city.id, { el, marker });
        paintCityPin(el, city, city.id === selected);
        for (const s of city.stadiums) {
          const findStadium = () => findCity().stadiums.find((x) => x.id === s.id);
          const sel = markerButton("amap-stadium", '<i></i><b></b>', {
            onClick: () => live.current.onOpenStadium(s.id),
            onEnter: hover(s.location.coordinates, () => stadiumCard(findStadium(), live.current.year)),
            onLeave: leave,
          });
          const m = new maplibregl.Marker({ element: sel, anchor: "center" })
            .setLngLat(s.location.coordinates)
            .addTo(map);
          stadiumMarkers.set(s.id, { el: sel, marker: m });
          paintStadiumPin(sel, s);
        }
      }
      mapRef.current = map;
      // A city may already be selected (returning to the page, or the guided demo).
      if (live.current.selected) fitSelection(map, live.current.cities, live.current.selected, { duration: 0 });
    })();
    return () => {
      cancelled = true;
      observer?.disconnect();
      if (retheme) media?.removeEventListener("change", retheme);
      cityMarkers.clear();
      stadiumMarkers.clear();
      popupRef.current = null;
      map?.remove();
      mapRef.current = null;
    };
    // The map is created once; pins are repainted by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Repaint pins, region shading and any open card when data or the selection changes.
  useEffect(() => {
    for (const city of cities) {
      const pin = pins.current.get(city.id);
      if (pin) paintCityPin(pin.el, city, city.id === selected);
      for (const s of city.stadiums) {
        const sp = stadiumPins.current.get(s.id);
        if (sp) paintStadiumPin(sp.el, s);
      }
    }
    const map = mapRef.current;
    if (map?.isStyleLoaded()) applyTheme(map, cities);
    if (hoverRef.current && popupRef.current?.isOpen()) popupRef.current.setDOMContent(hoverRef.current());
  }, [cities, year, selected]);

  // Fit the selected city's stadiums, or go back to the whole country.
  useEffect(() => {
    if (mapRef.current) fitSelection(mapRef.current, cities, selected);
    // Only react to selection changes and explicit recenter requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, recenterSignal]);

  return <div ref={box} className="amap" role="region" aria-label="Map of host cities and stadiums" />;
}
