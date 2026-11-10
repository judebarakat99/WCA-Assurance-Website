"use client";

import { useRef, useState } from "react";
import StatusPill from "@/components/atoms/StatusPill";
import { MONTHS, fmtD, pct, sn } from "@/lib/domain/data";
import { toneOf } from "@/lib/ui/tones";

const W = 1100;
const LEFT = 260;
const RIGHT = 24;
const TOP = 34;
const ROW = 46;
const TIP_W = 290;

// Monthly ticks (quarterly, or half-yearly for long spans) between today and the end.
function monthTicks(today, end) {
  const ticks = [];
  const s = new Date(`${today}T00:00:00Z`);
  s.setUTCDate(1);
  const step = (end - Date.parse(today)) / 864e5 > 900 ? 6 : 3;
  s.setUTCMonth(Math.ceil((s.getUTCMonth() + 1) / step) * step);
  while (s.getTime() < end) {
    ticks.push(s.toISOString().slice(0, 10));
    s.setUTCMonth(s.getUTCMonth() + step);
  }
  return ticks;
}

function Tip({ x, recovery }) {
  return (
    <>
      <b>{sn(x.id)}</b>
      <br />
      {x.gate.id} {x.gate.name}: FIFA milestone {fmtD(x.gateDate)}
      <br />
      PMC deterministic finish {fmtD(x.pmc.finish)}
      <br />
      Evidence-based P50 {fmtD(x.d50)} · P60 {fmtD(x.d60)} · P80 {fmtD(x.d80)}
      <br />
      Chance of meeting the milestone: {pct(x.prob)}%
      {recovery.includes(x.id) && (
        <>
          <br />
          Recovery team deployed
        </>
      )}
    </>
  );
}

function Legend() {
  return (
    <div className="fc-legend">
      <span>
        <svg width="22" height="12" aria-hidden="true">
          <circle cx="5" cy="6" r="4.5" style={{ fill: "var(--ink)" }} />
          <rect x="5" y="2" width="16" height="8" rx="3" style={{ fill: "var(--warn-soft)", stroke: "var(--warn)" }} />
        </svg>
        P50 to P80 from evidence
      </span>
      <span>
        <svg width="6" height="14" aria-hidden="true">
          <line x1="3" x2="3" y1="0" y2="14" style={{ stroke: "var(--ink)", strokeWidth: 2 }} />
        </svg>
        P60
      </span>
      <span>
        <svg width="12" height="12" aria-hidden="true">
          <circle cx="6" cy="6" r="4.5" style={{ fill: "var(--surface)", stroke: "var(--muted)", strokeWidth: 2 }} />
        </svg>
        PMC schedule finish
      </span>
      <span>
        <svg width="10" height="14" aria-hidden="true">
          <path d="M5 0 l4 4 l-4 4 l-4 -4 z" style={{ fill: "var(--ink)" }} />
          <line x1="5" x2="5" y1="8" y2="14" style={{ stroke: "var(--ink)", strokeDasharray: "2 2" }} />
        </svg>
        FIFA milestone
      </span>
      <span>
        <StatusPill tone="good">On track at P80</StatusPill>
        <StatusPill tone="warn">At risk at P80</StatusPill>
        <StatusPill tone="bad">Late at P50</StatusPill>
      </span>
    </div>
  );
}

/** Gate forecast per venue: the P50–P80 band against the FIFA milestone and the PMC finish. */
export default function ForecastChart({ forecasts: f, today, recovery }) {
  const wrap = useRef(null);
  const [tip, setTip] = useState(null);
  const H = TOP + f.length * ROW + 12;
  const t0 = Date.parse(today);
  const end = Math.max(t0, ...f.flatMap((x) => [x.d80, x.gateDate, x.pmc.finish].map(Date.parse))) + 45 * 864e5;
  const X = (d) => LEFT + ((Date.parse(d) - t0) / (end - t0)) * (W - LEFT - RIGHT);
  const ticks = monthTicks(today, end);

  function move(e, x) {
    const box = wrap.current.getBoundingClientRect();
    setTip({
      x,
      left: Math.max(0, Math.min(e.clientX - box.left + 14, box.width - TIP_W)),
      top: e.clientY - box.top + 14,
    });
  }

  return (
    <>
      <div className="fc-wrap" ref={wrap} onMouseLeave={() => setTip(null)}>
        <svg
          className="fc-chart"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Gate forecast per venue: P50 to P80 range against FIFA milestone and PMC finish"
        >
          <g className="grid">
            {ticks.map((d) => (
              <line key={d} x1={X(d)} x2={X(d)} y1={TOP - 8} y2={H - 6} />
            ))}
          </g>
          {ticks.map((d) => (
            <text key={d} className="mut" x={X(d)} y={TOP - 14} textAnchor="middle">
              {MONTHS[Number(d.slice(5, 7)) - 1]} {d.slice(2, 4)}
            </text>
          ))}
          <g className="today">
            <line x1={LEFT} x2={LEFT} y1={TOP - 8} y2={H - 6} />
          </g>
          <text className="mut" x={LEFT + 4} y={H - 1}>
            Today
          </text>
          {f.map((x, i) => {
            const y = TOP + i * ROW + ROW / 2;
            const gx = X(x.gateDate);
            return (
              <g key={x.id}>
                <rect
                  className="hit"
                  x="0"
                  y={y - ROW / 2}
                  width={W}
                  height={ROW}
                  onMouseMove={(e) => move(e, x)}
                />
                <text x="0" y={y - 3} style={{ fontWeight: 600 }}>
                  {sn(x.id)}
                </text>
                <text className="mut" x="0" y={y + 12}>
                  {x.gate.id} {x.gate.name} · {pct(x.prob)}% on time
                </text>
                <line className="gate" x1={gx} x2={gx} y1={y - 14} y2={y + 14} pointerEvents="none" />
                <path className="gated" d={`M${gx} ${y - 19} l4 4 l-4 4 l-4 -4 z`} pointerEvents="none" />
                <rect
                  className={`band ${toneOf(x.cls)}`}
                  x={X(x.d50)}
                  y={y - 6}
                  width={Math.max(3, X(x.d80) - X(x.d50))}
                  height="12"
                  rx="4"
                  pointerEvents="none"
                />
                <line className="p60" x1={X(x.d60)} x2={X(x.d60)} y1={y - 8} y2={y + 8} pointerEvents="none" />
                <circle className="p50" cx={X(x.d50)} cy={y} r="5" pointerEvents="none" />
                <circle className="pmc" cx={X(x.pmc.finish)} cy={y} r="5" pointerEvents="none" />
                {x.p80 === 0 && (
                  <text className="mut" x={X(x.d50) + 8} y={y + 19} pointerEvents="none">
                    Gate rules met today
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {tip && (
          <div className="fc-tip" style={{ left: tip.left, top: tip.top }}>
            <Tip x={tip.x} recovery={recovery} />
          </div>
        )}
      </div>
      <Legend />
    </>
  );
}
