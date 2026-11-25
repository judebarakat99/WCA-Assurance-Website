"use client";

const VIEWS = [
  ["map", "Map"],
  ["portfolio", "Portfolio"],
];

/** Switch the home page between the assurance map and the national portfolio. */
export default function ViewToggle({ view, onChange, className = "" }) {
  return (
    <div className={`view-toggle ${className}`.trim()} role="group" aria-label="Home view">
      {VIEWS.map(([id, label]) => (
        <button key={id} type="button" aria-pressed={view === id} className={view === id ? "on" : undefined} onClick={() => onChange(id)}>
          {label}
        </button>
      ))}
    </div>
  );
}
