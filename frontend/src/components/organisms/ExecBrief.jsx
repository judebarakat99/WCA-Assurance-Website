"use client";

import StatusPill from "@/components/atoms/StatusPill";
import { fmtD, pct, sn, dd, venueMeta } from "@/lib/domain/data";
import { executiveBrief } from "@/lib/domain/readiness";
import { goView } from "@/lib/store/state";
import { toneOf } from "@/lib/ui/tones";
import { aiAsk } from "@/legacy/views/ai";

const s = (n, one, many) => (n === 1 ? one : many);

function Priority({ worst, falseGreens, pmcConflict }) {
  const late = worst.late80 > 0;
  return (
    <div className="exec-priority">
      <div className="exec-priority-top">
        <span className="exec-priority-label">Priority attention</span>
        <StatusPill tone={toneOf(worst.cls)}>{worst.status}</StatusPill>
      </div>
      <div className="exec-priority-main">
        <div>
          <h3>{sn(worst.id)}</h3>
          <p>
            {venueMeta(worst.id)?.city || ""} · {worst.gate.id} {worst.gate.name} · milestone {fmtD(worst.gateDate)}
          </p>
        </div>
        <div className="exec-risk-metrics">
          <div>
            <strong>{pct(worst.prob)}%</strong>
            <span>on-time probability</span>
          </div>
          <div>
            <strong>{late ? `+${worst.late80}` : Math.abs(worst.late80)}</strong>
            <span>{late ? "days late at P80" : "days inside P80"}</span>
          </div>
          <div>
            <strong>{falseGreens}</strong>
            <span>false green{falseGreens === 1 ? "" : "s"}</span>
          </div>
        </div>
      </div>
      {pmcConflict && (
        <div className="exec-insight">
          <span>✦</span>
          <p>
            <strong>Assurance signal:</strong> the PMC schedule shows this milestone on time, but the evidence-based P80
            forecast shows it late. Leadership should resolve this discrepancy before relying on the reported
            programme status.
          </p>
        </div>
      )}
    </div>
  );
}

function LeadershipAction({ decision }) {
  if (!decision)
    return (
      <div className="exec-action">
        <span className="eyebrow">Leadership action</span>
        <div className="exec-ok">✓ No executive decision currently outstanding</div>
      </div>
    );
  return (
    <div className="exec-action">
      <span className="eyebrow">Leadership action</span>
      <strong className="exec-action-id">{decision.id}</strong>
      <h3>{decision.title}</h3>
      <p>
        Decide by <strong>{fmtD(decision.lrm)}</strong> ·{" "}
        {decision.left < 0 ? `${dd(decision.left)} overdue` : `${dd(decision.left)} remaining`}
      </p>
      <button type="button" className="primary" onClick={() => goView("actions")}>
        Review decision
      </button>
    </div>
  );
}

/** Nabd executive brief: the Readiness Room's hero panel. */
export default function ExecBrief() {
  const b = executiveBrief();
  return (
    <section className="exec-brief" id="aiExec">
      <div className="exec-brief-head">
        <div>
          <span className="exec-ai-label">✦ Nabd Executive Brief</span>
        </div>
      </div>
      <div className="exec-kpis">
        <div className="exec-kpi">
          <strong>{pct(b.sc.assured)}%</strong>
          <span>Assured readiness</span>
          <small>{pct(b.sc.declared)}% owner-declared</small>
        </div>
        <div className="exec-kpi">
          <strong>
            {b.onTrack}/{b.total}
          </strong>
          <span>Next gates on track</span>
          <small>at P80 confidence</small>
        </div>
        <div className={`exec-kpi ${b.criticalUnverified ? "risk" : ""}`.trim()}>
          <strong>{b.criticalUnverified}</strong>
          <span>Critical unverified</span>
          <small>awaiting second-line verification</small>
        </div>
        <div className={`exec-kpi ${b.decisions.length ? "warn" : ""}`.trim()}>
          <strong>{b.decisions.length}</strong>
          <span>Decisions open</span>
          <small>{b.nextDecision ? `next due ${fmtD(b.nextDecision.lrm)}` : "none outstanding"}</small>
        </div>
      </div>
      {b.worst && <Priority worst={b.worst} falseGreens={b.falseGreens} pmcConflict={b.pmcConflict} />}
      <div className="exec-bottom">
        <div className="exec-watch">
          <span className="eyebrow">Programme watchlist</span>
          <ul>
            <li>
              <strong>{b.unprovenClaims}</strong> owner-declared {s(b.unprovenClaims, "item", "items")} not yet proven
              by evidence
            </li>
            <li>
              <strong>{b.criticalUnverified}</strong> Critical {s(b.criticalUnverified, "obligation", "obligations")}{" "}
              remain unverified
            </li>
            <li>
              <strong>{b.openIssues}</strong> corrective {s(b.openIssues, "action", "actions")} remain open
            </li>
            {b.overdueIssues > 0 && (
              <li className="exec-danger">
                <strong>{b.overdueIssues}</strong> {s(b.overdueIssues, "action is", "actions are")} past SLA
              </li>
            )}
          </ul>
        </div>
        <LeadershipAction decision={b.nextDecision} />
      </div>
      <div className="exec-footer">
        <button type="button" className="exec-ai-question" onClick={() => aiAsk("Which venue is highest risk, and why?")}>
          ✦ Ask Nabd why
        </button>
        <button type="button" className="linkish" onClick={() => goView("tower")}>
          View Control Tower →
        </button>
      </div>
    </section>
  );
}
