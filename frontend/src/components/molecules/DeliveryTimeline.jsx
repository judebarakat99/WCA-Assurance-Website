"use client";

import { TIMELINE } from "@/lib/domain/cityAssurance.mjs";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";

const YEARS = Array.from({ length: TIMELINE.to - TIMELINE.from + 1 }, (_, i) => TIMELINE.from + i);
const DUE_IN = Object.fromEntries(
  YEARS.map((y) => [y, FACILITY_REGISTER.stadiums.filter((s) => s.completionYear === y).length]),
);

/** Slider over stadium completion years; the map counts stadiums due by the chosen year. */
export default function DeliveryTimeline({ year, due, total, onChange }) {
  return (
    <div className="atimeline">
      <label htmlFor="atimeline-year">
        <b>Delivery timeline</b>
        <span>
          By {year}: {due} of {total} stadiums due complete
        </span>
      </label>
      <input
        id="atimeline-year"
        type="range"
        min={TIMELINE.from}
        max={TIMELINE.to}
        step={1}
        value={year}
        onChange={(e) => onChange(Number(e.target.value))}
        list="atimeline-ticks"
        aria-valuetext={`${year}: ${due} of ${total} stadiums due complete`}
      />
      <datalist id="atimeline-ticks">
        {YEARS.map((y) => (
          <option key={y} value={y} />
        ))}
      </datalist>
      <ol className="atimeline-years" aria-hidden="true">
        {YEARS.map((y) => (
          <li key={y} className={y <= year ? "on" : undefined}>
            <span>{String(y).slice(2)}</span>
            {DUE_IN[y] > 0 && <em>+{DUE_IN[y]}</em>}
          </li>
        ))}
      </ol>
    </div>
  );
}
