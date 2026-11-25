"use client";

import StatusPill from "@/components/atoms/StatusPill";

const VERDICT = {
  meets: ["good", "Meets the criterion"],
  below: ["bad", "Below the criterion"],
  "not-stated": ["warn", "No figure stated"],
  review: ["warn", "Needs a reviewer"],
};
const SEVERITY_TONE = { high: "bad", medium: "warn", low: "mute" };

/** What the agent found in one incoming evidence document: the requirements it speaks to, the checks, the gaps. */
export default function EvidenceAnalysis({ doc }) {
  const a = doc.analysis;
  if (!a) return null;
  const recorded = a.matches.filter((m) => m.record);
  const mentioned = a.matches.filter((m) => !m.record);
  const flags = [
    ...a.inconsistencies.map((x) => ({ ...x, label: "Inconsistent" })),
    ...a.missing.map((x) => ({ ...x, label: "Missing" })),
  ];
  const owners = [...new Set(a.alerts.map((x) => x.owner))];
  return (
    <div className="ea">
      {!a.readable && (
        <p className="small m0">
          <StatusPill tone="warn">Text not readable</StatusPill> This file has no text the agent can read (it may be a
          scan), so it was identified from the file name only. Check the details below before filing.
        </p>
      )}
      {recorded.length > 0 && (
        <>
          <p className="ea-head">Checked against the register</p>
          <ul className="ea-list">
            {recorded.map((m) => {
              const [tone, label] = VERDICT[m.verdict] || VERDICT.review;
              return (
                <li key={m.requirement_id}>
                  <div className="ea-line">
                    <StatusPill tone={tone}>{label}</StatusPill>
                    <span className="mono small">{m.requirement_id}</span>
                    <b>{m.title}</b>
                    <span className="muted small">
                      {m.family_id} · {m.family}
                    </span>
                  </div>
                  <div className="small">
                    {m.value !== null ? (
                      <>
                        <b>
                          {m.value}
                          {m.unit ? ` ${m.unit}` : ""}
                        </b>{" "}
                        against {m.criterion_label}
                      </>
                    ) : (
                      <>No figure to check against {m.criterion_label}</>
                    )}
                    {m.note && <span className="muted"> · {m.note}</span>}
                  </div>
                  <div className="muted fine">
                    “{m.quote}” · p. {m.page}
                    {m.on_record ? ` · on record: ${m.on_record.partial ? "partially compliant" : m.on_record.status.replace("-", " ")}` : ""}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {flags.map((x, i) => (
        <p key={i} className="small m0">
          <StatusPill tone={SEVERITY_TONE[x.severity]}>{x.label}</StatusPill> {x.text}
        </p>
      ))}
      {a.alerts.length > 0 && (
        <p className="small m0">
          <StatusPill tone="info">
            {a.alerts.length} alert{a.alerts.length === 1 ? "" : "s"} raised
          </StatusPill>{" "}
          for {owners.join(" and ")}. They are listed under Alerts below.
        </p>
      )}
      {recorded.length > 0 && (
        <p className="muted fine m0">
          Filing records this document as evidence against {recorded.length} requirement{recorded.length === 1 ? "" : "s"} in
          the register. A reviewer then decides each one in the review queue.
        </p>
      )}
      {mentioned.length > 0 && (
        <p className="muted fine m0">
          Also mentioned, not recorded: {mentioned.map((m) => `${m.requirement_id} ${m.title}`).join("; ")}.
        </p>
      )}
      <details className="ea-steps">
        <summary className="clickable small">How the agent checked this document</summary>
        <ol className="pf-steps">
          {a.steps.map((s, k) => (
            <li key={k} className={s.ok ? "ok" : "flag"}>
              <b>{s.label}</b>
              <span>{s.detail}</span>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
