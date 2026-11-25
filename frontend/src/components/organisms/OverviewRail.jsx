"use client";

import { PILLARS } from "@/lib/domain/cityAssurance.mjs";

/** The chapters of the FIFA stadium book: choosing one narrows the whole Overview to that chapter. */
export default function OverviewRail({ active, onChange }) {
  return (
    <nav className="ov-rail" aria-label="FIFA chapters">
      {PILLARS.map((p) => (
        <button
          key={p.label}
          type="button"
          className={active === p.id ? "on" : undefined}
          aria-pressed={active === p.id}
          title={p.id ? `Chapter ${p.number}: ${p.id}` : "All chapters"}
          onClick={() => onChange(p.id)}
        >
          <b>{p.number || "All"}</b>
          <span>{p.short || "All"}</span>
        </button>
      ))}
    </nav>
  );
}
