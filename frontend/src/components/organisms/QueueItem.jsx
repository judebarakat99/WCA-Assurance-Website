"use client";

import Link from "next/link";
import StatusPill from "@/components/atoms/StatusPill";
import { criterionLabel } from "@/lib/domain/fifa-catalogue.mjs";
import { QUEUE_REASON } from "@/lib/domain/reviewQueue.mjs";
import { reviewAssessment } from "@/lib/store/assessments";
import { toast } from "@/lib/ui/toast";

const REASON_TONE = {
  fail: "bad",
  "needs-review": "warn",
  pass: "good",
  "non-compliant": "bad",
  "partially-compliant": "warn",
};

function decide(item, outcome) {
  reviewAssessment(item.stadium.id, item.requirement, outcome);
  toast(`${item.stadium.name}, ${item.requirement.id}: ${outcome === "compliant" ? "compliant" : "non-compliant"}.`);
}

/** One requirement in the review queue: where, what, the latest evidence and the next action. */
export default function QueueItem({ item }) {
  const { stadium, city, requirement, evidence, record, reason } = item;
  const manual = requirement.criterion.operator === "manual";
  return (
    <li className={`rq-item ${item.isNew ? "new" : ""}`.trim()}>
      <div className="rq-where">
        {item.isNew && <span className="rq-new">★ New</span>}
        <Link href={`/facilities/${stadium.id}`}>
          <b>{stadium.name}</b>
        </Link>
        <span className="muted small">
          {city.name} · due {stadium.completionYear}
        </span>
      </div>
      <div className="rq-what">
        <div>
          <span className="mono small">{requirement.id}</span> <b>{requirement.title}</b>
          {item.reopenedBy && (
            <>
              {" "}
              <StatusPill tone="bad">Reopened by {item.reopenedBy}</StatusPill>
            </>
          )}
        </div>
        <div className="muted small">
          Criterion <span className={manual ? undefined : "mono"}>{criterionLabel(requirement.criterion)}</span>
          {evidence && (
            <>
              {" "}
              · {evidence.file}
              {evidence.value !== "" && evidence.value != null && <> · value {evidence.value}</>} · {evidence.on}
            </>
          )}
        </div>
        <div>
          <StatusPill className="rq-status" tone={REASON_TONE[reason]}>
            {QUEUE_REASON[reason]}
          </StatusPill>
        </div>
      </div>
      <div className="rq-act">
        {record.status === "evidence-submitted" ? (
          <>
            <button type="button" className="primary" onClick={() => decide(item, "compliant")}>
              Mark compliant
            </button>
            <button type="button" className="danger" onClick={() => decide(item, "non-compliant")}>
              Non-compliant
            </button>
          </>
        ) : (
          <Link
            className="btn primary"
            href={`/evidence?stadium=${encodeURIComponent(stadium.id)}&purpose=${encodeURIComponent(`${requirement.id} · ${requirement.title}`)}`}
          >
            Record new evidence
          </Link>
        )}
      </div>
    </li>
  );
}
