"use client";

import Link from "next/link";
import StatusPill from "@/components/atoms/StatusPill";
import { CHECK_STATUS, decideCheck } from "@/lib/store/intake";

/** Progress claims the verification agent flagged, each waiting for a reviewer to accept or reject the finding. */
export default function ProgressClaimList({ claims }) {
  if (!claims.length) return null;
  return (
    <>
      <h3 className="rq-heading">Progress claims not supported by evidence</h3>
      <ol className="rq-list">
        {claims.map((c) => (
          <li key={c.stadium_id} className="rq-item">
            <div className="rq-where">
              <Link href={`/facilities/${c.stadium_id}`}>
                <b>{c.stadium_name}</b>
              </Link>
              <span className="muted small">
                {c.city} · report as at {c.as_of}
              </span>
            </div>
            <div className="rq-what">
              <div>
                <b>
                  Reported {c.claimed}%, recalculated {c.recalculated}% from the detailed plans
                </b>
              </div>
              <div className="muted small">{c.summary}</div>
              <div>
                <StatusPill tone={CHECK_STATUS[c.status].tone}>{CHECK_STATUS[c.status].label}</StatusPill>{" "}
                <Link className="small" href={`/project-progress?stadium=${encodeURIComponent(c.stadium_id)}#finding`}>
                  View finding →
                </Link>
              </div>
            </div>
            <div className="rq-act">
              <button type="button" className="primary" onClick={() => decideCheck(c.stadium_id, "accepted")}>
                Accept finding
              </button>
              <button type="button" className="ghost" onClick={() => decideCheck(c.stadium_id, "rejected")}>
                Reject finding
              </button>
            </div>
          </li>
        ))}
      </ol>
      <h3 className="rq-heading">Requirement evidence</h3>
    </>
  );
}
