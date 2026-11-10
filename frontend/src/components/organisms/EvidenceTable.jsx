"use client";

import StatusPill from "@/components/atoms/StatusPill";
import { MAT, fmtD, showVal } from "@/lib/domain/data";
import { openDrawer } from "@/legacy/views/drawer";

const RESULT = {
  pass: ["good", "Pass"],
  fail: ["bad", "Fail"],
};

/** Evidence items, newest first. rows: [{ o: obligation, x: evidence }]. */
export default function EvidenceTable({ rows }) {
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Document</th>
            <th>Obligation</th>
            <th>Issued by</th>
            <th>Date</th>
            <th>Stage</th>
            <th>Value</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ o, x }, k) => {
            const [tone, label] = RESULT[x.result] || ["warn", "Pending"];
            return (
              <tr key={`${o.id}-${k}`}>
                <td>{x.file}</td>
                <td className="mono">
                  <button type="button" className="linkish" onClick={() => openDrawer(o.id)}>
                    {o.code}
                  </button>
                </td>
                <td>{x.issuer}</td>
                <td className="mono">{fmtD(x.date)}</td>
                <td>{MAT[x.maturity == null ? 1 : x.maturity]}</td>
                <td className="mono">{showVal(o, x.value)}</td>
                <td>
                  <StatusPill tone={tone}>{label}</StatusPill>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
