"use client";

import CritBadge from "@/components/atoms/CritBadge";
import GateChip from "@/components/atoms/GateChip";
import StatusPill from "@/components/atoms/StatusPill";
import { fmtN, venueMeta } from "@/lib/domain/data";
import { depBlocked, isProven } from "@/lib/domain/scoring";
import { STATE_TONE } from "@/lib/ui/tones";
import { openDrawer } from "@/legacy/views/drawer";

const OP = { min: "≥ ", max: "≤ ", eq: "= " };
const criterion = (o) => (o.op === "bool" ? "yes" : `${OP[o.op]}${fmtN(o.value)} ${o.unit}`);

function Row({ o }) {
  const blockedBy = depBlocked(o);
  const open = () => openDrawer(o.id);
  return (
    <tr
      className="click"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter") open();
      }}
    >
      <td className="mono">{o.id}</td>
      <td>
        {o.text}
        <div className="muted fine">
          {venueMeta(o.venue).name} · {o.clause}
        </div>
        {blockedBy && <div className="fine t-warn">Blocked by {blockedBy.id}</div>}
      </td>
      <td className="mono">{criterion(o)}</td>
      <td>
        <CritBadge level={o.crit} />
      </td>
      <td>{o.owner}</td>
      <td>
        <GateChip gate={o.gate} />
      </td>
      <td>
        <StatusPill tone={STATE_TONE[o.state]}>{o.state}</StatusPill>
        {o.claim && !isProven(o) && <div className="muted fine">Owner says done</div>}
      </td>
    </tr>
  );
}

/** Obligations as a table; a row opens the obligation drawer. */
export default function ObligationTable({ obligations, emptyText = "No obligations match these filters." }) {
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Obligation</th>
            <th>Criterion (illustrative)</th>
            <th>Criticality</th>
            <th>Owner</th>
            <th>Gate</th>
            <th>State</th>
          </tr>
        </thead>
        <tbody>
          {obligations.length ? (
            obligations.map((o) => <Row key={o.id} o={o} />)
          ) : (
            <tr>
              <td colSpan={7} className="muted">
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
