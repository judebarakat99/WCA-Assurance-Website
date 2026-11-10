"use client";

import Link from "next/link";
import StatusPill from "@/components/atoms/StatusPill";
import { toast } from "@/lib/domain/actions";
import { pct } from "@/lib/domain/data";
import { criterionLabel } from "@/lib/domain/fifa-catalogue.mjs";
import { CHANGE_NOTE, CHANGE_SCENARIOS, currentRequirement } from "@/lib/domain/requirementVersions.mjs";
import { applyRequirementChange, getAppliedChanges } from "@/lib/store/assessments";
import { updateMap } from "@/lib/store/state";

const close = () => updateMap({ change: null });

function Picker() {
  const applied = new Set(getAppliedChanges().map((c) => c.changeId));
  return (
    <>
      <button type="button" className="linkish abrief-back" onClick={close}>
        ← Back to the briefing
      </button>
      <span className="eyebrow">Change impact</span>
      <h2>What if FIFA changes a requirement?</h2>
      <p className="abrief-lead">
        Pick a change to see, before anything is applied, which stadiums it hits and what it reopens.
      </p>
      <p className="muted fine m0">
        <StatusPill tone="warn">Hypothetical</StatusPill> {CHANGE_NOTE}
      </p>
      <ul className="abrief-list">
        {CHANGE_SCENARIOS.map((s) => {
          const req = currentRequirement(s.requirementId);
          const done = applied.has(s.id);
          return (
            <li key={s.id}>
              <button type="button" disabled={done} onClick={() => updateMap({ change: s.id })}>
                <i className={done ? "good" : "mute"} />
                <span>
                  <b>{s.title}</b>
                  <small>
                    {req.id} · {req.category} · {done ? `applied (version ${req.version})` : s.summary}
                  </small>
                </span>
                <em>{done ? "✓" : "→"}</em>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Preview({ view, onSelect }) {
  const { scenario, before, after, counts, inArea, programme } = view.impact;
  function apply() {
    const done = applyRequirementChange(scenario.id);
    updateMap({ change: null });
    if (done)
      toast(
        `${before.id} is now version ${done.after.version}. ${done.counts.reopened} compliant ${done.counts.reopened === 1 ? "item" : "items"} reopened for review.`,
      );
  }
  return (
    <>
      <button type="button" className="linkish abrief-back" onClick={() => updateMap({ change: "pick" })}>
        ← Other changes
      </button>
      <span className="eyebrow">
        Change impact · preview <StatusPill tone="warn">Hypothetical</StatusPill>
      </span>
      <h2>{scenario.title}</h2>
      <p className="abrief-lead">{scenario.summary}</p>
      <div className="cimp-crit">
        <span className="mono">{before.id}</span>
        <span>
          v{before.version} <b className="mono">{criterionLabel(before.criterion)}</b>
        </span>
        <span aria-hidden="true">→</span>
        <span>
          v{after.version} <b className="mono">{criterionLabel(after.criterion)}</b>
        </span>
      </div>
      {!inArea ? (
        <p className="small m0">
          This change is to a {before.category.toLowerCase()} requirement; the map is showing another area.{" "}
          <button type="button" className="linkish" onClick={() => updateMap({ pillar: null })}>
            Show all areas
          </button>
        </p>
      ) : (
        <>
          <div className="abrief-counts">
            <StatusPill tone="bad">{programme.reopened} compliant would reopen</StatusPill>
            <StatusPill tone="warn">{programme.flipped} in review would now fail</StatusPill>
            <StatusPill tone="good">{counts.carried} still compliant</StatusPill>
            <StatusPill tone="mute">{counts.unassessed} not assessed yet</StatusPill>
          </div>
          <p className="small m0">
            Assured across the programme: <b>{pct(programme.assuredBefore)}%</b> →{" "}
            <b>{pct(programme.assuredAfter)}%</b>
            {view.due < view.stadiumCount ? ` (stadiums due by ${view.year})` : ""}.
          </p>
          <ul className="abrief-list">
            {view.cities
              .filter((c) => c.impact.stadiums)
              .sort((a, b) => b.impact.reopened - a.impact.reopened)
              .map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => onSelect(c.id)}>
                    <i className={c.tone} />
                    <span>
                      <b>{c.name}</b>
                      <small>
                        {c.impact.reopened} reopen · {c.impact.flipped} now fail in review · assured{" "}
                        {pct(c.impact.assuredBefore)}% → {pct(c.impact.assuredAfter)}%
                      </small>
                    </span>
                    <em>→</em>
                  </button>
                </li>
              ))}
          </ul>
        </>
      )}
      <div className="flex cimp-actions">
        <button type="button" className="primary" onClick={apply}>
          Apply change
        </button>
        <button type="button" onClick={close}>
          Cancel
        </button>
      </div>
      <p className="muted fine m0">
        Applying moves {before.id} to version {after.version} and re-checks each stadium&apos;s evidence against the new
        criterion. Anything compliant that no longer passes goes back to the review queue.
      </p>
    </>
  );
}

/** Briefing card while a requirement change is being chosen or previewed. */
export default function ChangeImpactPanel({ view, onSelect }) {
  return (
    <aside className="abrief" aria-live="polite">
      {view.impact ? <Preview view={view} onSelect={onSelect} /> : <Picker />}
    </aside>
  );
}

/** Link to the queue's reopened items, shown after a change is applied. */
export function ReopenedLink({ count }) {
  if (!count) return null;
  return (
    <Link className="abrief-cta" href="/review?status=reopened">
      <b>{count} reopened by a requirement change →</b>
      <span>Open them in the review queue</span>
    </Link>
  );
}
