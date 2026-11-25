"use client";

import Link from "next/link";
import { EXPOSURE } from "@/lib/domain/exposure.mjs";
import { BUCKET_TITLE, DEFINITION, LEVELS, SHORT_DEFINITION, familiesAt } from "@/lib/overview/model.mjs";

const pct = (v) => (v == null ? "–" : `${Math.round(v * 100)}%`);
const label = (k) => EXPOSURE[k]?.label || k[0].toUpperCase() + k.slice(1);
const plural = (n, one, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
const count = (n, word) => `${n.toLocaleString("en-US")} ${word}`;

/** The legend, the open stadium, its four exposure classes, and the chapters behind the class that is chosen. */
export default function OverviewSide({ row, bucket, onBucket, chapter }) {
  // The class a person clicked is shown even when it is empty (so the page can say there is none); until one is clicked, the worst class with findings.
  const level = bucket || (row ? LEVELS.find((k) => row.counts[k] > 0) || "controlled" : "controlled");
  const families = row ? familiesAt(row, level) : [];
  const shown = families.slice(0, 3);
  const more = families.length - shown.length;
  const atRisk = row && (row.schedule.key !== "on-track" || row.schedule.slip > 0);
  return (
    <aside className="ov-side" aria-label="Exposure">
      <section className="ov-legend ov-card" aria-label="Legend">
        <h2>Assured compliance</h2>
        <ul>
          {LEVELS.map((k) => (
            <li key={k} data-level={k}>
              <b>{label(k)}</b>
              <span>{EXPOSURE[k]?.definition || DEFINITION[k]}</span>
            </li>
          ))}
        </ul>
        <p>Classification is applied to the requirement or finding, not permanently to the FIFA family.</p>
      </section>

      {row ? (
        <>
          <section className="ov-stad ov-card" data-level={row.level} aria-label="Selected stadium">
            <div>
              <h3>
                <Link href={`/facilities/${row.id}`}>{row.name}</Link>
              </h3>
              <p>
                Next gate: {row.gate} · {row.city} · due {row.year}
              </p>
            </div>
            <div className="ov-stad-r">
              <div>
                <b className="ov-big">{pct(row.readiness)}</b>
                <small>Assured readiness</small>
              </div>
              <span className={`ov-pill ${row.schedule.tone}`}>
                {atRisk ? (row.schedule.slip ? row.schedule.label : "AT RISK") : "ON TRACK"}
                <small>{count(row.counts.critical, "critical")}</small>
              </span>
            </div>
          </section>

          <div className="ov-buckets" role="group" aria-label="Exposure classes">
            {LEVELS.map((k) => (
              <button key={k} type="button" data-level={k} className={`ov-bucket${k === level ? " on" : ""}`} aria-pressed={k === level} onClick={() => onBucket(k)}>
                <span>{label(k)}</span>
                <b>{row.counts[k]}</b>
                <small>{SHORT_DEFINITION[k]}</small>
              </button>
            ))}
          </div>

          <section className="ov-reveal ov-card" data-level={level} aria-live="polite">
            <h3>Click an exposure bucket to reveal the affected FIFA families</h3>
            {row.counts[level] === 0 ? (
              <p className="muted small m0">No {label(level).toLowerCase()} findings{chapter ? ` in ${chapter}` : ""} at this stadium.</p>
            ) : (
              <div className="ov-reveal-row">
                <span className="ov-tag">{BUCKET_TITLE[level]}</span>
                <span className="ov-fam">
                  {shown.map((f) => `${f.short}${families.length > 1 ? ` (${f.count})` : ""}`).join(" · ")}
                  {more > 0 ? ` · +${more} more` : ""}
                </span>
                <Link className="ov-go" href={`/facilities/${row.id}`}>
                  View {plural(row.counts[level], "finding")} →
                </Link>
              </div>
            )}
          </section>
        </>
      ) : (
        <p className="muted">Choose a stadium.</p>
      )}
    </aside>
  );
}
