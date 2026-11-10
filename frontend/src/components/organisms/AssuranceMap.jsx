"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import regions from "../../../../data/geo/sa-regions.geo.json" with { type: "json" };
import { pct } from "@/lib/domain/data";

// Saudi Arabia's extent ([west, south], [east, north]), from the region data.
const BOUNDS = [
  [34.49, 16.38],
  [55.67, 32.15],
];
const CITY_ZOOM = 6.4;

// Map colours come from the theme tokens, read at runtime.
function themeColors() {
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  return { land: v("--map-land"), coast: v("--map-coast"), water: v("--sunk"), line: v("--line") };
}

function applyTheme(map) {
  const c = themeColors();
  map.setPaintProperty("water", "background-color", c.water);
  map.setPaintProperty("regions-fill", "fill-color", c.land);
  map.setPaintProperty("regions-line", "line-color", c.coast);
}

function pinElement(onClick) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "amap-pin";
  el.innerHTML = '<i class="amap-glow"></i><i class="amap-dot"></i><span class="amap-label"><b></b><small></small></span>';
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return el;
}

function paintPin(el, city, selected) {
  el.dataset.tone = city.tone;
  el.classList.toggle("sel", selected);
  el.setAttribute(
    "aria-label",
    `${city.name}: ${pct(city.assurance.assured)}% assured, ${pct(city.assurance.coverage)}% assessed`,
  );
  el.setAttribute("aria-pressed", String(selected));
  el.querySelector("b").textContent = city.name;
  const reviewed = city.assurance.compliant + city.assurance["non-compliant"];
  el.querySelector("small").textContent = reviewed ? `${pct(city.assurance.assured)}% assured` : "Not reviewed yet";
}

/**
 * Interactive map of Saudi Arabia's regions with a pin per host city,
 * coloured by assured compliance. MapLibre GL JS, no basemap or API key.
 */
export default function AssuranceMap({ cities, selected, onSelect, recenterSignal }) {
  const box = useRef(null);
  const mapRef = useRef(null);
  const pins = useRef(new Map());
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Create the map once.
  useEffect(() => {
    let map;
    let observer;
    let media;
    let retheme;
    const markers = pins.current;
    let cancelled = false;
    (async () => {
      // MapLibre 5 ships a UMD build with its worker inlined (no worker file to host).
      const mod = await import("maplibre-gl");
      const maplibregl = mod.default ?? mod;
      if (cancelled || !box.current) return;
      const c = themeColors();
      map = new maplibregl.Map({
        container: box.current,
        bounds: BOUNDS,
        fitBoundsOptions: { padding: 16 },
        minZoom: 3,
        maxZoom: 9,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        style: {
          version: 8,
          sources: { regions: { type: "geojson", data: regions } },
          layers: [
            { id: "water", type: "background", paint: { "background-color": c.water } },
            { id: "regions-fill", type: "fill", source: "regions", paint: { "fill-color": c.land } },
            { id: "regions-line", type: "line", source: "regions", paint: { "line-color": c.coast, "line-width": 1 } },
          ],
        },
      });
      map.addControl(
        new maplibregl.AttributionControl({
          compact: true,
          customAttribution: "© OpenStreetMap contributors · geoBoundaries",
        }),
      );
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      // Keep the country clear of the briefing card on wide screens.
      if (box.current.clientWidth > 860) {
        map.setPadding({ left: 400, right: 40, top: 20, bottom: 70 });
        map.fitBounds(BOUNDS, { duration: 0 });
      }
      map.on("click", () => onSelectRef.current(null));
      map.once("load", () => applyTheme(map));
      retheme = () => map.isStyleLoaded() && applyTheme(map);
      observer = new MutationObserver(retheme);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      media = window.matchMedia("(prefers-color-scheme: dark)");
      media.addEventListener("change", retheme);
      mapRef.current = map;
      for (const city of cities) {
        const el = pinElement(() => onSelectRef.current(city.id));
        const marker = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(city.coordinates).addTo(map);
        markers.set(city.id, { el, marker });
        paintPin(el, city, city.id === selected);
      }
    })();
    return () => {
      cancelled = true;
      observer?.disconnect();
      if (retheme) media?.removeEventListener("change", retheme);
      markers.clear();
      map?.remove();
      mapRef.current = null;
    };
    // The map is created once; pins are repainted by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Repaint pins when data or the selection changes.
  useEffect(() => {
    for (const city of cities) {
      const pin = pins.current.get(city.id);
      if (pin) paintPin(pin.el, city, city.id === selected);
    }
  }, [cities, selected]);

  // Fly to the selected city, or back home.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const city = cities.find((c) => c.id === selected);
    if (city) map.flyTo({ center: city.coordinates, zoom: CITY_ZOOM, essential: true });
    else map.fitBounds(BOUNDS, { essential: true });
    // Only react to selection changes and explicit recenter requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, recenterSignal]);

  return <div ref={box} className="amap" role="region" aria-label="Map of host cities" />;
}
