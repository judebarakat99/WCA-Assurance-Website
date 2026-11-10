"use client";

import { fmtD } from "@/lib/domain/data";
import { openDrawer } from "@/lib/drawer";

// Colour an audit entry by what happened.
export function auditTone(action) {
  if (/rejected|refused|no longer|escalat/i.test(action)) return "bad";
  if (/Verified|validated|passed/i.test(action)) return "good";
  return "mid";
}

/** Audit entries as a vertical timeline; obligation ids open the drawer. */
export default function AuditTimeline({ entries, empty = "No activity recorded yet." }) {
  if (!entries.length) return <span className="muted">{empty}</span>;
  return (
    <div className="tl">
      {entries.map((a, k) => (
        <div key={k} className={`tli ${auditTone(a.action)}`}>
          <i />
          <div>
            <span className="mono muted">{fmtD(a.t)}</span>
            <div>
              <b>{a.actor}</b> {a.action}
              {a.obl && (
                <>
                  {" · "}
                  <button type="button" className="linkish" onClick={() => openDrawer(a.obl)}>
                    {a.obl}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
