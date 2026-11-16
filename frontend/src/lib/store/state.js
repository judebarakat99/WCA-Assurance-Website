// Client-side UI state shared across pages, exposed to React as an external
// store. Assessments and requirement versions live in store/assessments.js.

// Assurance map and review queue: selected city, requirement area, timeline
// year, recenter count, and the change being previewed (a scenario id,
// "pick" or null).
export const ui = {
  map: { city: null, pillar: null, year: 2034, recenter: 0, change: null },
};

/** Assurance map back to the whole country, all areas, every stadium. */
export function resetMapUi() {
  ui.map = { city: null, pillar: null, year: 2034, recenter: ui.map.recenter + 1, change: null };
}

/** Change part of the assurance map's state and re-render. */
export function updateMap(patch) {
  ui.map = { ...ui.map, ...patch };
  rerender();
}

// Guided demo state (player in lib/tour/player.js, dock in organisms/TourDock).
export const tour = {
  list: null,
  active: false,
  i: 0,
  playing: false,
  voice: true,
  voiceName: "",
  sel: null,
  timers: [],
  sent: 0,
  gen: 0,
  text: "",
};
// Nabd assistant conversation (actions in lib/assistant/chat.js).
export const ai = { open: false, msgs: [], pending: false };

// ---------- subscriptions ----------
// The state objects are changed in place; every change bumps a version
// number, and useProgramme() (useSyncExternalStore) re-renders the
// components that read it. Code that changes state calls rerender().
let version = 0;
const listeners = new Set();
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function getVersion() {
  return version;
}
export function notify() {
  version++;
  listeners.forEach((listener) => listener());
}

// ---------- render & navigation bridge ----------
// Set by lib/runtime.js: bridge.render refreshes the tour highlight after a
// change; bridge.navigate routes view keys through the Next router.
export const bridge = { render: null, navigate: null };
export function rerender() {
  notify();
  if (bridge.render) bridge.render();
}
// goView takes a view key ("review", "facility-<id>", ...); see lib/runtime PATHS.
export function goView(h) {
  if (bridge.navigate) bridge.navigate(h);
}
