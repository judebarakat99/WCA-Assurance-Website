// ---------- Obligation register (Control Tower subpage) ----------
import { VENUES, esc } from "@/lib/domain/data";
import { S, ui } from "@/lib/store/state";
import { isProven } from "@/lib/domain/scoring";
import { segV, legV, ringV, hbV, stP, headV, crumbV, oblRowsV } from "@/legacy/views/shared";
import { pct } from "@/lib/domain/data";

export function viewRegister() {
  const fams = [...new Set(S.obligations.map((o) => o.family))];
  let list = S.obligations.filter(
    (o) =>
      (ui.filters.venue === "all" || o.venue === ui.filters.venue) &&
      (ui.filters.family === "all" || o.family === ui.filters.family) &&
      (ui.filters.state === "all" || o.state === ui.filters.state) &&
      (!ui.filters.q ||
        (o.text + o.id + o.owner)
          .toLowerCase()
          .includes(ui.filters.q.toLowerCase())),
  );
  const opt = (arr, cur) =>
    arr
      .map(
        ([v, l]) =>
          `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(l)}</option>`,
      )
      .join("");
  const proven = list.filter(isProven).length,
    P = stP(list);
  const cr = ["Critical", "High", "Medium"].map((c) => {
      const L = list.filter((o) => o.crit === c);
      return { c, n: L.length, p: L.filter(isProven).length };
    }),
    mx = Math.max(1, ...cr.map((x) => x.n));
  const summary = `<div class="sumrow">
    <div class="sumcard"><div class="eyebrow">In view</div><div class="v3">${ringV(
      [
        { n: proven, c: "var(--brand-deep)" },
        { n: Math.max(list.length - proven, 0), c: "var(--sunk)" },
      ],
      `${proven}/${list.length}`,
      "proven",
      "sm",
    )}<div class="v3-side"><div class="kpi"><b>${list.length}</b><span>of ${S.obligations.length}<br>obligations</span></div><div class="muted" style="font-size:12.5px">${list.length ? pct(proven / list.length) + "% backed by validated evidence" : "Nothing matches these ui.filters"}</div></div></div></div>
    <div class="sumcard"><div class="eyebrow">By state</div>${segV(P)}${legV(P)}</div>
    <div class="sumcard"><div class="eyebrow">By criticality</div><div class="hbs">${cr
      .map((x) =>
        hbV(
          x.c,
          [
            { n: x.p, k: "good" },
            { n: x.n - x.p, k: "oth" },
          ],
          `${x.p}/${x.n}`,
          mx,
        ),
      )
      .join(
        "",
      )}</div><div class="leg"><span><i class="good"></i>proven</span><span><i class="oth"></i>not yet</span></div></div></div>`;
  return (
    crumbV("Obligation register") +
    headV(
      `Obligation register · ${S.obligations.length} obligations`,
      "Obligation register",
      "Each FIFA clause becomes an owned, testable obligation with a measurable acceptance criterion. Status changes only when evidence passes the rule.",
    ) +
    summary +
    `
  <div class="ui.filters">
    <select id="fVenue" aria-label="Venue">${opt([["all", "All venues"], ...VENUES.map((v) => [v.id, v.name])], ui.filters.venue)}</select>
    <select id="fFamily" aria-label="Requirement family">${opt([["all", "All families"], ...fams.map((f) => [f, f])], ui.filters.family)}</select>
    <select id="fState" aria-label="State">${opt([["all", "All states"], ...["Assigned", "Submitted", "Validated", "Verified", "Rejected"].map((s) => [s, s])], ui.filters.state)}</select>
    <input id="fQ" type="search" placeholder="Search obligations" value="${esc(ui.filters.q)}" aria-label="Search">
    <span class="muted">${list.length} shown</span>
  </div>
  <div class="tablewrap"><table><thead><tr><th>ID</th><th>Obligation</th><th>Criterion (illustrative)</th><th>Criticality</th><th>Owner</th><th>Gate</th><th>State</th></tr></thead><tbody>
  ${oblRowsV(list) || `<tr><td colspan="7" class="muted">No obligations match these ui.filters.</td></tr>`}
  </tbody></table></div>`
  );
}
