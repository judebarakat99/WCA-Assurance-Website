// ---------- obligation drawer (shared overlay) ----------
import {
  GATES,
  LEVELS,
  SLA,
  WEIGHT,
  MAT,
  ISSUERS,
  esc,
  fmtN,
  fmtD,
  critText,
  showVal,
  venueMeta,
  gateNum,
} from "../../lib/data";
import { S, ui, save, log, rerender, tour } from "../../lib/state";
import { issueFor, depBlocked, matOf } from "../../lib/scoring";
import { validate, verify } from "../../lib/actions";
import { applyHL } from "./tour";

const $ = (s) => document.querySelector(s);
// ---------- drawer ----------
export function openDrawer(id) {
  ui.drawerId = id;
  ui.lastResult = null;
  renderDrawer();
}
export function closeDrawer() {
  ui.drawerId = null;
  $("#drawerRoot").innerHTML = "";
}
export function renderDrawer() {
  if (!ui.drawerId) {
    $("#drawerRoot").innerHTML = "";
    return;
  }
  setTimeout(() => applyHL(false), 0);
  const o = S.obligations.find((x) => x.id === ui.drawerId);
  if (!o) {
    closeDrawer();
    return;
  }
  const m = venueMeta(o.venue),
    iss = issueFor(o),
    dep = depBlocked(o),
    e = o.evidence[o.evidence.length - 1];
  const path = ["Assigned", "Submitted", "Validated", "Verified"];
  const reached = o.state === "Rejected" ? 1 : path.indexOf(o.state);
  const audit = S.audit
    .filter((a) => a.obl === o.id)
    .slice()
    .reverse();
  const valInput =
    o.op === "bool"
      ? `<select id="evVal"><option value="yes">Yes, confirmed</option><option value="no">No</option></select>`
      : `<input id="evVal" type="number" step="any" placeholder="e.g. ${fmtN(o.value)}" required>`;
  $("#drawerRoot").innerHTML =
    `<div class="drawer-bg" data-close></div><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="dTitle">
    <button class="ghost close" data-close aria-label="Close">Close</button>
    <div><div class="mono muted">${o.id} · ${esc(o.clause)}</div><h2 id="dTitle" style="font-size:19px;margin-top:4px;padding-right:56px">${esc(o.text)}</h2><div class="muted">${esc(m.name)}, ${esc(m.city)}</div></div>
    <div class="stepper">${path.map((p, i) => `<span class="${o.state === "Rejected" && i === 2 ? "rej" : i <= reached ? "on" : ""}">${o.state === "Rejected" && i === 2 ? "Rejected" : p}</span>`).join("")}</div>
    <div class="criterion">${esc(critText(o))}</div><div class="muted" style="font-size:12px;margin-top:-6px">Illustrative threshold for the PoC. The live library loads values and clause references from the authority's FIFA documents.</div>
    <dl class="kv"><dt>Family</dt><dd>${esc(o.family)}</dd><dt>Criticality</dt><dd>${o.crit} (weight ${WEIGHT[o.crit]}, SLA ${SLA[o.crit]} days)</dd><dt>Owner</dt><dd>${esc(o.owner)}</dd><dt>Gate</dt><dd>${o.gate} ${GATES[gateNum(o.gate) - 1].name}</dd>${o.verifiedBy ? `<dt>Verified by</dt><dd>${esc(o.verifiedBy)}</dd>` : ""}${o.claim ? `<dt>Owner status</dt><dd>Declared complete</dd>` : ""}</dl>
    ${dep ? `<div class="result no">Blocked by dependency ${dep.id} (${esc(dep.text)}), currently ${dep.state}. This obligation cannot be ready before it.</div>` : ""}
    ${iss ? `<div class="result no"><b>${iss.id}</b> open at ${LEVELS[iss.level]}, SLA ${fmtD(iss.due)}${S.today > iss.due ? " (late)" : ""}. Closes only when new evidence passes.</div>` : ""}
    ${ui.lastResult ? `<div id="lastResult" class="result ${ui.lastResult.ok ? "ok" : "no"}" role="status">${esc(ui.lastResult.msg)}</div>` : ""}
    <div class="flex">
      ${o.state === "Submitted" ? `<button class="primary" data-validate>Run validation</button>` : ""}
      ${o.state === "Validated" ? `<button class="primary" data-verify>Verify as second line</button>` : ""}
    </div>
    <section><h3>Evidence</h3>${
      o.evidence.length
        ? `<div class="tablewrap"><table><thead><tr><th>File</th><th>Value</th><th>Result</th></tr></thead><tbody>${o.evidence
            .slice()
            .reverse()
            .map(
              (x) =>
                `<tr><td>${esc(x.file)}<div class="muted" style="font-size:12px">${esc(x.issuer)} · ${fmtD(x.date)} · ${MAT[x.maturity == null ? 1 : x.maturity]} stage</div></td><td class="mono">${showVal(o, x.value)}</td><td><span class="pill ${x.result === "pass" ? "p-good" : x.result === "fail" ? "p-bad" : "p-warn"}">${x.result === "pass" ? "Pass" : x.result === "fail" ? "Fail" : "Pending"}</span></td></tr>`,
            )
            .join("")}</tbody></table></div>`
        : `<p class="muted">No evidence submitted yet.</p>`
    }</section>
    <section class="panel" style="background:var(--sunk);border:0"><h3>Submit new evidence</h3><form id="evForm" class="grid" style="gap:10px">
      <div class="formrow"><label class="f" for="evFile">Document<input id="evFile" value="${esc(o.code)}_${esc(o.venue)}_retest.pdf" required></label><label class="f" for="evIssuer">Issued by<select id="evIssuer">${ISSUERS.map((i) => `<option>${esc(i)}</option>`).join("")}</select></label><label class="f" for="evMat">Evidence stage<select id="evMat">${MAT.map((x, i) => `<option value="${i}" ${i === Math.max(0, matOf(o)) ? "selected" : ""}>${x}</option>`).join("")}</select></label><label class="f" for="evVal">${o.op === "bool" ? "Confirmed" : "Measured value (" + esc(o.unit) + ")"}${valInput}</label></div>
      <div><button class="primary" type="submit">Submit and validate</button></div></form></section>
    <section><h3>Audit trail</h3><div class="timeline">${audit.map((a) => `<div class="ev"><span class="mono muted">${fmtD(a.t)}</span><span><b>${esc(a.actor)}</b> ${esc(a.action)}</span></div>`).join("") || `<span class="muted">No activity yet.</span>`}</div></section>
  </aside>`;
  const f = $("#evForm");
  f.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const raw = $("#evVal").value;
    if (o.op !== "bool" && raw === "") return;
    const val = o.op === "bool" ? raw : Number(raw);
    o.evidence.push({
      file: $("#evFile").value || "evidence.pdf",
      issuer: $("#evIssuer").value,
      value: val,
      date: S.today,
      result: "pending",
      reviewer: null,
      maturity: Number($("#evMat").value),
    });
    o.state = "Submitted";
    log(o.owner, "Submitted evidence", o.id);
    const ok = validate(o);
    ui.lastResult = {
      ok,
      msg: ok
        ? `Pass: ${showVal(o, val)} meets ${critText(o)}. Ready for second-line verification.`
        : `Fail: ${showVal(o, val)} does not meet ${critText(o)}. Status set to Rejected and a corrective action opened.`,
    };
    save();
    rerender();
    renderDrawer();
  });
  const btn = $("#drawerRoot .drawer .close");
  if (btn && !tour.active) btn.focus();
}
