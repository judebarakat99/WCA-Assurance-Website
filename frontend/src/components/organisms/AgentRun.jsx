"use client";

import { intake } from "@/lib/store/intake";

/**
 * A progress check while it runs: the agent's steps appear one at a time,
 * the current one with a spinner. Before the first step arrives it shows
 * what the agent is working through.
 */
export default function AgentRun({ stadium }) {
  const run = intake.runs[stadium.id];
  if (!run) return null;
  const waiting = run.steps.length === 0;
  const total = run.steps.length;
  return (
    <section className="block pf agent-run" id="finding" aria-live="polite" aria-labelledby="agent-run-title">
      <div className="pf-head">
        <div>
          <span className="eyebrow">
            <i className="agent-pulse" aria-hidden="true" /> Agent working · {stadium.city}
          </span>
          <h3 id="agent-run-title">{stadium.name}</h3>
        </div>
        <span className="muted small">{waiting ? "Collecting documents" : `Step ${Math.min(run.shown + 1, total)} of ${total}`}</span>
      </div>
      <div className="agent-bar" aria-hidden="true">
        <i style={{ width: `${waiting ? 6 : Math.round((100 * run.shown) / total)}%` }} />
      </div>
      <ol className="pf-steps">
        {run.steps.slice(0, run.shown).map((s, k) => (
          <li key={k} className={s.ok ? "ok" : "flag"}>
            <b>{s.label}</b>
            <span>{s.detail}</span>
          </li>
        ))}
        {(waiting || run.shown < total) && (
          <li className="running">
            <b>{waiting ? "Reading the filed documents" : run.steps[run.shown].label}</b>
            <span className="muted">
              {waiting
                ? "Progress report and detailed plans, checking each figure against its page…"
                : "Working…"}
            </span>
          </li>
        )}
      </ol>
    </section>
  );
}
