"use client";

import CritBadge from "@/components/atoms/CritBadge";
import Meter from "@/components/atoms/Meter";
import StatusPill from "@/components/atoms/StatusPill";
import { LEVELS, fmtD, dd, daysBetween, venueMeta } from "@/lib/domain/data";
import { escalateIssue } from "@/lib/domain/actions";
import { LEVEL_COLOR } from "@/lib/ui/tones";
import { openDrawer } from "@/lib/drawer";

/** A corrective action: SLA clock, escalation level, history and escalate button. */
export default function IssueCard({ issue: i, S }) {
  const o = S.obligations.find((x) => x.id === i.obl);
  const isOpen = i.status === "Open";
  const start = i.opened || i.history[0]?.t || S.today;
  const left = daysBetween(S.today, i.due);
  const span = Math.max(1, daysBetween(start, i.due));
  const elapsed = daysBetween(start, S.today);
  const progress = isOpen ? Math.max(2, Math.min(100, (elapsed / span) * 100)) : 100;
  const late = isOpen && left < 0;
  const tone = !isOpen ? "good" : late ? "bad" : progress > 70 ? "warn" : "good";
  const classes = ["issue", late && "late", !isOpen && "closed"].filter(Boolean).join(" ");
  return (
    <article className={classes}>
      <div className="is-top">
        <span className="mono muted">{i.id}</span>
        <CritBadge level={i.crit} />
        <span className="spacer" />
        {isOpen ? (
          <StatusPill tone={late ? "bad" : "mute"}>{late ? "Past SLA" : "Within SLA"}</StatusPill>
        ) : (
          <StatusPill tone="good">Closed by evidence</StatusPill>
        )}
      </div>
      <h3>{i.title}</h3>
      <div className="muted small">
        <button type="button" className="linkish" onClick={() => openDrawer(o.id)}>
          {o.id}
        </button>{" "}
        · {venueMeta(o.venue).name}
      </div>
      <div className="lvl">
        <div className="lvl-dots">
          {LEVELS.map((l, k) => (
            <i
              key={l}
              className={k <= i.level ? "on" : undefined}
              style={k <= i.level ? { background: LEVEL_COLOR[k] } : undefined}
              title={l}
            />
          ))}
        </div>
        <span>{LEVELS[i.level]}</span>
      </div>
      <div className="sla">
        <div className="sla-l">
          <span>{isOpen ? (late ? `${dd(left)} late` : `${dd(left)} left`) : `Closed ${fmtD(i.closed)}`}</span>
          <b>{isOpen ? `Due ${fmtD(i.due)}` : "SLA met"}</b>
        </div>
        <Meter value={progress} tone={tone} />
      </div>
      <details className="hist">
        <summary>
          History · {i.history.length} event{i.history.length === 1 ? "" : "s"}
        </summary>
        <div className="tl">
          {i.history.map((h, k) => (
            <div key={k} className="tli mid">
              <i />
              <div>
                <span className="mono muted">{fmtD(h.t)}</span>
                <div>{h.a}</div>
              </div>
            </div>
          ))}
        </div>
      </details>
      {isOpen && i.level < LEVELS.length - 1 && (
        <div className="flex">
          <button type="button" onClick={() => escalateIssue(i.id)}>
            Escalate to {LEVELS[i.level + 1]}
          </button>
        </div>
      )}
    </article>
  );
}
