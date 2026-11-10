"use client";

import { useEffect, useRef } from "react";
import StatusPill from "@/components/atoms/StatusPill";
import { GATES, ISSUERS, LEVELS, MAT, SLA, WEIGHT, critText, fmtD, fmtN, gateNum, showVal, venueMeta } from "@/lib/domain/data";
import { depBlocked, issueFor, matOf } from "@/lib/domain/scoring";
import { closeDrawer, runValidation, submitEvidence, verifyObligation } from "@/lib/drawer";
import { tour } from "@/lib/store/state";
import { useProgramme } from "@/lib/store/useProgramme";

const PATH = ["Assigned", "Submitted", "Validated", "Verified"];
const RESULT = { pass: ["good", "Pass"], fail: ["bad", "Fail"] };

function Stepper({ state }) {
  const reached = state === "Rejected" ? 1 : PATH.indexOf(state);
  return (
    <div className="stepper">
      {PATH.map((p, i) => {
        const rejected = state === "Rejected" && i === 2;
        return (
          <span key={p} className={rejected ? "rej" : i <= reached ? "on" : undefined}>
            {rejected ? "Rejected" : p}
          </span>
        );
      })}
    </div>
  );
}

function EvidenceForm({ o }) {
  function submit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const value = form.get("value");
    if (o.op !== "bool" && value === "") return;
    submitEvidence(o.id, {
      file: form.get("file"),
      issuer: form.get("issuer"),
      maturity: form.get("maturity"),
      value,
    });
  }
  return (
    <section className="panel drawer-form">
      <h3>Submit new evidence</h3>
      <form id="evForm" className="grid" onSubmit={submit}>
        <div className="formrow">
          <label className="f" htmlFor="evFile">
            Document
            <input id="evFile" name="file" defaultValue={`${o.code}_${o.venue}_retest.pdf`} required />
          </label>
          <label className="f" htmlFor="evIssuer">
            Issued by
            <select id="evIssuer" name="issuer">
              {ISSUERS.map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
          </label>
          <label className="f" htmlFor="evMat">
            Evidence stage
            <select id="evMat" name="maturity" defaultValue={Math.max(0, matOf(o))}>
              {MAT.map((x, i) => (
                <option key={x} value={i}>
                  {x}
                </option>
              ))}
            </select>
          </label>
          <label className="f" htmlFor="evVal">
            {o.op === "bool" ? "Confirmed" : `Measured value (${o.unit})`}
            {o.op === "bool" ? (
              <select id="evVal" name="value">
                <option value="yes">Yes, confirmed</option>
                <option value="no">No</option>
              </select>
            ) : (
              <input id="evVal" name="value" type="number" step="any" placeholder={`e.g. ${fmtN(o.value)}`} required />
            )}
          </label>
        </div>
        <div>
          <button className="primary" type="submit">
            Submit and validate
          </button>
        </div>
      </form>
    </section>
  );
}

function Drawer({ S, ui, o }) {
  const closeRef = useRef(null);
  const m = venueMeta(o.venue);
  const issue = issueFor(o);
  const dep = depBlocked(o);
  const audit = S.audit.filter((a) => a.obl === o.id).slice().reverse();

  useEffect(() => {
    if (!tour.active) closeRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && closeDrawer();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [o.id]);

  return (
    <>
      <div className="drawer-bg" onClick={closeDrawer} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="dTitle">
        <button type="button" className="ghost close" aria-label="Close" ref={closeRef} onClick={closeDrawer}>
          Close
        </button>
        <div>
          <div className="mono muted">
            {o.id} · {o.clause}
          </div>
          <h2 id="dTitle" className="drawer-title">
            {o.text}
          </h2>
          <div className="muted">
            {m.name}, {m.city}
          </div>
        </div>
        <Stepper state={o.state} />
        <div className="criterion">{critText(o)}</div>
        <div className="muted fine drawer-note">
          Illustrative threshold for the PoC. The live library loads values and clause references from the
          authority&apos;s FIFA documents.
        </div>
        <dl className="kv">
          <dt>Family</dt>
          <dd>{o.family}</dd>
          <dt>Criticality</dt>
          <dd>
            {o.crit} (weight {WEIGHT[o.crit]}, SLA {SLA[o.crit]} days)
          </dd>
          <dt>Owner</dt>
          <dd>{o.owner}</dd>
          <dt>Gate</dt>
          <dd>
            {o.gate} {GATES[gateNum(o.gate) - 1].name}
          </dd>
          {o.verifiedBy && (
            <>
              <dt>Verified by</dt>
              <dd>{o.verifiedBy}</dd>
            </>
          )}
          {o.claim && (
            <>
              <dt>Owner status</dt>
              <dd>Declared complete</dd>
            </>
          )}
        </dl>
        {dep && (
          <div className="result no">
            Blocked by dependency {dep.id} ({dep.text}), currently {dep.state}. This obligation cannot be ready before
            it.
          </div>
        )}
        {issue && (
          <div className="result no">
            <b>{issue.id}</b> open at {LEVELS[issue.level]}, SLA {fmtD(issue.due)}
            {S.today > issue.due ? " (late)" : ""}. Closes only when new evidence passes.
          </div>
        )}
        {ui.lastResult && (
          <div id="lastResult" className={`result ${ui.lastResult.ok ? "ok" : "no"}`} role="status">
            {ui.lastResult.msg}
          </div>
        )}
        <div className="flex">
          {o.state === "Submitted" && (
            <button type="button" className="primary" onClick={() => runValidation(o.id)}>
              Run validation
            </button>
          )}
          {o.state === "Validated" && (
            <button type="button" className="primary" onClick={() => verifyObligation(o.id)}>
              Verify as second line
            </button>
          )}
        </div>
        <section>
          <h3>Evidence</h3>
          {o.evidence.length ? (
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Value</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {o.evidence
                    .slice()
                    .reverse()
                    .map((x, k) => {
                      const [tone, label] = RESULT[x.result] || ["warn", "Pending"];
                      return (
                        <tr key={k}>
                          <td>
                            {x.file}
                            <div className="muted fine">
                              {x.issuer} · {fmtD(x.date)} · {MAT[x.maturity == null ? 1 : x.maturity]} stage
                            </div>
                          </td>
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
          ) : (
            <p className="muted">No evidence submitted yet.</p>
          )}
        </section>
        <EvidenceForm key={`${o.id}-${o.evidence.length}`} o={o} />
        <section>
          <h3>Audit trail</h3>
          <div className="timeline">
            {audit.length ? (
              audit.map((a, k) => (
                <div key={k} className="ev">
                  <span className="mono muted">{fmtD(a.t)}</span>
                  <span>
                    <b>{a.actor}</b> {a.action}
                  </span>
                </div>
              ))
            ) : (
              <span className="muted">No activity yet.</span>
            )}
          </div>
        </section>
      </aside>
    </>
  );
}

/** The obligation drawer, shown over any page when ui.drawerId is set. */
export default function ObligationDrawer() {
  const programme = useProgramme();
  const o = programme && programme.ui.drawerId && programme.S.obligations.find((x) => x.id === programme.ui.drawerId);
  return <div id="drawerRoot">{o ? <Drawer S={programme.S} ui={programme.ui} o={o} /> : null}</div>;
}
