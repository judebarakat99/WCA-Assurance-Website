"use client";

import { useRef, useState } from "react";
import StatusPill from "@/components/atoms/StatusPill";
import { costTone } from "@/lib/domain/delivery.mjs";

const m = (v) => `SAR ${Math.round(v).toLocaleString()}m`;
const signed = (v) => (v > 0 ? `+${m(v)}` : v < 0 ? `−${m(-v)}` : "on budget");

function Tip({ r }) {
  return (
    <>
      <b>{r.name}</b>
      <br />
      Budget {m(r.budget)} · spent {m(r.spent)}
      <br />
      Value of work done {m(r.earnedValue)} ({r.actual}% of the budget)
      <br />
      {r.cpi != null ? (
        <>
          Cost performance {r.cpi.toFixed(2)}: each SAR 1 spent delivered SAR {r.cpi.toFixed(2)} of work.
          <br />
          Forecast at completion {m(r.eac)} ({signed(r.overrun)})
        </>
      ) : (
        "Too early to forecast cost."
      )}
    </>
  );
}

/**
 * Cost indicator per stadium: budget, spend, value of work done and the
 * forecast cost at completion (budget ÷ cost performance index).
 */
export default function CostPerformance({ rows }) {
  const wrap = useRef(null);
  const [tip, setTip] = useState(null);
  const shown = rows.filter((r) => r.spent > 0).sort((a, b) => b.overrun - a.overrun || b.budget - a.budget);
  const max = Math.max(...shown.map((r) => Math.max(r.budget, r.eac)));
  const pc = (v) => `${(100 * v) / max}%`;
  function move(e, r) {
    const box = wrap.current.getBoundingClientRect();
    setTip({
      r,
      left: Math.max(0, Math.min(e.clientX - box.left + 14, box.width - 300)),
      top: e.clientY - box.top + 14,
    });
  }
  return (
    <div className="cp" ref={wrap} onMouseLeave={() => setTip(null)}>
      <ul className="cp-rows">
        {shown.map((r) => {
          const tone = costTone(r.cpi);
          return (
            <li key={r.id} onMouseMove={(e) => move(e, r)}>
              <span className="cp-name">
                <b>{r.name}</b>
                <small>
                  {m(r.spent)} spent of {m(r.budget)}
                </small>
              </span>
              <span className="cp-bar" aria-hidden="true">
                <i className="cp-budget" style={{ width: pc(r.budget) }} />
                <i className="cp-spent" style={{ width: pc(r.spent) }} />
                <i className="cp-ev" style={{ left: pc(r.earnedValue) }} />
                {r.cpi != null && <i className={`cp-eac ${tone}`} style={{ left: pc(r.eac) }} />}
              </span>
              <span className="cp-figs">
                {r.cpi != null ? (
                  <>
                    <StatusPill tone={tone}>CPI {r.cpi.toFixed(2)}</StatusPill>
                    <small>{signed(r.overrun)} at completion</small>
                  </>
                ) : (
                  <small className="muted">Too early</small>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="fc-legend">
        <span>
          <i className="cp-key budget" /> Budget
        </span>
        <span>
          <i className="cp-key spent" /> Spent to date
        </span>
        <span>
          <i className="cp-key ev" /> Value of work done
        </span>
        <span>
          <i className="cp-key eac" /> Forecast cost at completion
        </span>
        <span>
          <StatusPill tone="good">CPI ≥ 0.98</StatusPill>
          <StatusPill tone="warn">0.90–0.97</StatusPill>
          <StatusPill tone="bad">Below 0.90</StatusPill>
        </span>
      </div>
      {tip && (
        <div className="fc-tip" style={{ left: tip.left, top: tip.top }}>
          <Tip r={tip.r} />
        </div>
      )}
    </div>
  );
}
