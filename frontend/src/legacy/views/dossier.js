// ---------- Dossiers page view ----------
import {
  GATES,
  VENUES,
  esc,
  fmtN,
  fmtD,
  pct,
  critText,
  showVal,
  venueMeta,
  stateCls,
} from "@/lib/domain/data";
import { S, ui } from "@/lib/store/state";
import { scores, oblsOf, venueState, isProven } from "@/lib/domain/scoring";
import { segV, legV, ringV, hbV, stP, headV } from "@/legacy/views/shared";

export function viewDossier() {
  const m = venueMeta(ui.dossierVenue),
    list = oblsOf(m.id),
    sc = scores(list),
    v = venueState(m.id);
  const fams = [...new Set(list.map((o) => o.family))];
  const ready = list.filter(isProven).length,
    nIss = S.issues.filter(
      (i) => i.status === "Open" && list.some((o) => o.id === i.obl),
    ).length;
  const fam = fams.map((f) => {
      const L = list.filter((o) => o.family === f);
      return { f, n: L.length, p: L.filter(isProven).length };
    }),
    fmx = Math.max(1, ...fam.map((x) => x.n));
  const P = stP(list);
  const summary = `<div class="dsum"><div class="dsum-r">${ringV(
    [
      { n: sc.assured, c: "var(--brand-deep)" },
      { n: Math.max(1 - sc.assured, 0), c: "var(--sunk)" },
    ],
    pct(sc.assured) + "%",
    "assured",
    "lg",
  )}</div>
    <div class="dsum-m"><div class="mini-grid"><div class="mini good"><b>${ready}/${list.length}</b><span>evidence-backed</span></div><div class="mini ${nIss ? "bad" : "good"}"><b>${nIss}</b><span>open issues</span></div></div>${segV(P)}${legV(P)}</div>
    <div class="dsum-f"><div class="eyebrow">By requirement family</div><div class="hbs">${fam
      .map((x) =>
        hbV(
          esc(x.f),
          [
            { n: x.p, k: "good" },
            { n: x.n - x.p, k: "oth" },
          ],
          `${x.p}/${x.n}`,
          x.n,
        ),
      )
      .join("")}</div></div></div>`;
  return (
    headV(
      `Inspection dossier · ${esc(m.name)}`,
      "FIFA inspection dossier",
      "Generated from validated evidence and the audit trail, in requirement order. Nothing in it is self-declared.",
    ) +
    `
  <div class="ui.filters"><select id="dvSel" aria-label="Venue">${VENUES.map((x) => `<option value="${x.id}" ${x.id === m.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select><button id="copyDossier">Copy as text</button></div>
  <article class="dossier" id="dossierDoc">
    <div class="stamp">COMPLIANCE DOSSIER · GENERATED ${fmtD(S.today).toUpperCase()} · SAMPLE DATA</div>
    <h2 style="margin-top:6px">${esc(m.name)}, ${esc(m.city)}</h2>
    <p class="muted" style="margin:0">${esc(m.type)}${m.role ? " · " + esc(m.role) : ""}${m.capacity ? ` · planned capacity about ${fmtN(m.capacity)}` : ""} · next gate ${v.gateIdx < GATES.length ? GATES[v.gateIdx].id + " " + GATES[v.gateIdx].name : "none"}</p>
    ${summary}
    ${fams
      .map(
        (f) =>
          `<h3>${esc(f)}</h3><div class="tablewrap"><table><thead><tr><th>Ref</th><th>Requirement</th><th>Criterion (illustrative)</th><th>Evidence</th><th>Result</th></tr></thead><tbody>${list
            .filter((o) => o.family === f)
            .map((o) => {
              const e = o.evidence[o.evidence.length - 1];
              return `<tr><td class="mono">${o.code}<div class="muted">${esc(o.clause)}</div></td><td>${esc(o.text)}</td><td class="mono">${esc(o.op === "bool" ? "yes" : { min: "≥ ", max: "≤ ", eq: "= " }[o.op] + fmtN(o.value) + " " + o.unit)}</td><td>${e ? `${esc(e.file)}<div class="muted" style="font-size:12px">${esc(e.issuer)} · ${fmtD(e.date)} · ${showVal(o, e.value)}</div>` : `<span class="muted">No evidence</span>`}</td><td><span class="pill ${stateCls(o.state)}">${o.state}</span>${o.verifiedBy ? `<div class="muted" style="font-size:11.5px">${esc(o.verifiedBy)}</div>` : ""}</td></tr>`;
            })
            .join("")}</tbody></table></div>`,
      )
      .join("")}
    <h3>Audit trail</h3><div class="tl">${S.audit
      .filter((a) => a.obl && a.obl.startsWith(m.id + "-"))
      .slice(-12)
      .reverse()
      .map(
        (a) =>
          `<div class="tli mid"><i></i><div><span class="mono muted">${fmtD(a.t)}</span><div>${esc(a.obl)}: <b>${esc(a.actor)}</b> ${esc(a.action)}</div></div></div>`,
      )
      .join("")}</div>
  </article>`
  );
}
export function dossierText() {
  const m = venueMeta(ui.dossierVenue),
    list = oblsOf(m.id),
    sc = scores(list);
  return [
    `COMPLIANCE DOSSIER: ${m.name}, ${m.city} (sample data)`,
    `Generated ${fmtD(S.today)} · assured readiness ${pct(sc.assured)}%`,
    "",
  ]
    .concat(
      list.map((o) => {
        const e = o.evidence[o.evidence.length - 1];
        return `${o.code} [${o.state}] ${o.text} | ${critText(o)} | ${e ? e.file + " (" + showVal(o, e.value) + ")" : "no evidence"}`;
      }),
    )
    .join("\n");
}
