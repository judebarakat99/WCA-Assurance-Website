"use client";

import { PILLARS, TIMELINE } from "@/lib/domain/cityAssurance.mjs";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";

// Every year on the map's timeline except the last, which means "any year".
const DUE_YEARS = Array.from({ length: TIMELINE.to - TIMELINE.from }, (_, i) => TIMELINE.from + i);
const COMPLETIONS = new Set(FACILITY_REGISTER.stadiums.map((s) => s.completionYear));
export const STATUS_OPTIONS = [
  ["", "Everything"],
  ["evidence-submitted", "Awaiting review"],
  ["non-compliant", "Non-compliant"],
  ["reopened", "Reopened by a change"],
];

function Select({ label, value, onChange, options }) {
  return (
    <label className="f">
      {label}
      <select value={value || ""} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, text]) => (
          <option key={`${v}-${text}`} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

/** The review queue's filters. filters: { cityId, stadiumId, category, year, status }; set(name, value). */
export default function QueueFilters({ filters, set }) {
  return (
    <div className="filters rq-filters">
      <Select
        label="Host city"
        value={filters.cityId}
        onChange={(v) => set("city", v)}
        options={[["", "All host cities"], ...FACILITY_REGISTER.hostCities.map((c) => [c.id, c.name])]}
      />
      <Select
        label="Stadium"
        value={filters.stadiumId}
        onChange={(v) => set("stadium", v)}
        options={[["", "All stadiums"], ...FACILITY_REGISTER.stadiums.map((s) => [s.id, s.name])]}
      />
      <Select
        label="Requirement area"
        value={filters.category}
        onChange={(v) => set("area", v)}
        options={PILLARS.map((p) => [p.id || "", p.label])}
      />
      <Select
        label="Stadiums due by"
        value={filters.year}
        onChange={(v) => set("year", v)}
        options={[
          ["", "Any year"],
          ...DUE_YEARS.map((y) => [y, `${y}${COMPLETIONS.has(y) ? "" : " (no stadium completes)"}`]),
        ]}
      />
      <Select label="Showing" value={filters.status} onChange={(v) => set("status", v)} options={STATUS_OPTIONS} />
    </div>
  );
}
