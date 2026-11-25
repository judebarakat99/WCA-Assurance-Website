"use client";

import { PILLARS } from "@/lib/domain/cityAssurance.mjs";

/** FIFA requirement chapters; the active one filters the map, the briefing and the portfolio. */
export default function PillarRail({ active, onChange }) {
  return (
    <nav className="arail" aria-label="Requirement chapters">
      {PILLARS.map((p) => (
        <button
          key={p.label}
          type="button"
          className={active === p.id ? "on" : undefined}
          aria-pressed={active === p.id}
          title={p.number ? `${p.number} ${p.label}` : p.label}
          onClick={() => onChange(p.id)}
        >
          <b>{p.number || "All"}</b>
          {p.number && <span>{p.short}</span>}
        </button>
      ))}
    </nav>
  );
}
