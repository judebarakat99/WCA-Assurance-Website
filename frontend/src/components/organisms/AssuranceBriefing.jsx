"use client";

import Link from "next/link";
import Meter from "@/components/atoms/Meter";
import Ring from "@/components/atoms/Ring";
import StatusPill from "@/components/atoms/StatusPill";
import { pct } from "@/lib/domain/data";
import { TIMELINE } from "@/lib/domain/cityAssurance.mjs";
import { loadSampleAssessments, resetAssessments } from "@/lib/store/assessments";

const TONE_COLOR = { good: "var(--good)", warn: "var(--warn)", bad: "var(--bad)", mute: "var(--muted)" };

function AssuranceRing({ a, tone }) {
  return (
    <Ring
      parts={[
        { n: a.compliant, c: TONE_COLOR[tone] },
        { n: Math.max(a.inScope - a.compliant, 0), c: "var(--sunk)" },
      ]}
      value={`${pct(a.assured)}%`}
      label="assured"
    />
  );
}

function Counts({ a }) {
  return (
    <div className="abrief-counts">
      <StatusPill tone="good">{a.compliant} compliant</StatusPill>
      <StatusPill tone="warn">{a["evidence-submitted"]} awaiting review</StatusPill>
      <StatusPill tone="bad">{a["non-compliant"]} non-compliant</StatusPill>
      <StatusPill tone="mute">{a.unassessed} unassessed</StatusPill>
    </div>
  );
}

function Coverage({ a }) {
  return (
    <div className="abrief-cover">
      <div>
        <span>Assessed</span>
        <b>
          {a.assessed}/{a.inScope} · {pct(a.coverage)}%
        </b>
      </div>
      <Meter value={pct(a.coverage)} />
    </div>
  );
}

function SampleControl({ sample }) {
  return sample ? (
    <p className="abrief-sample">
      <StatusPill tone="warn">Sample data</StatusPill> Generated assessments for the demo.{" "}
      <button type="button" className="linkish" onClick={resetAssessments}>
        Clear
      </button>
    </p>
  ) : (
    <p className="abrief-sample">
      Only declared capacities are recorded so far.{" "}
      <button type="button" className="linkish" onClick={loadSampleAssessments}>
        Load sample assessments
      </button>
    </p>
  );
}

// Queue link carrying the map's current filters.
function queueHref({ cityId, pillar, year }) {
  const q = new URLSearchParams();
  if (cityId) q.set("city", cityId);
  if (pillar) q.set("area", pillar);
  if (year && year < TIMELINE.to) q.set("year", String(year));
  const s = q.toString();
  return s ? `/review?${s}` : "/review";
}

function Programme({ map, pillar, sample, onSelect }) {
  const a = map.programme;
  const focus = map.cities
    .filter((c) => c.assurance.needsAttention > 0)
    .sort((x, y) => y.assurance.needsAttention - x.assurance.needsAttention)[0];
  return (
    <>
      <span className="eyebrow">FIFA assurance · Saudi Arabia 2034</span>
      <h2>{pillar ? `${pillar} requirements` : "Where we stand"}</h2>
      <div className="abrief-top">
        <AssuranceRing a={a} tone={map.tone} />
        <div>
          <p className="abrief-lead">
            {pct(a.assured)}% of {a.inScope} in-scope requirements across{" "}
            {map.due === map.stadiumCount ? `all ${map.stadiumCount} stadiums` : `the ${map.due} stadiums due by ${map.year}`}{" "}
            are accepted by a reviewer.
          </p>
          <Coverage a={a} />
        </div>
      </div>
      <Counts a={a} />
      {focus && (
        <div className="abrief-cta">
          <Link href={queueHref({ pillar, year: map.year })}>
            <b>{a.needsAttention} need you now →</b>
            <span>Open the review queue</span>
          </Link>
          <button type="button" className="linkish" onClick={() => onSelect(focus.id)}>
            Most in {focus.name} ({focus.assurance.needsAttention}): show on map
          </button>
        </div>
      )}
      <SampleControl sample={sample} />
    </>
  );
}

function City({ city, year, pillar, sample, onSelect }) {
  const a = city.assurance;
  return (
    <>
      <button type="button" className="linkish abrief-back" onClick={() => onSelect(null)}>
        ← All host cities
      </button>
      <span className="eyebrow">
        Host city{pillar ? ` · ${pillar}` : ""}
      </span>
      <h2>{city.name}</h2>
      <div className="abrief-top">
        <AssuranceRing a={a} tone={city.tone} />
        <div>
          <p className="abrief-lead">
            {city.stadiums.length} {city.stadiums.length === 1 ? "stadium" : "stadiums"}
            {city.dueCount < city.stadiums.length ? ` (${city.dueCount} due by ${year})` : ""} ·{" "}
            {city.roomKeys.toLocaleString("en-US")} room keys planned
          </p>
          <Coverage a={a} />
        </div>
      </div>
      <Counts a={a} />
      {a.needsAttention > 0 && (
        <Link className="abrief-cta" href={queueHref({ cityId: city.id, pillar, year })}>
          <b>Review {a.needsAttention} in {city.name} →</b>
          <span>
            {a["evidence-submitted"]} awaiting review · {a["non-compliant"]} non-compliant
          </span>
        </Link>
      )}
      <ul className="abrief-list">
        {city.stadiums.map((s) => {
          return (
            <li key={s.id} className={s.due ? undefined : "notdue"}>
              <Link href={`/facilities/${s.id}`}>
                <i className={s.tone} />
                <span>
                  <b>{s.name}</b>
                  <small>
                    {s.due ? "" : `Due ${s.completionYear} · `}
                    {pct(s.assurance.assured)}% assured · {pct(s.assurance.coverage)}% assessed
                    {s.assurance.needsAttention ? ` · ${s.assurance.needsAttention} need attention` : ""}
                    {s.location.accuracy === "approximate" ? " · approximate location" : ""}
                  </small>
                </span>
                <em>→</em>
              </Link>
            </li>
          );
        })}
      </ul>
      <SampleControl sample={sample} />
    </>
  );
}

/** The briefing card over the map: programme or the selected city. */
export default function AssuranceBriefing({ map, selected, pillar, sample, onSelect }) {
  const city = map.cities.find((c) => c.id === selected);
  return (
    <aside className="abrief" aria-live="polite">
      {city ? (
        <City city={city} year={map.year} pillar={pillar} sample={sample} onSelect={onSelect} />
      ) : (
        <Programme map={map} pillar={pillar} sample={sample} onSelect={onSelect} />
      )}
    </aside>
  );
}
