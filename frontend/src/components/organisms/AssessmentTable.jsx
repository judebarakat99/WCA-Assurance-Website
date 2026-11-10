"use client";

import StatusPill from "@/components/atoms/StatusPill";
import { APPLICABILITY, STATUS } from "@/lib/domain/assessment.mjs";
import { criterionLabel } from "@/lib/domain/fifa-catalogue.mjs";
import { fmtN } from "@/lib/domain/data";
import { recordEvidence, reviewAssessment } from "@/lib/store/assessments";

const STATUS_TONE = {
  unassessed: "mute",
  declared: "info",
  "evidence-submitted": "warn",
  compliant: "good",
  "non-compliant": "bad",
};
const APPLICABILITY_TONE = { applicable: "info", provisional: "warn", "not-applicable": "mute" };
const CHECK_LABEL = { pass: "Meets criterion", fail: "Below criterion", "needs-review": "Needs reviewer" };
const CHECK_TONE = { pass: "good", fail: "bad", "needs-review": "warn" };

function EvidenceForm({ facilityId, requirement }) {
  function submit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    recordEvidence(facilityId, requirement, {
      file: String(form.get("file") || ""),
      value: String(form.get("value") || "").trim(),
      note: String(form.get("note") || "").trim(),
    });
  }
  const unit = requirement.criterion.unit ? ` (${requirement.criterion.unit})` : "";
  return (
    <form className="formrow assess-form" onSubmit={submit}>
      <label className="f">
        Document
        <input name="file" defaultValue={`${requirement.id}_evidence.pdf`} required />
      </label>
      <label className="f">
        Measured or stated value{unit}
        <input name="value" placeholder={requirement.suggestedEvidence} />
      </label>
      <label className="f">
        Note
        <input name="note" placeholder="Optional" />
      </label>
      <div>
        <button type="submit" className="primary">
          Record evidence
        </button>
      </div>
    </form>
  );
}

function Detail({ facilityId, row, record }) {
  const { requirement } = row;
  const latest = record?.evidence?.at(-1);
  return (
    <div className="assess-detail">
      <p className="muted small m0">
        {requirement.summary} Suggested evidence: {requirement.suggestedEvidence}. Source: {requirement.section},{" "}
        printed page {requirement.printedPage}.
      </p>
      {record?.declared && (
        <p className="small">
          Declared in the bid: <b>{fmtN(record.declared.value)}</b> ·{" "}
          <StatusPill tone={CHECK_TONE[record.declared.check]}>{CHECK_LABEL[record.declared.check]}</StatusPill>
        </p>
      )}
      {latest && (
        <p className="small">
          Latest evidence: <b>{latest.file}</b>
          {latest.value !== "" && <> · value {latest.value}</>} · {latest.on} ·{" "}
          <StatusPill tone={CHECK_TONE[latest.check]}>{CHECK_LABEL[latest.check]}</StatusPill>
          {latest.note && <span className="muted"> · {latest.note}</span>}
        </p>
      )}
      {record?.status === "evidence-submitted" && (
        <div className="flex">
          <button type="button" className="primary" onClick={() => reviewAssessment(facilityId, requirement, "compliant")}>
            Mark compliant
          </button>
          <button type="button" className="danger" onClick={() => reviewAssessment(facilityId, requirement, "non-compliant")}>
            Mark non-compliant
          </button>
        </div>
      )}
      {record?.review && (
        <p className="muted fine m0">
          {record.review.by} · {STATUS[record.review.outcome]} · {record.review.on}
        </p>
      )}
      <EvidenceForm facilityId={facilityId} requirement={requirement} />
    </div>
  );
}

/** A category of requirements for one facility, each with applicability, status and actions. */
export default function AssessmentTable({ facilityId, title, rows, records }) {
  return (
    <section className="block">
      <h3>{title}</h3>
      <div className="tablewrap">
        <table className="assess-table">
          <thead>
            <tr>
              <th scope="col">Requirement</th>
              <th scope="col">Criterion</th>
              <th scope="col">Applicability</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          {rows.map((row) => {
            const record = records[row.key];
            const status = record?.status || "unassessed";
            const inScope = row.applicability.value !== "not-applicable";
            return (
              <tbody key={row.key} className={inScope ? undefined : "muted"}>
                <tr>
                  <td>
                    <span className="mono">{row.requirement.id}</span>
                    <div>{row.requirement.title}</div>
                  </td>
                  <td className="mono">{criterionLabel(row.requirement.criterion)}</td>
                  <td>
                    <StatusPill tone={APPLICABILITY_TONE[row.applicability.value]}>
                      {APPLICABILITY[row.applicability.value]}
                    </StatusPill>
                    <div className="muted fine">{row.applicability.reason}</div>
                  </td>
                  <td>
                    {inScope ? <StatusPill tone={STATUS_TONE[status]}>{STATUS[status]}</StatusPill> : "–"}
                  </td>
                </tr>
                {inScope && (
                  <tr className="assess-more">
                    <td colSpan={4}>
                      <details>
                        <summary className="clickable small">Evidence and review</summary>
                        <Detail facilityId={facilityId} row={row} record={record} />
                      </details>
                    </td>
                  </tr>
                )}
              </tbody>
            );
          })}
        </table>
      </div>
    </section>
  );
}
