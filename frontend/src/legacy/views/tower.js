// ---------- Control Tower page view ----------
import {
  GATES,
  LEVELS,
  VENUES,
  esc,
  fmtD,
  pct,
  sn,
  dd,
  daysBetween,
  venueMeta,
} from "@/lib/domain/data";
import { S, ui, rerender, goView } from "@/lib/store/state";
import {
  scores,
  oblsOf,
  venueState,
  gateEval,
  isProven,
} from "@/lib/domain/scoring";
import { forecasts, projection } from "@/lib/domain/forecast";
import { segV, legV, ringV, barV, stP, gdotsV, headV, kpiV } from "@/legacy/views/shared";

export function viewTower() {
  const all = S.obligations,
    sc = scores(all);
  const open = S.issues.filter((i) => i.status === "Open"),
    overdue = open.filter((i) => S.today > i.due);
  const rej = all.filter((o) => o.state === "Rejected").length,
    pend = all.filter((o) => o.state === "Submitted").length,
    ver = all.filter((o) => o.state === "Verified").length;
  const lvC = LEVELS.map((_, l) => open.filter((i) => i.level === l).length),
    lvCols = ["var(--mint)", "var(--warn)", "var(--bad)", "var(--brand-deep)"];
  const dual = (a, d) =>
    `<div class="dual"><i class="d" style="width:${pct(d)}%"></i><i class="a" style="width:${pct(a)}%"></i></div>`;
  const tile = (k, v, body, n, c) =>
    `<div class="tile ${c || ""}"><div class="k">${k}</div><div class="v">${v}</div>${body || ""}<div class="n">${n}</div></div>`;
  const tiles = [
    tile(
      "Assured readiness",
      pct(sc.assured) + "%",
      barV(pct(sc.assured), "p-good"),
      "weighted by criticality",
    ),
    tile(
      "Declared by owners",
      pct(sc.declared) + "%",
      dual(sc.assured, sc.declared),
      `assurance gap <b>${pct(sc.declared - sc.assured)} pts</b>`,
      "warn",
    ),
    tile(
      "Obligations",
      all.length,
      segV(stP(all)),
      `${ver} verified · ${pend} awaiting validation`,
    ),
    tile(
      "Evidence rejected",
      rej,
      barV((rej / Math.max(1, all.length)) * 100, "p-bad"),
      "failed the acceptance criterion",
      rej ? "alert" : "",
    ),
    tile(
      "Open issues",
      open.length,
      segV(
        lvC.map((n, i) => ({ n, c: lvCols[i], l: LEVELS[i].toLowerCase() })),
      ),
      `${overdue.length} past SLA`,
      overdue.length ? "alert" : "",
    ),
  ].join("");
  const cards = VENUES.map((m) => {
    const list = oblsOf(m.id),
      s = scores(list),
      p = projection(m.id),
      v = venueState(m.id);
    const g = v.gateIdx < GATES.length ? GATES[v.gateIdx] : null;
    const iss = open.filter((i) => list.some((o) => o.id === i.obl)).length;
    const ge = gateEval(m.id);
    const blockers = ge
      ? [
          ...new Set(
            ge.rules
              .filter((r) => !r.ok)
              .flatMap((r) => r.blockers)
              .filter((o) => o && o.crit === "Critical")
              .map((o) => o.id),
          ),
        ]
      : [];
    const gap = pct(s.declared - s.assured),
      days = g ? daysBetween(S.today, v.gateDate) : 0;
    const ring = ringV(
      [
        { n: s.assured, c: "var(--brand-deep)" },
        {
          n: Math.max(s.declared - s.assured, 0),
          c: "color-mix(in srgb,var(--warn) 55%,var(--surface))",
        },
        {
          n: Math.max(1 - Math.max(s.declared, s.assured), 0),
          c: "var(--sunk)",
        },
      ],
      pct(s.assured) + "%",
      "assured",
      "sm",
    );
    return `<article class="venue">
      <div class="head"><div style="min-width:0"><div class="name">${esc(m.name)}</div><div class="meta">${esc(m.city)} · ${esc(m.type)}${m.role ? " · " + esc(m.role) : ""}</div></div><span class="pill ${p.cls}">${p.status}</span></div>
      <div class="vbody">${ring}<div class="vside">
        <div class="vline"><span>Declared by owners</span><b>${pct(s.declared)}%</b></div>
        <div class="vline"><span>Assurance gap</span><span class="pill ${gap >= 15 ? "p-bad" : gap >= 5 ? "p-warn" : "p-good"}">${gap} pts</span></div>
        <div class="vline"><span>Obligations proven</span><b>${list.filter(isProven).length}/${list.length}</b></div></div></div>
      <div class="vgate">${gdotsV(v.gateIdx)}<div class="vg-t">${g ? `<b>${g.id} ${esc(g.name)}</b><span>${fmtD(v.gateDate)} · ${days < 0 ? dd(days) + " overdue" : dd(days) + " to go"}${p.f ? ` · P80 ${fmtD(p.f.d80)}` : ""}</span>` : `<b>All gates passed</b>`}</div></div>
      <div class="flex"><span class="pill ${iss ? "p-bad" : "p-mute"}">${iss} open issue${iss === 1 ? "" : "s"}</span>${blockers.length ? `<span class="pill p-bad">${blockers.length} critical blocker${blockers.length === 1 ? "" : "s"}</span>` : ""}<span class="spacer"></span><button class="linkish" data-goto="register" data-venue="${m.id}">Obligations</button><button class="linkish" data-goto="gates" data-venue="${m.id}">Gate check</button></div>
      <div class="vmore"><button class="vdetail-btn" data-venue-detail="${m.id}">View stadium details →</button></div>
    </article>`;
  }).join("");
  const SCN = [
    [
      "green",
      "Evidence",
      "The green that was red",
      "Jeddah's new floodlighting is declared complete. Run validation and watch the status change.",
      "",
    ],
    [
      "gate",
      "Gate",
      "The gate holds",
      "Jeddah asks to pass Construction complete. See every blocker listed.",
      "t2",
    ],
    [
      "camp",
      "Dependency",
      "Base camp at risk",
      "A hotel shortfall blocks private training. Trace the dependency.",
      "t3",
    ],
    [
      "change",
      "Change",
      "FIFA changes the rules",
      "Simulate a floodlight update and see which venues flip from compliant to failing.",
      "t4",
    ],
    [
      "dossier",
      "Inspection",
      "Inspection tomorrow",
      "Generate Al Khobar's inspection dossier in one step.",
      "",
    ],
  ];
  const scn =
    SCN.map(
      ([d, tag, t, x, c], i) =>
        `<article class="scn-card ${c}"><div class="scn-top"><span class="n">0${i + 1}</span><span class="pill p-mute">${tag}</span></div><b>${t}</b><p>${x}</p><button data-demo="${d}">Open scenario</button></article>`,
    ).join("") +
    `<article class="scn-card t4"><div class="scn-top"><span class="n">06</span><span class="pill p-mute">3D design</span></div><b>Design check in 3D</b><p>King Salman International Stadium's design is checked before it is built.</p><button data-goto="twin">Open 3D twin</button></article>`;
  const act = S.audit
    .slice(-6)
    .reverse()
    .map((a) => {
      const c = /rejected|refused|no longer|escalat/i.test(a.action)
        ? "bad"
        : /Verified|validated|passed/i.test(a.action)
          ? "good"
          : "mid";
      return `<div class="tli ${c}"><i></i><div><span class="mono muted">${fmtD(a.t)}</span><div><b>${esc(a.actor)}</b> ${esc(a.action)}${a.obl ? ` · <button class="linkish" data-obl="${a.obl}">${esc(a.obl)}</button>` : ""}</div></div></div>`;
    })
    .join("");
  return (
    headV(
      `Control tower · ${VENUES.length} venues and base camps · ${all.length} obligations`,
      "Programme readiness",
      "Assured readiness counts only obligations backed by validated evidence. The gap to what owners declare is the risk a status report would hide.",
    ) +
    `
  <section class="hero ct-summary" aria-label="Programme summary"><div class="grid tiles">${tiles}</div></section>
  <section class="block"><div class="block-head"><div><div class="eyebrow">Where we stand</div><h3>Venues and base camps</h3></div><div class="legend"><span><i style="background:var(--brand-deep)"></i>Assured</span><span><i style="background:color-mix(in srgb,var(--warn) 55%,var(--surface))"></i>Declared, not yet proven</span></div></div>
    <div class="grid venues">${cards}</div></section>`
  );
}

export function intakeCard() {
  const W = typeof window !== "undefined" ? window.WNSTwin : null;
  if (!W)
    return `<div class="panel intake-card" id="intakeCard"><div class="eyebrow">3D design review</div><h3>Design intake</h3><p class="muted" style="margin:0 0 18px;font-size:13px">King Salman International Stadium, Riyadh · simulated</p><p class="muted" style="font-size:13px">Loading the 3D design engine…</p></div>`;
  const s = W.summary();
  const steps = Array.from(
    { length: 7 },
    (_, i) =>
      `<i class="${i < s.step ? "done" : i === s.step ? "cur" : ""}"></i>`,
  ).join("");
  const pass = Math.max(0, s.checked - s.open);
  const checks = s.checked
    ? `${segV([
        { n: pass, c: "var(--good)", l: "pass" },
        { n: s.open, c: "var(--bad)", l: "open" },
      ])}${legV([
        { n: pass, c: "var(--good)", l: "pass" },
        { n: s.open, c: "var(--bad)", l: "open" },
      ])}`
    : `<div class="muted" style="font-size:13px">Checks not run yet</div>`;
  return `<div class="panel intake-card" id="intakeCard"><div class="eyebrow">3D design review</div><h3>Design intake</h3><p class="muted" style="margin:0 0 18px;font-size:13px">King Salman International Stadium, Riyadh · simulated</p>
  <div class="ik-top"><div class="ik-rev"><span>Model</span><b>Rev ${s.rev}</b></div><div class="ik-rev"><span>G1 Design freeze</span><span class="pill ${s.gate.cls}">${esc(s.gate.t)}</span></div></div>
  <div class="ik-steps"><div class="ik-l"><span>Step ${s.step + 1} of 7</span><b>${esc(s.stepName)}</b></div><div class="ik-dots">${steps}</div></div>
  <div class="ik-checks"><div class="ik-l"><span>Design checks</span><b>${s.checked ? `${pass} of 9 pass` : "–"}</b></div>${checks}</div>
  <div class="flex" style="margin-top:22px"><button class="primary" data-goto="twin">Open 3D twin</button><button class="linkish" data-goto="register" data-venue="RUH">Venue obligations</button></div></div>`;
}
