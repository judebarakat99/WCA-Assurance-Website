"use client";

import { PILLARS, UPCOMING_PILLARS } from "@/lib/domain/cityAssurance.mjs";

const ICONS = {
  all: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  Capacity: "M5 18v-5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5M5 18h14M8 11V7h8v4",
  Pitch: "M3 6h18v12H3zM12 6v12M12 12m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0",
  Lighting: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z",
  "Safety & security": "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z",
  Sustainability: "M5 19c0-8 6-14 14-14 0 8-6 14-14 14zM5 19l7-7",
  "Human rights": "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3.3 2.7-6 6-6s6 2.7 6 6M12 20c0-3.3 1.8-6 4-6 2.2 0 6 2.7 6 6",
  "Media & broadcast": "M4 8h16v11H4zM8 3l4 5 4-5",
};

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d={ICONS[name]} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** FIFA requirement pillars; the active one filters the map and the briefing. */
export default function PillarRail({ active, onChange }) {
  return (
    <nav className="arail" aria-label="Requirement pillars">
      {PILLARS.map((p) => (
        <button
          key={p.label}
          type="button"
          className={active === p.id ? "on" : undefined}
          aria-pressed={active === p.id}
          title={p.label}
          onClick={() => onChange(p.id)}
        >
          <Icon name={p.id || "all"} />
          <span>{p.id || "All"}</span>
        </button>
      ))}
      <hr />
      {UPCOMING_PILLARS.map((label) => (
        <button key={label} type="button" disabled title={`${label} · not in the requirements catalogue yet`}>
          <Icon name={label} />
          <span>{label.split(" ")[0]}</span>
        </button>
      ))}
    </nav>
  );
}
