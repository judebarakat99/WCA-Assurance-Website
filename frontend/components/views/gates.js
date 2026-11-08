// ---------- Readiness gates (Control Tower subpage) ----------
import { VENUES } from "../../lib/data";
import { venueState, gateEval } from "../../lib/scoring";
import { segV, legV, kpiV, headV, crumbV, gateCardV } from "./shared";

export function viewGates() {
  const evs = VENUES.map((m) => ({
    m,
    v: venueState(m.id),
    e: gateEval(m.id),
  }));
  const ready = evs.filter((x) => x.e && x.e.pass).length,
    blocked = evs.filter((x) => x.e && !x.e.pass).length,
    done = evs.filter((x) => !x.e).length;
  const failing = evs.reduce(
    (a, x) => a + (x.e ? x.e.rules.filter((r) => !r.ok).length : 0),
    0,
  );
  const GP = [
    { n: ready, c: "var(--good)", l: "ready to pass" },
    { n: blocked, c: "var(--bad)", l: "blocked" },
    { n: done, c: "var(--brand-deep)", l: "all gates passed" },
  ];
  const sum = `<div class="sumrow"><div class="sumcard"><div class="eyebrow">Gate status</div>${kpiV(blocked, "venue" + (blocked === 1 ? "" : "s") + " blocked at their next gate", blocked ? "t-bad" : "t-good")}${segV(GP)}${legV(GP)}</div>
    <div class="sumcard"><div class="eyebrow">Failing rules</div>${kpiV(failing, "rule" + (failing === 1 ? "" : "s") + " failing across all venues", failing ? "t-warn" : "t-good")}<div class="muted" style="font-size:13px">Each blocked gate lists the obligations holding it back.</div></div></div>`;
  const cards = evs.map(({ m, v, e }) => gateCardV(m, v, e)).join("");
  return (
    crumbV("Readiness gates") +
    headV(
      `Readiness gates · ${ready} ready · ${blocked} blocked`,
      "Readiness gates",
      "A gate cannot pass while its rules fail. The engine lists every blocker and can escalate them in one step.",
    ) +
    sum +
    `<div class="grid">${cards}</div>`
  );
}
