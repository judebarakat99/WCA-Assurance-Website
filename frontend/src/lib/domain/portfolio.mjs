// National portfolio: one row per stadium combining requirement assurance
// (assessments) with delivery progress (Intake progress checks), plus the
// headline figures. Everything is derived from data the app already holds.
import { assuranceMap } from "@/lib/domain/cityAssurance.mjs";
import { scheduleSlipDays } from "@/lib/domain/progressCheck.mjs";
import { reviewQueue } from "@/lib/domain/reviewQueue.mjs";

/** Slip within this many days counts as on track. */
export const ON_TRACK_DAYS = 7;
/** Slip beyond this many days is critical. */
export const CRITICAL_DAYS = 30;
/** Stadiums due within this many years of now are "near term". */
export const HORIZON_YEARS = 2;

/**
 * Risk is about time and problems, not how much has been reviewed yet:
 * critical (bad): an overstated progress claim, slip over CRITICAL_DAYS, or a
 *   non-compliant requirement on a near-term stadium;
 * at risk (warn): any other non-compliance, slip over ON_TRACK_DAYS, evidence
 *   failing its check, an unsupported claim, or under half assured when near term;
 * on track (good): reviewed with none of these; not started (mute): nothing reviewed.
 */
function riskOf({ overstated, sched, issues, nearTerm, readiness, reviewed, claimOpen }) {
  if (overstated || sched.tone === "bad" || (nearTerm && issues.nonCompliant)) return "bad";
  if (issues.nonCompliant || sched.tone === "warn" || issues.failing || claimOpen || (nearTerm && reviewed && readiness < 0.5))
    return "warn";
  return reviewed || sched.tone === "good" ? "good" : "mute";
}

const RANK = { bad: 0, warn: 1, good: 2, mute: 3 };
const worst = (...tones) => tones.filter(Boolean).sort((a, b) => RANK[a] - RANK[b])[0] || "mute";

export const STAGE_LABEL = {
  planned: "Design",
  "under-construction": "Construction",
  "existing-refurbishment": "Refurbishment",
};

function schedule(check) {
  if (!check) return { days: null, tone: null, label: "No plan on file" };
  const days = scheduleSlipDays(check);
  if (days == null) return { days, tone: null, label: "No plan on file" };
  if (days <= ON_TRACK_DAYS) return { days, tone: "good", label: days < -ON_TRACK_DAYS ? `${-days} days ahead` : "On track" };
  return { days, tone: days > CRITICAL_DAYS ? "bad" : "warn", label: `+${days} days` };
}

/**
 * records: assessments; checks: Intake progress checks by stadium id;
 * category: requirement area (null for all); now: the current year.
 */
export function portfolio(records, checks = {}, category = null, now = new Date().getFullYear()) {
  const map = assuranceMap(records, category);
  const horizon = now + HORIZON_YEARS;
  const failing = {};
  for (const item of reviewQueue(records, { category })) {
    if (item.reason === "fail") failing[item.stadium.id] = (failing[item.stadium.id] || 0) + 1;
  }
  const rows = map.cities.flatMap((city) =>
    city.stadiums.map((s) => {
      const a = s.assurance;
      const reviewed = a.compliant + a["non-compliant"] > 0;
      const check = checks[s.id] || null;
      const sched = schedule(check);
      const claimOpen = !!check && !check.decision && ["overstated", "evidence-missing"].includes(check.status);
      const overstated = check?.status === "overstated";
      const issues = {
        nonCompliant: a["non-compliant"],
        failing: failing[s.id] || 0,
        claims: claimOpen ? 1 : 0,
      };
      issues.total = issues.nonCompliant + issues.failing + issues.claims;
      return {
        id: s.id,
        name: s.name,
        cityId: city.id,
        city: city.name,
        due: s.completionYear,
        stage: STAGE_LABEL[s.status] || s.status,
        readiness: reviewed ? a.assured : null,
        coverage: a.coverage,
        assuranceTone: s.tone,
        schedule: sched,
        check,
        overstated,
        issues,
        nearTerm: s.completionYear <= horizon,
        risk: riskOf({
          overstated,
          sched,
          issues,
          nearTerm: s.completionYear <= horizon,
          readiness: a.assured,
          reviewed,
          claimOpen,
        }),
      };
    }),
  );
  rows.sort((x, y) => RANK[x.risk] - RANK[y.risk] || x.due - y.due || x.name.localeCompare(y.name));
  const atRisk = rows.filter((r) => r.risk === "bad" || r.risk === "warn");
  const cities = map.cities.map((c) => {
    const own = rows.filter((r) => r.cityId === c.id);
    return { id: c.id, name: c.name, coordinates: c.coordinates, count: own.length, risk: worst(...own.map((r) => r.risk)) };
  });
  return {
    rows,
    cities,
    kpis: {
      compliance: { assured: map.programme.assured, coverage: map.programme.coverage, reviewed: map.programme.compliant + map.programme["non-compliant"] > 0 },
      atRisk: { count: atRisk.length, total: rows.length, critical: rows.filter((r) => r.risk === "bad").length },
      issues: {
        total: rows.reduce((t, r) => t + r.issues.total, 0),
        nonCompliant: rows.reduce((t, r) => t + r.issues.nonCompliant, 0),
        awaiting: rows.reduce((t, r) => t + r.issues.failing + r.issues.claims, 0),
      },
      milestones: {
        count: atRisk.filter((r) => r.due <= horizon).length,
        due: rows.filter((r) => r.due <= horizon).length,
        horizon,
      },
    },
  };
}
