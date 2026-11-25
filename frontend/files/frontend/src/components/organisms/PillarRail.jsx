"use client";

import { PILLARS } from "@/lib/domain/cityAssurance.mjs";

/** Requirement families (the chapters of the FIFA stadium book); the active one filters the map and the briefing. */
export default function PillarRail({ active, onChange }) {
  return (
    <nav className="arail" aria-label="Requirement families">
      {PILLARS.map((p) => (
        <button
          key={p.label}
          type="button"
          className={active === p.id ? "on" : undefined}
          aria-pressed={active === p.id}
          title={p.id ? `Chapter ${p.number}: ${p.id}` : p.label}
          onClick={() => onChange(p.id)}
        >
          <b className="arail-n">{p.number || "All"}</b>
          <span>{p.short || "All"}</span>
        </button>
      ))}
    </nav>
  );
}
