"use client";

import AgentRun from "@/components/organisms/AgentRun";
import ProgressFinding from "@/components/organisms/ProgressFinding";
import StatusPill from "@/components/atoms/StatusPill";
import { CHECK_STATUS, checkableStadiums, intake, runCheck } from "@/lib/store/intake";

function CheckCard({ stadium, selected, onOpen }) {
  const check = intake.checks[stadium.id];
  const running = !!intake.running[stadium.id];
  const run = intake.runs[stadium.id];
  const error = intake.errors[stadium.id];
  const s = check && CHECK_STATUS[check.status];
  return (
    <div className={`block pc-card ${selected ? "sel" : ""} ${run ? "working" : ""}`.trim()}>
      <div className="pc-top">
        <b>{stadium.name}</b>
        {s && <StatusPill tone={s.tone}>{s.label}</StatusPill>}
      </div>
      <span className="muted small">{stadium.city}</span>
      {run ? (
        <div className="pc-working">
          <span className="small intake-working">
            {run.steps.length ? run.steps[Math.min(run.shown, run.steps.length - 1)].label : "Reading the filed documents"}…
          </span>
          <div className="agent-bar" aria-hidden="true">
            <i style={{ width: `${run.steps.length ? Math.round((100 * run.shown) / run.steps.length) : 6}%` }} />
          </div>
        </div>
      ) : check ? (
        <div className="pc-figs">
          <span>
            <b>{check.claimed}%</b> reported
          </span>
          <span>
            <b>{check.recalculated}%</b> recalculated
          </span>
        </div>
      ) : (
        <p className="muted small">Not checked yet.</p>
      )}
      {check?.stale && <StatusPill tone="warn">New evidence since last check</StatusPill>}
      {check?.decision && <span className="muted small">Finding {check.decision} by reviewer</span>}
      {error && (
        <p className="small" role="alert">
          {error}
        </p>
      )}
      <div className="pc-actions">
        {check && !run && (
          <button type="button" className="primary" onClick={() => onOpen(stadium.id)}>
            View finding
          </button>
        )}
        <button
          type="button"
          className={check ? "ghost" : "primary"}
          disabled={running}
          onClick={() => {
            onOpen(stadium.id);
            runCheck(stadium.id);
          }}
        >
          {running ? "Checking…" : check ? "Check again" : "Run check"}
        </button>
      </div>
    </div>
  );
}

/**
 * Verification of reported progress: the agent recalculates each stadium's progress from the contractor's detailed
 * plans and compares it with the progress report's claim. It starts by itself when a report or plan is confirmed.
 */
export default function ProgressChecks({ selected, onSelect }) {
  const stadiums = checkableStadiums();
  const check = selected && intake.checks[selected];
  const live = selected && intake.runs[selected] && stadiums.find((s) => s.id === selected);
  const open = (id) => {
    onSelect(id);
    setTimeout(() => document.getElementById("finding")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  return (
    <div>
      <div className="ev-intro">
        <span className="eyebrow">Verification agent</span>
        <h3>Reported progress against the plans</h3>
        <p className="m0">
          Contractors report how far each stadium has come. When a progress report and its detailed plans are on file, the
          agent recalculates progress from the plans, checks every figure against the page it came from and compares the
          result with the claim. It starts by itself when you confirm a report or a plan; you decide whether each finding
          stands. Evidence documents are checked against the FIFA requirements when you add them, under To confirm.
        </p>
      </div>
      {!stadiums.length && <p className="muted ev-empty">No progress report is on file. Confirm a progress report and its check appears here.</p>}
      <div className="pc-grid">
        {stadiums.map((s) => (
          <CheckCard key={s.id} stadium={s} selected={s.id === selected} onOpen={open} />
        ))}
      </div>
      {live ? <AgentRun stadium={live} /> : check && <ProgressFinding key={check.checked_at} check={check} />}
    </div>
  );
}
