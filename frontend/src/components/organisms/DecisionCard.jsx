"use client";

import Eyebrow from "@/components/atoms/Eyebrow";
import Meter from "@/components/atoms/Meter";
import StatusPill from "@/components/atoms/StatusPill";
import ForecastColumn from "@/components/molecules/ForecastColumn";
import { fmtD, pct, sn, dd, daysBetween } from "@/lib/domain/data";
import { decide, decRec } from "@/lib/domain/actions";
import { forecasts } from "@/lib/domain/forecast";
import { decisionOptionLabel, hasDecisionForecast } from "@/lib/domain/decision-records.mjs";
import { probTone, toneOf } from "@/lib/ui/tones";

const HINT = {
  recover: "Deploys a recovery team",
  rebase: "Re-baselines the milestone by 90 days",
};

function urgency(left) {
  return left < 21 ? "bad" : left < 90 ? "warn" : "good";
}

function Countdown({ open, left }) {
  if (!open)
    return (
      <div className="dday lg mute">
        <b>✓</b>
        <span>decided</span>
      </div>
    );
  return (
    <div className={`dday lg ${urgency(left)}`}>
      <b>{Math.abs(left)}</b>
      <span>{left < 0 ? "days over" : "days left"}</span>
    </div>
  );
}

function OpenForecast({ f }) {
  return (
    <div className="dvis">
      <div className="dv-l">
        <span>Chance of meeting the {fmtD(f.gateDate)} milestone</span>
        <b>{pct(f.prob)}%</b>
      </div>
      <Meter value={pct(f.prob)} tone={probTone(f.prob)} />
      <div className="flex">
        <StatusPill tone={toneOf(f.cls)}>P80 {fmtD(f.d80)}</StatusPill>
        <StatusPill tone={f.late80 > 0 ? "bad" : "good"}>
          {f.late80 > 0 ? `${dd(f.late80)} late` : "inside milestone"}
        </StatusPill>
      </div>
    </div>
  );
}

function DecidedForecast({ r }) {
  if (!hasDecisionForecast(r))
    return <p className="muted">Historical forecast comparison was not stored with this decision.</p>;
  return (
    <div className="vs">
      <ForecastColumn label="Before" prob={r.beforeProb} d80={r.before} late={r.beforeLate} />
      <div className="vs-ar" aria-hidden="true">
        →
      </div>
      <ForecastColumn label="After" prob={r.afterProb} d80={r.after} late={r.afterLate} highlight />
    </div>
  );
}

/** An executive decision with its last responsible moment, forecast impact and options. */
export default function DecisionCard({ decision: d, S }) {
  const r = decRec(d.id);
  const f = forecasts().find((y) => y.id === d.venue);
  const left = daysBetween(S.today, d.lrm);
  const open = r.status === "Open";
  const status = open
    ? left < 0
      ? `Last responsible moment passed ${dd(left)} ago`
      : `Decide by ${fmtD(d.lrm)}`
    : r.t
      ? `Decided ${fmtD(r.t)}`
      : "Decision recorded · date unavailable";
  const statusTone = open ? (left < 21 ? "bad" : left < 90 ? "warn" : "info") : "mute";
  const forecast = open ? f && <OpenForecast f={f} /> : <DecidedForecast r={r} />;
  return (
    <article className={`dec ${open ? "" : "isdone"}`.trim()} id={`dec-${d.id}`}>
      <div className="dec-top">
        <Countdown open={open} left={left} />
        <div className="dec-main">
          <div className="mono muted fine">
            {d.id} · {sn(d.venue)} · owner {d.owner}
          </div>
          <h3>{d.title}</h3>
          <p>{d.q}</p>
          <div className="flex">
            <StatusPill tone={statusTone}>{status}</StatusPill>
          </div>
        </div>
      </div>
      {forecast && <div className="dec-vis">{forecast}</div>}
      {open ? (
        <div className="opts">
          {d.options.map((o, i) => (
            <button
              key={o.t}
              type="button"
              className={`opt ${i === 0 ? "primary" : ""}`.trim()}
              onClick={() => decide(d.id, i)}
            >
              <b>{o.t}</b>
              {HINT[o.fx] && !/recover/i.test(o.t) && <small>{HINT[o.fx]}</small>}
            </button>
          ))}
        </div>
      ) : (
        <div className="done">
          <Eyebrow>Option taken</Eyebrow>
          <b>{decisionOptionLabel(d, r)}</b>
        </div>
      )}
    </article>
  );
}
