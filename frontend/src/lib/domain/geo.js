// Geography for the illustrative overview map.
import { VENUES } from "@/lib/domain/data";

// Approximate stadium coordinates [lon, lat]
export const GEO = {
  RUH: [46.72, 24.71],
  JED: [39.17, 21.54],
  KHO: [50.21, 26.28],
  AHB: [42.5, 18.22],
  NEO: [35.2, 28.0],
  "TBC-R3": [47.7, 23.55],
  "TBC-J1": [40.35, 20.55],
};
const AREA = (() => {
  const n = {};
  return Object.fromEntries(
    VENUES.filter((v) => GEO[v.id]).map((v) => {
      n[v.city] = (n[v.city] || 0) + 1;
      return [v.id, n[v.city] > 1 ? v.city + n[v.city] : v.city];
    }),
  );
})();
export const pinLabel = (v) => AREA[v.id] || v.city;

// Simplified Saudi Arabia outline [lon, lat] for an illustrative map
export const BORDER = [
  [35.0, 29.35],
  [36.0, 29.2],
  [37.5, 30.0],
  [38.0, 31.5],
  [39.2, 32.2],
  [40.4, 31.9],
  [42.1, 31.1],
  [44.7, 29.2],
  [46.5, 29.1],
  [47.4, 29.0],
  [48.4, 28.5],
  [48.8, 27.7],
  [49.6, 26.9],
  [50.1, 26.2],
  [50.2, 25.6],
  [50.8, 24.75],
  [51.6, 24.25],
  [52.6, 22.9],
  [55.2, 22.7],
  [55.7, 22.0],
  [55.0, 20.0],
  [52.0, 19.0],
  [49.1, 18.6],
  [48.2, 17.9],
  [47.5, 17.1],
  [46.7, 17.3],
  [44.6, 17.4],
  [43.4, 17.5],
  [43.0, 16.7],
  [42.6, 16.4],
  [41.9, 17.8],
  [41.2, 19.0],
  [40.2, 20.2],
  [39.6, 21.4],
  [39.1, 22.4],
  [38.4, 23.6],
  [37.5, 24.5],
  [36.6, 25.7],
  [35.6, 27.0],
  [34.8, 28.1],
  [34.6, 28.9],
];

export const MAP_W = 1000;
export const MAP_H = 800;
// Project [lon, lat] to map units (illustrative equirectangular projection).
export const px = ([lon, lat]) => [(lon - 33.5) * 44, (33 - lat) * 46];

// SVG path for the country outline.
export const BORDER_PATH =
  "M" + BORDER.map((p) => px(p).map((n) => n.toFixed(1)).join(" ")).join(" L") + " Z";

// Position as CSS percentages of the map box.
export function mapPosition(lonLat) {
  const [x, y] = px(lonLat);
  return { left: `${((x / MAP_W) * 100).toFixed(2)}%`, top: `${((y / MAP_H) * 100).toFixed(2)}%`, x, y };
}
