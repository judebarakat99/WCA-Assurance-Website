// ---------- Venue detail page (Control Tower drill-down) ----------
import {
  GATES,
  DECISIONS,
  MAT,
  esc,
  fmtN,
  fmtD,
  pct,
  dd,
  showVal,
  venueMeta,
  stateCls,
} from "@/lib/domain/data";
import { S, ui, goView } from "@/lib/store/state";
import {
  scores,
  oblsOf,
  venueState,
  gateEval,
  isProven,
} from "@/lib/domain/scoring";
import { forecasts, projection } from "@/lib/domain/forecast";
import {
  segV,
  legV,
  ringV,
  stP,
  gtrackV,
  crumbV,
  oblRowsV,
  gateCardV,
  issueCardV,
  decisionCardV,
} from "@/legacy/views/shared";

export function viewVenueDetail(id) {
  const m = venueMeta(id);
  if (!m) {
    goView("tower");
    return "";
  }
  const v = venueState(id),
    list = oblsOf(id),
    sc = scores(list),
    gap = pct(sc.declared - sc.assured);
  const e = gateEval(id),
    fc = forecasts().find((x) => x.id === id),
    p = projection(id);
  const proven = list.filter(isProven).length,
    P = stP(list);
  const openIss = S.issues.filter(
    (i) => i.status === "Open" && list.some((o) => o.id === i.obl),
  );
  const closedIss = S.issues.filter(
    (i) => i.status !== "Open" && list.some((o) => o.id === i.obl),
  );
  const decs = DECISIONS.filter((d) => d.venue === id);
  const audit = S.audit
    .filter((a) => a.obl && String(a.obl).indexOf(id + "-") === 0)
    .slice(-20)
    .reverse();
  const evRows = list
    .flatMap((o) => o.evidence.map((x) => ({ o, x })))
    .sort((a, b) => (a.x.date < b.x.date ? 1 : a.x.date > b.x.date ? -1 : 0));
  const ring = ringV(
    [
      { n: sc.assured, c: "var(--brand-deep)" },
      {
        n: Math.max(sc.declared - sc.assured, 0),
        c: "color-mix(in srgb,var(--warn) 55%,var(--surface))",
      },
      {
        n: Math.max(1 - Math.max(sc.declared, sc.assured), 0),
        c: "var(--sunk)",
      },
    ],
    pct(sc.assured) + "%",
    "assured",
  );
  const fcPanel = fc
    ? `<div class="panel"><div class="eyebrow">Gate & forecast</div><h3>${fc.gate.id} ${esc(fc.gate.name)} · due ${fmtD(fc.gateDate)}</h3>${gtrackV(v.gateIdx)}
    <div class="mini-grid four" style="margin-top:14px">
      <div class="mini ${fc.cls === "p-good" ? "good" : fc.cls === "p-warn" ? "warn" : "bad"}"><b>${pct(fc.prob)}%</b><span>chance on time</span></div>
      <div class="mini"><b>${fmtD(fc.d50)}</b><span>P50</span></div>
      <div class="mini"><b>${fmtD(fc.d60)}</b><span>P60</span></div>
      <div class="mini ${fc.late80 > 0 ? "bad" : "good"}"><b>${fmtD(fc.d80)}</b><span>P80 ${fc.late80 > 0 ? dd(fc.late80) + " late" : "inside milestone"}</span></div></div>
    <p class="muted" style="font-size:13px;margin:12px 0 0">PMC deterministic finish ${fmtD(fc.pmc.finish)} (${fc.pmc.pct}% · ${esc(fc.pmc.note)}). The evidence-based forecast runs 1,000 simulations from what evidence has proven, not reported percent complete.${S.scn.recovery.includes(id) ? " A recovery team is deployed at this venue." : ""}</p></div>`
    : `<div class="panel"><div class="eyebrow">Gate & forecast</div><h3>All gates passed</h3>${gtrackV(v.gateIdx)}<div class="okbig"><i>✓</i><span>All gates passed</span></div></div>`;
  return (
    crumbV(esc(m.name)) +
    `
  <div class="page-head"><span class="eyebrow-chip">Venue detail · ${esc(m.city)} · ${esc(m.type)}</span><h2>${esc(m.name)}</h2><p class="lead">${m.role ? esc(m.role) + " · " : ""}${m.capacity ? `planned capacity about ${fmtN(m.capacity)} · ` : ""}everything the programme knows about this venue, backed by validated evidence.</p></div>
  <div class="grid cols vd-top">
    <div class="panel"><div class="eyebrow">Readiness</div>
      <div class="vbody">${ring}<div class="vside">
        <div class="vline"><span>Declared by owners</span><b>${pct(sc.declared)}%</b></div>
        <div class="vline"><span>Assurance gap</span><span class="pill ${gap >= 15 ? "p-bad" : gap >= 5 ? "p-warn" : "p-good"}">${gap} pts</span></div>
        <div class="vline"><span>Obligations proven</span><b>${proven}/${list.length}</b></div>
        <div class="vline"><span>Forecast</span><span class="pill ${p.cls}">${p.status}</span></div>
        <div class="vline"><span>Open issues</span><span class="pill ${openIss.length ? "p-bad" : "p-mute"}">${openIss.length}</span></div></div></div>
      ${segV(P)}${legV(P)}
      <div class="flex" style="margin-top:14px"><button class="primary" data-dossier="${m.id}">Open inspection dossier</button><button class="linkish" data-goto="register" data-venue="${m.id}">Open in full register</button></div></div>
    ${fcPanel}
  </div>
  <section class="block"><div class="block-head"><div><div class="eyebrow">Gate rules</div><h3>Gate check & blockers</h3></div></div>${gateCardV(m, v, e)}</section>
  <section class="block"><div class="block-head"><div><div class="eyebrow">Obligations</div><h3>${list.length} obligations at this venue</h3></div></div>
    <div class="tablewrap"><table><thead><tr><th>ID</th><th>Obligation</th><th>Criterion (illustrative)</th><th>Criticality</th><th>Owner</th><th>Gate</th><th>State</th></tr></thead><tbody>${oblRowsV(list)}</tbody></table></div></section>
  <section class="block"><div class="block-head"><div><div class="eyebrow">Evidence</div><h3>${evRows.length} evidence item${evRows.length === 1 ? "" : "s"}</h3></div></div>
    ${
      evRows.length
        ? `<div class="tablewrap"><table><thead><tr><th>Document</th><th>Obligation</th><th>Issued by</th><th>Date</th><th>Stage</th><th>Value</th><th>Result</th></tr></thead><tbody>
    ${evRows.map(({ o, x }) => `<tr><td>${esc(x.file)}</td><td class="mono"><button class="linkish" data-obl="${o.id}">${o.code}</button></td><td>${esc(x.issuer)}</td><td class="mono">${fmtD(x.date)}</td><td>${MAT[x.maturity == null ? 1 : x.maturity]}</td><td class="mono">${showVal(o, x.value)}</td><td><span class="pill ${x.result === "pass" ? "p-good" : x.result === "fail" ? "p-bad" : "p-warn"}">${x.result === "pass" ? "Pass" : x.result === "fail" ? "Fail" : "Pending"}</span></td></tr>`).join("")}</tbody></table></div>`
        : `<div class="panel"><p class="muted" style="margin:0">No evidence submitted yet for this venue.</p></div>`
    }</section>
  <section class="block"><div class="block-head"><div><div class="eyebrow">Corrective actions</div><h3>${openIss.length} open issue${openIss.length === 1 ? "" : "s"}</h3></div></div>
    ${openIss.length ? `<div class="grid issues">${openIss.map(issueCardV).join("")}</div>` : `<div class="panel"><div class="okbig"><i>✓</i><span>No open issues at this venue</span></div></div>`}
    ${closedIss.length ? `<details style="margin-top:14px"><summary class="muted" style="cursor:pointer">Resolved issues · ${closedIss.length}</summary><div class="grid issues" style="margin-top:14px">${closedIss.map(issueCardV).join("")}</div></details>` : ""}</section>
  <section class="block"><div class="block-head"><div><div class="eyebrow">Decisions</div><h3>Related executive decisions</h3></div></div>
    ${decs.length ? `<div class="grid decs">${decs.map((d) => decisionCardV(d)).join("")}</div>` : `<div class="panel"><p class="muted" style="margin:0">No executive decisions raised for this venue. <a href="#actions">Open Decisions & Actions</a>.</p></div>`}</section>
  <section class="block"><div class="block-head"><div><div class="eyebrow">Audit trail</div><h3>Activity at this venue</h3></div></div>
    <div class="panel"><div class="tl">${audit.map((a) => `<div class="tli ${/rejected|refused|no longer|escalat/i.test(a.action) ? "bad" : /Verified|validated|passed/i.test(a.action) ? "good" : "mid"}"><i></i><div><span class="mono muted">${fmtD(a.t)}</span><div><b>${esc(a.actor)}</b> ${esc(a.action)}${a.obl ? ` · <button class="linkish" data-obl="${a.obl}">${esc(a.obl)}</button>` : ""}</div></div></div>`).join("") || `<span class="muted">No activity recorded yet.</span>`}</div></div></section>`
  );
}
