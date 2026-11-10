// ---------- Decisions & Actions page view ----------
import { DECISIONS, SLA } from "@/lib/domain/data";
import { S } from "@/lib/store/state";
import { forecasts } from "@/lib/domain/forecast";
import { decRec } from "@/lib/domain/actions";
import { headV, issueCardV, ladderV, decisionCardV } from "@/legacy/views/shared";

export function viewActions() {
  const f = forecasts();
  const nOpenD = DECISIONS.filter((d) => decRec(d.id).status === "Open").length;
  const open = S.issues.filter((i) => i.status === "Open"),
    closed = S.issues.filter((i) => i.status !== "Open");
  const late = open.filter((i) => S.today > i.due).length;
  const decCards = DECISIONS.map((d) => decisionCardV(d, f)).join("");
  return (
    headV(
      `Decisions & actions · ${nOpenD} decisions open · ${open.length} actions open · ${late} past SLA`,
      "Decisions & actions",
      "Everything waiting on the programme in one place: executive decisions with their last responsible moments, then the corrective actions and escalations the rule engine is driving. Taking a decision re-runs the forecast at once; an action closes only when new evidence passes validation.",
    ) +
    `
  <section class="block"><div class="block-head"><div><div class="eyebrow">Executive decisions</div><h3>Decision log · ${nOpenD} open · ${DECISIONS.length - nOpenD} decided</h3></div></div>
    <p class="muted" style="margin:0 0 16px;max-width:84ch;font-size:13.5px">Each decision carries its last responsible moment: the latest date it can be taken before options start to close. Taking one re-runs the forecast at once, so the effect on P80 is visible in the room.</p>
    <div class="grid decs">${decCards}</div></section>
  <section class="block"><div class="block-head"><div><div class="eyebrow">Corrective actions</div><h3>Open issues · SLA status</h3></div></div>
    <p class="muted" style="margin:0 0 16px;max-width:84ch;font-size:13.5px">Every failed check opens a corrective action with an SLA set by criticality (Critical ${SLA.Critical} days, High ${SLA.High}, Medium ${SLA.Medium}). A missed SLA climbs the ladder. An issue closes only when new evidence passes validation.</p>
    ${open.length ? `<div class="grid issues">${open.map(issueCardV).join("")}</div>` : `<div class="panel"><div class="okbig"><i>✓</i><span>No open issues</span></div></div>`}</section>
  <section class="block"><div class="block-head"><div><div class="eyebrow">Escalation ladder</div><h3>Where open actions sit</h3></div></div>${ladderV(open)}</section>
  ${closed.length ? `<section class="block"><div class="block-head"><div><div class="eyebrow">Resolved</div><h3>Closed by evidence</h3></div></div><div class="grid issues">${closed.map(issueCardV).join("")}</div></section>` : ""}`
  );
}
