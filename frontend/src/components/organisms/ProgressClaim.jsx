"use client";

import Link from "next/link";
import { useEffect } from "react";
import StatusPill from "@/components/atoms/StatusPill";
import { CHECK_STATUS, ensureIntake, intake } from "@/lib/store/intake";

/** A stadium's latest progress check, linking to the full finding on the Evidence page. Hidden when there is none. */
export default function ProgressClaim({ stadiumId }) {
  useEffect(ensureIntake, []);
  const check = intake.checks[stadiumId];
  if (!check) return null;
  const s = CHECK_STATUS[check.status];
  return (
    <div className="block progress-claim">
      <div>
        <span className="eyebrow">Progress claim · as at {check.as_of}</span>
        <p className="m0">
          Reported <b>{check.claimed}%</b> · recalculated from the plans <b>{check.recalculated}%</b> · planned by now{" "}
          {check.planned}%
        </p>
      </div>
      <StatusPill tone={s.tone}>{s.label}</StatusPill>
      {check.stale && <StatusPill tone="warn">New evidence since last check</StatusPill>}
      {check.decision && <span className="muted small">Finding {check.decision}</span>}
      <Link className="btnlink" href={`/evidence?tab=onfile&stadium=${encodeURIComponent(stadiumId)}`}>
        View finding →
      </Link>
    </div>
  );
}
