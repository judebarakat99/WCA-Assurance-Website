// Project progress: delivery schedule, progress and cost per stadium, from the
// sample programme data (data/progress/programme.json). Where a progress check
// exists (Evidence page), its recalculated figure replaces the reported one.
// Forecasts use earned schedule (time) and earned value (cost).
import PROGRAMME from "../../../../data/progress/programme.json" with { type: "json" };
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";
import { scheduleSlipDays } from "@/lib/domain/progressCheck.mjs";

export { PROGRAMME };

const DAY = 86_400_000;
const ms = (iso) => Date.parse(`${iso}T00:00:00Z`);
export const isoDay = (t) => new Date(t).toISOString().slice(0, 10);
const addDays = (iso, n) => isoDay(ms(iso) + Math.round(n) * DAY);
const daysBetween = (a, b) => Math.round((ms(b) - ms(a)) / DAY);
const round1 = (v) => Math.round(v * 10) / 10;

/** Slip within this many days is on track; beyond LATE_DAYS it is late. */
export const ON_TRACK_DAYS = 30;
export const LATE_DAYS = 60;
/** Below this progress (planned and actual) it is too early to forecast the finish. */
const EARLY = 10;
/** Below this actual progress cost performance is not yet meaningful. */
const EARLY_COST = 5;

/** Planned cumulative progress (0-100) at a share of the duration: a gentle S-curve. */
export const sCurve = (x) => (x <= 0 ? 0 : x >= 1 ? 100 : 100 * (0.5 * x + 0.5 * x * x * (3 - 2 * x)));

/** The share of the duration at which the S-curve reaches p percent. */
function sCurveInverse(p) {
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (sCurve(mid) < p) lo = mid;
    else hi = mid;
  }
  return hi;
}

export const STATUS = {
  "not-started": { tone: "mute", label: "Not started" },
  early: { tone: "mute", label: "Too early to forecast" },
  "on-track": { tone: "good", label: "On track" },
  "at-risk": { tone: "warn", label: "At risk" },
  late: { tone: "bad", label: "Late" },
  "misses-deadline": { tone: "bad", label: "Misses FIFA deadline" },
};

export const costTone = (cpi) => (cpi == null ? "mute" : cpi >= 0.98 ? "good" : cpi >= 0.9 ? "warn" : "bad");

/** One stadium's delivery row. check: its latest progress check, if any. */
export function deliveryRow(stadium, plan, check, asOf = PROGRAMME.asOf, deadline = PROGRAMME.milestones[0]?.date) {
  const duration = daysBetween(plan.start, plan.finish);
  const elapsed = Math.max(0, daysBetween(plan.start, asOf));
  const verified = !!check;
  const actual = verified ? check.recalculated : plan.reported;
  const planned = verified ? check.planned : round1(sCurve(elapsed / duration));
  let slip = null;
  let forecast = plan.finish;
  let status;
  if (elapsed <= 0) status = "not-started";
  else if (actual < EARLY && planned < EARLY) status = "early";
  else {
    // Earned schedule: the time at which the plan called for today's progress.
    const plansSlip = verified ? scheduleSlipDays(check) : null;
    const earned = plansSlip != null ? elapsed - plansSlip : sCurveInverse(actual) * duration;
    slip = Math.round(elapsed - earned);
    // Assumes the remaining work goes to plan: the finish moves by today's slip.
    forecast = addDays(plan.finish, Math.max(slip, 0));
    const late = daysBetween(plan.finish, forecast);
    status =
      deadline && forecast > deadline
        ? "misses-deadline"
        : late > LATE_DAYS
          ? "late"
          : late > ON_TRACK_DAYS
            ? "at-risk"
            : "on-track";
  }
  const earnedValue = (plan.budget * actual) / 100;
  const plannedValue = (plan.budget * planned) / 100;
  const cpi = plan.spent > 0 && actual >= EARLY_COST ? Math.round((earnedValue / plan.spent) * 100) / 100 : null;
  const eac = cpi ? Math.round(plan.budget / cpi) : plan.budget;
  return {
    id: stadium.id,
    name: stadium.name,
    cityId: stadium.cityId,
    phase: plan.phase,
    start: plan.start,
    finish: plan.finish,
    forecast,
    late: daysBetween(plan.finish, forecast),
    slip,
    status,
    actual,
    planned,
    reported: plan.reported,
    verified,
    checkStatus: check?.status || null,
    budget: plan.budget,
    spent: plan.spent,
    earnedValue: Math.round(earnedValue),
    plannedValue: Math.round(plannedValue),
    cpi,
    eac,
    overrun: eac - plan.budget,
    packages: (check?.packages || [])
      .filter((p) => p.activities?.length)
      .map((p) => ({
        element: p.element,
        name: p.name,
        start: p.activities.reduce((m, a) => (a.start < m ? a.start : m), p.activities[0].start),
        finish: p.activities.reduce((m, a) => (a.finish > m ? a.finish : m), p.activities[0].finish),
        actual: p.actual,
        planned: p.planned,
        claimed: p.claimed,
        status: p.status,
      })),
  };
}

/** Every stadium's row plus programme totals. checks: progress checks by stadium id. */
export function delivery(checks = {}, asOf = PROGRAMME.asOf) {
  const cities = Object.fromEntries(FACILITY_REGISTER.hostCities.map((c) => [c.id, c.name]));
  const rows = FACILITY_REGISTER.stadiums
    .filter((s) => PROGRAMME.stadiums[s.id])
    .map((s) => ({
      ...deliveryRow(s, PROGRAMME.stadiums[s.id], checks[s.id] || null, asOf),
      city: cities[s.cityId] || s.cityId,
    }));
  const sum = (k) => rows.reduce((t, r) => t + r[k], 0);
  const budget = sum("budget");
  const spent = sum("spent");
  const earnedValue = sum("earnedValue");
  const plannedValue = sum("plannedValue");
  const measured = rows.filter((r) => r.cpi != null);
  const measuredEv = measured.reduce((t, r) => t + r.earnedValue, 0);
  const measuredAc = measured.reduce((t, r) => t + r.spent, 0);
  const next = isoDay(ms(asOf) + 365 * DAY);
  return {
    asOf,
    rows,
    milestones: PROGRAMME.milestones,
    totals: {
      budget,
      spent,
      earnedValue,
      plannedValue,
      actual: round1((100 * earnedValue) / budget),
      planned: round1((100 * plannedValue) / budget),
      spi: plannedValue ? Math.round((earnedValue / plannedValue) * 100) / 100 : null,
      cpi: measuredAc ? Math.round((measuredEv / measuredAc) * 100) / 100 : null,
      overrun: rows.reduce((t, r) => t + Math.max(r.overrun, 0), 0),
      overBudget: rows.filter((r) => r.overrun > 0).length,
      late: rows.filter((r) => ["late", "misses-deadline"].includes(r.status)).length,
      atRisk: rows.filter((r) => r.status === "at-risk").length,
      verified: rows.filter((r) => r.verified).length,
      handovers: rows.filter((r) => r.finish > asOf && r.finish <= next),
      next,
    },
  };
}
