"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import StatusPill from "@/components/atoms/StatusPill";
import { STATUS } from "@/lib/domain/delivery.mjs";
import { CHECK_STATUS } from "@/lib/store/intake";

const W = 1100;
const LEFT = 270;
const RIGHT = 24;
const TOP = 40;
const ROW = 46;
const SUB = 30;
const TIP_W = 300;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const fmtD = (iso) =>
  iso ? `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : "–";
const fmtM = (iso) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const ms = (iso) => Date.parse(`${iso}T00:00:00Z`);
const days = (n) => `${Math.abs(n)} day${Math.abs(n) === 1 ? "" : "s"}`;

/** "+57 days" / "On plan" for a row's slip against its plan. */
export function slipLabel(r) {
  if (r.slip == null) return STATUS[r.status].label;
  if (r.slip > 0) return `${days(r.slip)} behind`;
  if (r.slip < 0) return `${days(r.slip)} ahead`;
  return "On plan";
}

function Tip({ r, pkg }) {
  if (pkg)
    return (
      <>
        <b>
          {r.name} · {pkg.name}
        </b>
        <br />
        Plan {fmtD(pkg.start)} → {fmtD(pkg.finish)}
        <br />
        Recalculated {pkg.actual}% · planned by now {pkg.planned}% · reported {pkg.claimed ?? "–"}%
        <br />
        {CHECK_STATUS[pkg.status]?.label}
      </>
    );
  return (
    <>
      <b>{r.name}</b>
      <br />
      {r.phase} · {STATUS[r.status].label}
      <br />
      Planned {fmtD(r.start)} → {fmtD(r.finish)}
      {r.forecast !== r.finish && (
        <>
          <br />
          Forecast finish {fmtD(r.forecast)} ({days(r.late)} late)
        </>
      )}
      <br />
      Progress {r.actual}% against {r.planned}% planned{" "}
      {r.verified ? "(recalculated from the plans)" : `(reported by the contractor)`}
      {r.verified && r.reported !== r.actual && (
        <>
          <br />
          The contractor reported {r.reported}%
        </>
      )}
      <br />
      Spent SAR {r.spent.toLocaleString()}m of {r.budget.toLocaleString()}m
      {r.cpi != null && ` · CPI ${r.cpi.toFixed(2)}`}
      {r.packages.length > 0 && (
        <>
          <br />
          <span className="muted">Click to show its scope elements.</span>
        </>
      )}
    </>
  );
}

export function Legend() {
  return (
    <div className="fc-legend">
      <span>
        <svg width="34" height="12" aria-hidden="true">
          <rect className="gn-track" x="1" y="2" width="32" height="8" rx="3" />
          <rect className="gn-done" x="1" y="2" width="18" height="8" rx="3" />
        </svg>
        Planned dates, filled to progress
      </span>
      <span>
        <svg width="6" height="14" aria-hidden="true">
          <line className="gn-plan" x1="3" x2="3" y1="0" y2="14" />
        </svg>
        Planned progress by now
      </span>
      <span>
        <svg width="12" height="12" aria-hidden="true">
          <path className="gn-handover" d="M6 1 l5 5 l-5 5 l-5 -5 z" />
        </svg>
        Planned handover
      </span>
      <span>
        <svg width="34" height="12" aria-hidden="true">
          <rect className="gn-slip warn" x="1" y="2" width="22" height="8" rx="3" />
          <circle className="gn-fc warn" cx="26" cy="6" r="4.5" />
        </svg>
        Forecast finish
      </span>
      <span>
        <svg width="10" height="14" aria-hidden="true">
          <line className="gn-milestone" x1="5" x2="5" y1="0" y2="14" />
        </svg>
        FIFA milestone
      </span>
      <span>
        <i className="gn-verified" aria-hidden="true">
          ✓
        </i>
        Checked on the Evidence page
      </span>
      <span>
        <StatusPill tone="good">On track</StatusPill>
        <StatusPill tone="warn">At risk</StatusPill>
        <StatusPill tone="bad">Late</StatusPill>
        <StatusPill tone="mute">Not started</StatusPill>
      </span>
    </div>
  );
}

export function GanttTable({ rows }) {
  return (
    <details className="fc-table">
      <summary>Show as table</summary>
      <div className="tablewrap mt-sm">
        <table>
          <thead>
            <tr>
              <th>Stadium</th>
              <th>Phase</th>
              <th>Start</th>
              <th>Planned handover</th>
              <th>Forecast finish</th>
              <th>Schedule</th>
              <th className="num">Progress</th>
              <th className="num">Planned</th>
              <th>Source</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/facilities/${r.id}`}>{r.name}</Link>
                </td>
                <td>{r.phase}</td>
                <td className="mono">{fmtD(r.start)}</td>
                <td className="mono">{fmtD(r.finish)}</td>
                <td className="mono">{fmtD(r.forecast)}</td>
                <td>{slipLabel(r)}</td>
                <td className="num">{r.actual}%</td>
                <td className="num">{r.planned}%</td>
                <td>
                  {r.verified ? (
                    <Link href={`/evidence?tab=onfile&stadium=${encodeURIComponent(r.id)}`}>Recalculated</Link>
                  ) : (
                    "Reported"
                  )}
                </td>
                <td>
                  <StatusPill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</StatusPill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/**
 * Delivery Gantt: one bar per stadium from start to planned handover, filled to
 * its progress, with the forecast finish, the data date and FIFA milestones.
 * Stadiums with a checked progress report expand into their scope elements.
 */
export default function ProgressGantt({ rows, asOf, milestones }) {
  const wrap = useRef(null);
  const [tip, setTip] = useState(null);
  const [open, setOpen] = useState({});
  const lines = rows.flatMap((r) => [{ r }, ...(open[r.id] ? r.packages.map((pkg) => ({ r, pkg })) : [])]);
  const placed = lines.reduce((list, l) => {
    const top = list.length ? list[list.length - 1].top + list[list.length - 1].h : TOP;
    const h = l.pkg ? SUB : ROW;
    return [...list, { ...l, y: top + h / 2, h, top }];
  }, []);
  const H = (placed.length ? placed[placed.length - 1].top + placed[placed.length - 1].h : TOP) + 22;
  const dates = rows
    .flatMap((r) => [r.start, r.finish, r.forecast])
    .concat(
      milestones.map((m) => m.date),
      asOf,
    );
  const y0 = new Date(Math.min(...dates.map(ms))).getUTCFullYear();
  const y1 = new Date(Math.max(...dates.map(ms))).getUTCFullYear() + 1;
  const t0 = Date.UTC(y0, 0, 1);
  const t1 = Date.UTC(y1, 0, 1);
  const X = (iso) => LEFT + ((ms(iso) - t0) / (t1 - t0)) * (W - LEFT - RIGHT);
  const years = Array.from({ length: y1 - y0 + 1 }, (_, k) => y0 + k);
  const toggle = (r) => r.packages.length && setOpen((o) => ({ ...o, [r.id]: !o[r.id] }));

  function move(e, l) {
    const box = wrap.current.getBoundingClientRect();
    setTip({
      ...l,
      left: Math.max(0, Math.min(e.clientX - box.left + 14, box.width - TIP_W)),
      top: e.clientY - box.top + 14,
    });
  }

  return (
    <div className="fc-wrap" ref={wrap} onMouseLeave={() => setTip(null)}>
      <svg
        className="fc-chart gn"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Delivery schedule per stadium: planned dates filled to progress, with forecast finish and FIFA milestones"
      >
        <g className="grid">
          {years.map((yr) => (
            <line key={yr} x1={X(`${yr}-01-01`)} x2={X(`${yr}-01-01`)} y1={TOP - 8} y2={H - 20} />
          ))}
        </g>
        {years.slice(0, -1).map((yr) => (
          <text
            key={yr}
            className="mut"
            x={(X(`${yr}-01-01`) + X(`${yr + 1}-01-01`)) / 2}
            y={TOP - 14}
            textAnchor="middle"
          >
            {yr}
          </text>
        ))}
        {milestones.map((m) => (
          <g key={m.id} pointerEvents="none">
            <line className="gn-milestone" x1={X(m.date)} x2={X(m.date)} y1={TOP - 8} y2={H - 20} />
            <text className="mut" x={X(m.date) - 4} y={H - 6} textAnchor="end">
              {m.label} · {fmtM(m.date)}
            </text>
          </g>
        ))}
        <g pointerEvents="none">
          <line className="gn-today" x1={X(asOf)} x2={X(asOf)} y1={TOP - 8} y2={H - 20} />
          <text className="mut" x={X(asOf) + 4} y={H - 6}>
            Data date {fmtD(asOf)}
          </text>
        </g>
        {placed.map((l) => {
          const { r, pkg } = l;
          const tone = STATUS[r.status].tone;
          const key = pkg ? `${r.id}-${pkg.element}` : r.id;
          const hit = (
            <rect
              className="hit"
              x="0"
              y={l.top}
              width={W}
              height={l.h}
              onMouseMove={(e) => move(e, l)}
              onClick={() => !pkg && toggle(r)}
              style={{
                cursor: !pkg && r.packages.length ? "pointer" : "default",
              }}
            />
          );
          if (pkg) {
            const xs = X(pkg.start);
            const xf = X(pkg.finish);
            return (
              <g key={key}>
                {hit}
                <text className="mut" x="22" y={l.y + 4}>
                  {pkg.name}
                </text>
                <g pointerEvents="none">
                  <rect className="gn-track sub" x={xs} y={l.y - 4} width={xf - xs} height="8" rx="3" />
                  <rect
                    className="gn-done sub verified"
                    x={xs}
                    y={l.y - 4}
                    width={Math.max(2, ((xf - xs) * pkg.actual) / 100)}
                    height="8"
                    rx="3"
                  />
                  <line
                    className="gn-plan"
                    x1={xs + ((xf - xs) * pkg.planned) / 100}
                    x2={xs + ((xf - xs) * pkg.planned) / 100}
                    y1={l.y - 7}
                    y2={l.y + 7}
                  />
                </g>
              </g>
            );
          }
          const xs = X(r.start);
          const xf = X(r.finish);
          const xc = X(r.forecast);
          return (
            <g
              key={key}
              tabIndex={r.packages.length ? 0 : undefined}
              role={r.packages.length ? "button" : undefined}
              aria-expanded={r.packages.length ? !!open[r.id] : undefined}
              aria-label={r.packages.length ? `${r.name}: show scope elements` : undefined}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggle(r);
                }
              }}
            >
              {hit}
              <text x="0" y={l.y - 3} style={{ fontWeight: 600 }} pointerEvents="none">
                {r.packages.length ? (open[r.id] ? "▾ " : "▸ ") : ""}
                {r.name}
                {r.verified ? " ✓" : ""}
              </text>
              <text className="mut" x="0" y={l.y + 13} pointerEvents="none">
                {r.city} · {r.actual}% of {r.planned}% planned · {STATUS[r.status].label}
              </text>
              <g pointerEvents="none">
                {xc > xf && (
                  <rect className={`gn-slip ${tone}`} x={xf - 4} y={l.y - 6} width={xc - xf + 4} height="12" rx="4" />
                )}
                <rect className="gn-track" x={xs} y={l.y - 7} width={Math.max(3, xf - xs)} height="14" rx="4" />
                {r.actual > 0 && (
                  <rect
                    className={`gn-done ${r.verified ? "verified" : ""}`.trim()}
                    x={xs}
                    y={l.y - 7}
                    width={Math.max(3, ((xf - xs) * r.actual) / 100)}
                    height="14"
                    rx="4"
                  />
                )}
                {r.planned > 0 && r.planned < 100 && (
                  <line
                    className="gn-plan"
                    x1={xs + ((xf - xs) * r.planned) / 100}
                    x2={xs + ((xf - xs) * r.planned) / 100}
                    y1={l.y - 11}
                    y2={l.y + 11}
                  />
                )}
                <path className="gn-handover" d={`M${xf} ${l.y - 7} l7 7 l-7 7 l-7 -7 z`} />
                {xc > xf && <circle className={`gn-fc ${tone}`} cx={xc} cy={l.y} r="5" />}
              </g>
            </g>
          );
        })}
      </svg>
      {tip && (
        <div className="fc-tip" style={{ left: tip.left, top: tip.top, maxWidth: TIP_W }}>
          <Tip r={tip.r} pkg={tip.pkg} />
        </div>
      )}
    </div>
  );
}
