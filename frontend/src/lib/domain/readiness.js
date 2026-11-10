// Readiness Room analysis: the data behind the executive brief and the eight
// readiness questions. Pure reads of the programme model.
import { GATES, DECISIONS, EXTERNAL, REQMAT, addDays, daysBetween, decMeta, gateNum } from "@/lib/domain/data";
import { S, save, rerender } from "@/lib/store/state";
import { scores, oblsOf, venueState, gateEval, matOf, isProven } from "@/lib/domain/scoring";
import { forecast, forecasts } from "@/lib/domain/forecast";

const CRIT_RANK = { Critical: 0, High: 1, Medium: 2 };
export const byCriticality = (a, b) => CRIT_RANK[a.crit] - CRIT_RANK[b.crit];

/** Lowest on-time probability first, then the latest P80. */
export function worstForecast(f = forecasts()) {
  return f.slice().sort((a, b) => a.prob - b.prob || b.late80 - a.late80)[0];
}

/** Open executive decisions with days left, soonest first. */
export function openDecisions() {
  return S.decisions
    .filter((d) => d.status === "Open")
    .map((d) => decMeta(d.id))
    .filter(Boolean)
    .map((d) => ({ ...d, left: daysBetween(S.today, d.lrm) }))
    .sort((a, b) => a.left - b.left);
}

/** Headline figures for the executive brief. */
export function executiveBrief() {
  const f = forecasts();
  const openIssues = S.issues.filter((i) => i.status === "Open");
  const decisions = openDecisions();
  const worst = worstForecast(f);
  return {
    sc: scores(S.obligations),
    total: f.length,
    onTrack: f.filter((x) => x.late80 <= 0).length,
    worst,
    pmcConflict: Boolean(worst && worst.pmcLate <= 0 && worst.late80 > 0),
    criticalUnverified: S.obligations.filter((o) => o.crit === "Critical" && o.state !== "Verified").length,
    falseGreens: S.obligations.filter((o) => o.claim && o.state === "Rejected").length,
    unprovenClaims: S.obligations.filter((o) => o.claim && !isProven(o)).length,
    openIssues: openIssues.length,
    overdueIssues: openIssues.filter((i) => S.today > i.due).length,
    decisions,
    nextDecision: decisions[0],
  };
}

/** Q2: owner claims not proven, those overturned, and those proven on drawings only. */
export function falseGreens() {
  const claims = S.obligations.filter((o) => o.claim && !isProven(o));
  const designOnly = S.obligations.filter((o) => {
    const v = venueState(o.venue);
    if (v.gateIdx >= GATES.length) return false;
    const gn = v.gateIdx + 1;
    return gateNum(o.gate) <= gn && gn > 1 && isProven(o) && matOf(o) < REQMAT[gn - 1];
  });
  return { claims, overturned: claims.filter((o) => o.state === "Rejected"), designOnly };
}

/** Q3: the venue with the nearest gate and its whole-venue Critical/High gaps. */
export function nextInspection(f = forecasts()) {
  const next = f.slice().sort((a, b) => a.gateDays - b.gateDays)[0];
  if (!next) return null;
  const gaps = oblsOf(next.id)
    .filter((o) => o.crit !== "Medium" && o.state !== "Verified")
    .sort(byCriticality);
  return { next, evaluation: gateEval(next.id), list: oblsOf(next.id), gaps };
}

/** Q4: late venues with no decision raised. */
export function lateWithoutDecision(f = forecasts()) {
  return f.filter((x) => x.late80 > 0 && !DECISIONS.some((d) => d.venue === x.id));
}

/** Q5: the worst venue's forecast with a recovery team, unless one is already deployed. */
export function recoveryScenario(worst) {
  if (!worst || worst.late80 <= 0) return { needed: false };
  if (S.scn.recovery.includes(worst.id)) return { needed: true, deployed: true, worst };
  const alt = forecast(worst.id, { ...S.scn, recovery: [...S.scn.recovery, worst.id] });
  return { needed: true, deployed: false, worst, alt };
}

/** Q6: unproven obligations held by owners outside the programme. */
export function externalDependencies() {
  const ext = S.obligations.filter((o) => EXTERNAL.includes(o.owner) && !isProven(o));
  const byOwner = {};
  for (const o of ext) {
    const k = byOwner[o.owner] || (byOwner[o.owner] = { n: 0, c: 0 });
    k.n++;
    if (o.crit === "Critical") k.c++;
  }
  const owners = Object.entries(byOwner)
    .sort((a, b) => b[1].c - a[1].c || b[1].n - a[1].n)
    .slice(0, 4);
  return { ext, owners, critical: ext.filter((o) => o.crit === "Critical").length };
}

/** Q7: what the audit trail recorded in the last seven days. */
export function lastSevenDays() {
  const since = addDays(S.today, -7);
  const recent = S.audit.filter((a) => a.t > since);
  const escalations = S.issues.flatMap((i) => i.history.filter((h) => h.t > since && /scalat/.test(h.a))).length;
  // Collapse repeated actor + action pairs, newest first.
  const groups = [];
  for (const a of recent.slice().reverse()) {
    const key = `${a.actor}|${a.action}`;
    const g = groups.find((x) => x.key === key);
    if (g) g.n++;
    else groups.push({ key, a, n: 1 });
  }
  return {
    since,
    recent,
    escalations,
    rejections: recent.filter((a) => /rejected|no longer meets/i.test(a.action)).length,
    declarations: recent.filter((a) => /declared/i.test(a.action)).length,
    validations: recent.filter((a) => /Verified|validated/i.test(a.action)).length,
    groups: groups.slice(0, 3),
  };
}

/** Q8: owners ranked by rejections, open actions and late or escalated items. */
export function ownerSlippage() {
  const own = {};
  for (const o of S.obligations) {
    const k = own[o.owner] || (own[o.owner] = { r: 0, o: 0, l: 0 });
    if (o.state === "Rejected") k.r++;
  }
  for (const i of S.issues.filter((x) => x.status === "Open")) {
    const o = S.obligations.find((x) => x.id === i.obl);
    const k = own[o.owner];
    k.o++;
    if (S.today > i.due || i.level > 0) k.l++;
  }
  return Object.entries(own)
    .map(([n, k]) => ({ n, ...k, s: k.r * 2 + k.l * 2 + k.o }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
}

/** Change the forecast scenario (delivery rate, FIFA change risk, recovery teams). */
export function setScenario(patch) {
  S.scn = { ...S.scn, ...patch };
  save();
  rerender();
}

export function resetScenario() {
  setScenario({ prod: 1, fifa: false, recovery: [] });
}
