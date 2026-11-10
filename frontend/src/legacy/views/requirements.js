// ---------- Compliance intake page view ----------
// Left: local evidence upload tied to venue and obligation/action (simulated
// processing, functional state updates). Right: requirement decomposition.
// Below: full Change Impact simulation.
import {
  CHANGES,
  VENUES,
  EV_TYPES,
  EV_STEPS,
  esc,
  fmtN,
  fmtD,
  pct,
  sn,
  critText,
  showVal,
  goodValue,
  badValue,
  passes,
  venueMeta,
  stateCls,
  SAMPLE_CLAUSE,
} from "@/lib/domain/data";
import { S, ui, log, save, rerender, goView } from "@/lib/store/state";
import { oblsOf, issueFor } from "@/lib/domain/scoring";
import { validate, toast, changeImpact } from "@/lib/domain/actions";
import { segV, legV, ringV, kpiV, critV, headV } from "@/legacy/views/shared";

export function changeSection() {
  const c = CHANGES.find((x) => x.id === ui.selChange),
    rows = changeImpact(c),
    flips = rows.filter((r) => r.flip);
  const applied = S.applied && S.applied.includes(c.id);
  const cat = (r) => (r.flip ? "flip" : !r.e ? "none" : r.nw ? "ok" : "fail");
  const nOf = (k) => rows.filter((r) => cat(r) === k).length,
    nV = new Set(rows.map((r) => r.o.venue)).size;
  const P = [
    { n: nOf("flip"), c: "var(--bad)", l: "newly failing" },
    { n: nOf("ok"), c: "var(--good)", l: "still compliant" },
    { n: nOf("fail"), c: "var(--warn)", l: "already failing" },
    {
      n: nOf("none"),
      c: "color-mix(in srgb,var(--muted) 30%,var(--sunk))",
      l: "no evidence yet",
    },
  ];
  const MXI = {
    flip: ["bad", "✕", "flips to fail"],
    ok: ["good", "✓", "stays compliant"],
    fail: ["warn", "!", "already failing"],
    none: ["mute", "–", "criterion updated"],
  };
  const mx = rows
    .map((r) => {
      const m = MXI[cat(r)];
      return `<button class="mx ${m[0]}" data-obl="${r.o.id}"><i>${m[1]}</i><span>${esc(sn(r.o.venue))}</span><small>${m[2]}</small></button>`;
    })
    .join("");
  return `<section class="block" id="changeBlock"><div class="block-head"><div><div class="eyebrow">Change impact</div><h3>Change impact · ${rows.length} obligations · ${nV} venues</h3></div></div>
  <p class="muted" style="margin:0 0 16px;max-width:84ch;font-size:13.5px">When FIFA updates a guideline or a design changes, the engine re-tests existing evidence against the new rule and shows what silently stops complying. New requirement → impact assessment → evidence submission → validation → readiness, action and gate status change. The updates below are simulated.</p>
  <div class="ui.filters"><select id="chSel" aria-label="Guideline update">${CHANGES.map((x) => `<option value="${x.id}" ${x.id === ui.selChange ? "selected" : ""}>${esc(x.title)}</option>`).join("")}</select></div>
  <div class="sumcard mxcard"><div class="eyebrow">Impact by venue</div><div class="mxs">${mx}</div></div>
  <div class="grid cols" style="margin-top:24px"><div class="tablewrap"><table><thead><tr><th>Obligation</th><th>Venue</th><th>Current evidence</th><th>Old rule</th><th>New rule</th></tr></thead><tbody>
  ${rows.map((r) => `<tr class="${r.flip ? "flip" : ""}"><td class="mono"><button class="linkish" data-obl="${r.o.id}">${r.o.id}</button></td><td>${esc(venueMeta(r.o.venue).name)}</td><td class="mono">${r.e ? showVal(r.o, r.e.value) : "none yet"}</td><td>${r.e ? `<span class="pill ${r.old ? "p-good" : "p-bad"}">${r.old ? "Pass" : "Fail"}</span>` : "–"}</td><td>${r.e ? `<span class="pill ${r.nw ? "p-good" : "p-bad"}">${r.nw ? "Pass" : "Fail"}</span>` : `<span class="muted">criterion updated</span>`}</td></tr>`).join("")}
  </tbody></table></div>
  <div class="panel"><div class="eyebrow">Previously compliant, now failing</div><div class="v3" style="margin:6px 0 14px">${ringV(P, flips.length, "of " + rows.length, "sm")}<div class="v3-side"><div class="impact-num">${flips.length}</div><div class="muted" style="font-size:13px">${flips.length === 1 ? "obligation flips" : "obligations flip"} to Rejected</div></div></div>${legV(P)}
  <p style="margin:16px 0 14px;font-size:13.5px" class="muted">${rows.length} obligations across ${nV} venues carry this clause. Applying the update re-baselines the criterion, reverts failing evidence to Rejected and opens corrective actions.</p>
  <button class="primary" id="applyChange" ${applied ? "disabled" : ""}>${applied ? "Update applied" : "Apply update"}</button></div></div></section>`;
}
export function requirementIntakePanel() {
  const LG = [
    [
      "Binding",
      "“shall”, “must”",
      "Become obligations with an owner and a gate.",
      "p-info",
    ],
    ["Advisory", "“should”", "Stays advisory and optional to keep.", "p-mute"],
    [
      "Measurable",
      "numbers with units",
      "Become pass or fail criteria the evidence check can test.",
      "p-good",
    ],
    [
      "Yes / no",
      "no number",
      "Become checks that need a certificate.",
      "p-warn",
    ],
  ];
  const legend = `<div class="lgrid">${LG.map(([t, k, x, c]) => `<div class="lg-c"><span class="pill ${c}">${t}</span><b>${k}</b><span>${x}</span></div>`).join("")}</div>`;
  let sum = "";
  if (ui.decoOut) {
    const nB = ui.decoOut.filter((d) => d.binding).length,
      nA = ui.decoOut.length - nB,
      nM = ui.decoOut.filter((d) => d.op !== "bool").length,
      nY = ui.decoOut.length - nM;
    sum = `<div class="mini-grid four" style="margin-top:24px">${[
      [nB, "binding", "good"],
      [nA, "advisory", "mid"],
      [nM, "measurable criteria", "good"],
      [nY, "yes / no checks", "warn"],
    ]
      .map(
        ([n, l, c]) =>
          `<div class="mini ${c}"><b>${n}</b><span>${l}</span></div>`,
      )
      .join("")}</div>`;
  }
  return `<div class="panel" id="reqIntake"><div class="eyebrow">Requirement intake · rule-based PoC</div><h3>Decompose requirements</h3>
  <p class="muted" style="margin:0 0 14px;font-size:13.5px">Paste FIFA clause text. The engine splits it into atomic obligations, flags binding language and extracts measurable criteria. In the full product a language model does this with a reviewer approving every line; this PoC uses rules.</p>
  <label class="f" for="decoIn">Clause text (sample written for the demo)</label><textarea id="decoIn" style="margin-top:6px">${esc(ui.decoInput)}</textarea><div class="flex" style="margin-top:14px"><button class="primary" id="decoRun">Decompose</button><button class="ghost" id="decoSample">Load sample</button></div>
  <details style="margin-top:14px"${ui.decoOut ? "" : " open"}><summary class="muted" style="cursor:pointer">How clauses are read</summary>${legend}</details>
  ${
    ui.decoOut
      ? `${sum}<div style="margin-top:24px"><div class="flex" style="justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px"><h3 style="margin:0">${ui.decoOut.length} candidate obligations</h3><div class="flex"><label class="f" style="flex-direction:row;align-items:center;gap:8px" for="decoV">Add to</label><select id="decoV">${VENUES.map((v) => `<option value="${v.id}" ${v.id === ui.decoVenue ? "selected" : ""}>${esc(v.name)}</option>`).join("")}</select><button class="primary" id="decoAdd">Add selected to register</button></div></div>
  <div class="tablewrap"><table><thead><tr><th>Keep</th><th>Ref</th><th>Obligation</th><th>Type</th><th>Criterion</th><th>Family</th><th>Criticality</th></tr></thead><tbody>${ui.decoOut.map((d, i) => `<tr><td><input type="checkbox" data-keep="${i}" ${d.keep ? "checked" : ""} aria-label="Keep obligation ${i + 1}"></td><td class="mono">${esc(d.ref)}</td><td>${esc(d.text)}</td><td><span class="pill ${d.binding ? "p-info" : "p-mute"}">${d.binding ? "Binding" : "Advisory"}</span></td><td class="mono">${d.op === "bool" ? "yes / no" : { min: "≥ ", max: "≤ ", eq: "= " }[d.op] + fmtN(d.value) + " " + d.unit}</td><td>${esc(d.fam)}</td><td>${critV(d.crit)}</td></tr>`).join("")}</tbody></table></div></div>`
      : ""
  }</div>`;
}
export function intakeTargets() {
  const obls = oblsOf(ui.intake.venue);
  const iss = S.issues.filter(
    (i) => i.status === "Open" && obls.some((o) => o.id === i.obl),
  );
  return { obls, iss };
}
export function intakeObl() {
  if (!ui.intake.target) return null;
  const id =
    ui.intake.target.indexOf("iss:") === 0
      ? (S.issues.find((i) => i.id === ui.intake.target.slice(4)) || {}).obl
      : ui.intake.target.slice(4);
  return S.obligations.find((o) => o.id === id) || null;
}
export function paintIntake() {
  const el = document.getElementById("evIntake");
  if (el) el.outerHTML = evidenceIntakePanel();
}
export function intakeRun() {
  const o = intakeObl();
  if (!o) {
    toast("Choose an obligation or corrective action first.");
    return;
  }
  if (!ui.intake.fileName) {
    toast("Choose or drop a document first.");
    return;
  }
  ui.intake.running = true;
  ui.intake.step = 0;
  ui.intake.result = null;
  ui.intake.added = false;
  paintIntake();
  const fail = /fail|reject|short|low|bad/i.test(ui.intake.fileName);
  const val = o.op === "bool" ? !fail : fail ? badValue(o) : goodValue(o);
  const tick = () => {
    if (!ui.intake.running) return;
    ui.intake.step++;
    if (ui.intake.step >= EV_STEPS.length) {
      ui.intake.running = false;
      ui.intake.result = { oid: o.id, val, ok: passes(o, val) };
      paintIntake();
      return;
    }
    paintIntake();
    setTimeout(tick, 650);
  };
  setTimeout(tick, 650);
}
export function intakeAdd() {
  const r = ui.intake.result;
  if (!r || ui.intake.added) return;
  const o = S.obligations.find((x) => x.id === r.oid);
  if (!o) return;
  o.evidence.push({
    file: ui.intake.fileName,
    issuer: "Evidence intake (simulated)",
    value: r.val,
    date: S.today,
    result: "pending",
    reviewer: null,
    maturity: EV_TYPES[ui.intake.etype][1],
  });
  o.state = "Submitted";
  o.claim = true;
  log(o.owner, "Submitted evidence via evidence intake", o.id);
  const ok = validate(o);
  ui.intake.added = true;
  save();
  rerender();
  toast(
    ok
      ? `Pass: ${showVal(o, r.val)} meets ${critText(o)}. ${o.id} validated${issueFor(o) ? "" : " and any open action closed"}.`
      : `Fail: ${showVal(o, r.val)} does not meet ${critText(o)}. ${o.id} rejected and a corrective action opened.`,
  );
}
export function evidenceIntakePanel() {
  const { obls, iss } = intakeTargets();
  const o = intakeObl();
  const steps =
    ui.intake.step >= 0
      ? `<ol class="evflow">${EV_STEPS.map((s, i) => `<li class="${i < ui.intake.step ? "done" : i === ui.intake.step && ui.intake.running ? "cur" : ""}"><i>${i < ui.intake.step ? "✓" : i + 1}</i>${s}</li>`).join("")}</ol>`
      : "";
  let result = "";
  if (ui.intake.result) {
    const ro = S.obligations.find((x) => x.id === ui.intake.result.oid);
    result = `<div class="result ${ui.intake.result.ok ? "ok" : "no"}" role="status">
      <b>${ui.intake.result.ok ? "Pass" : "Fail"}</b> · ${esc(ui.intake.fileName)} · ${esc(venueMeta(ui.intake.venue).name)}<br>
      Matched ${ro.id}: ${esc(ro.text)}<br>
      Extracted value <b>${showVal(ro, ui.intake.result.val)}</b> against criterion <b>${esc(critText(ro))}</b>.</div>
    <div class="flex" style="margin-top:12px"><button class="primary" id="evAddBtn" ${ui.intake.added ? "disabled" : ""}>${ui.intake.added ? "Added as evidence ✓" : "Add as evidence"}</button><button class="ghost" id="evIntakeReset">Start over</button></div>
    ${ui.intake.added ? `<p class="muted" style="font-size:12.5px;margin:10px 0 0">The evidence is now in the register: it has updated the obligation state, any corrective action, and the readiness and gate calculations.</p>` : ""}`;
  }
  return `<div class="panel" id="evIntake"><div class="eyebrow">Evidence intake · PoC simulation</div><h3>Submit evidence against a requirement</h3>
  <p class="muted" style="margin:0 0 14px;font-size:13.5px">No backend and no real upload: the document is read in the browser and the extraction is simulated. The result, however, is real: adding it updates the live register, corrective actions, readiness and gates. Tip: include “fail” in the file name to simulate failing evidence.</p>
<div class="formrow evidence-fields">

  <label class="f" for="evVenueSel">
    Venue
    <select id="evVenueSel">
      ${VENUES.map(
        (v) => `
        <option
          value="${v.id}"
          ${v.id === ui.intake.venue ? "selected" : ""}
        >
          ${esc(v.name)}
        </option>
      `,
      ).join("")}
    </select>
  </label>

  <label class="f" for="evTargetSel">
    Obligation or corrective action
    <select id="evTargetSel">
      <option value="">Choose…</option>

      ${
        iss.length
          ? `
        <optgroup label="Open corrective actions">
          ${iss
            .map(
              (i) => `
            <option
              value="iss:${i.id}"
              ${ui.intake.target === "iss:" + i.id ? "selected" : ""}
            >
              ${i.id} · ${esc(i.title)}
            </option>
          `,
            )
            .join("")}
        </optgroup>
      `
          : ""
      }

      <optgroup label="Obligations">
        ${obls
          .map(
            (x) => `
          <option
            value="obl:${x.id}"
            ${ui.intake.target === "obl:" + x.id ? "selected" : ""}
          >
            ${x.code} · ${esc(x.text)}
          </option>
        `,
          )
          .join("")}
      </optgroup>

    </select>
  </label>

  <label class="f" for="evTypeSel">
    Evidence type
    <select id="evTypeSel">
      ${EV_TYPES.map(
        ([t], i) => `
        <option
          value="${i}"
          ${i === ui.intake.etype ? "selected" : ""}
        >
          ${t}
        </option>
      `,
      ).join("")}
    </select>
  </label>

</div>
  ${o ? `<div class="criterion" style="margin-top:12px">${esc(critText(o))}</div>` : ""}
  <div class="dropzone${ui.intake.fileName ? " has" : ""}" id="evDrop" role="button" tabindex="0" aria-label="Choose or drop a document">
    <input type="file" id="evUpFile" hidden>
    ${ui.intake.fileName ? `<b>${esc(ui.intake.fileName)}</b><span>Click to choose a different document</span>` : `<b>Drop a document here</b><span>or click to choose a file · nothing is uploaded</span>`}
  </div>
  <div class="flex" style="margin-top:40px"><button class="primary" id="evProcess" ${ui.intake.running ? "disabled" : ""}>${ui.intake.running ? "Processing…" : "Process document"}</button></div>
  ${steps}${result}</div>`;
}
export function viewRequirements() {
  return (
    headV(
      "Compliance intake · intake PoC",
      "Compliance intake",
      "Requirements enter the system on the right; evidence proving or disproving them enters on the left. Both feed the same live register, so what happens here changes readiness, corrective actions and gates everywhere else.",
    ) +
    `
  <div class="grid req-cols">${evidenceIntakePanel()}${requirementIntakePanel()}</div>
  ${changeSection()}`
  );
}
export function decoAdd() {
  const v = venueMeta(ui.decoVenue);
  let n = 0;
  ui.decoOut.forEach((d, i) => {
    if (!d.keep) return;
    n++;
    const code = `NEW-${String(S.seq++).padStart(2, "0")}`;
    const o = {
      code,
      family: d.fam,
      clause: `Pasted clause §${d.ref}`,
      text: d.text,
      op: d.op,
      value: d.value,
      unit: d.unit,
      crit: d.crit,
      gate: "G4",
      owner: "To be assigned",
      id: `${v.id}-${code}`,
      venue: v.id,
      evidence: [],
      state: "Assigned",
      claim: false,
    };
    S.obligations.push(o);
    log("Compliance office", "Obligation created from decomposed clause", o.id);
  });
  save();
  ui.filters = { venue: v.id, family: "all", state: "Assigned", q: "" };
  goView("register");
  toast(`${n} obligations added to ${v.name}.`);
}
