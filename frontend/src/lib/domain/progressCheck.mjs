// Progress verification arithmetic and result, mirroring the backend
// (backend/app/progress_calc.py and the result assembly in app/intake.py).
// Used by the offline demo, which reads bundled sample readings instead of
// asking the model; the backend remains the reference.

export const TOLERANCE = 5;

export const ELEMENTS = {
  "pitch-turf": "Pitch and turf",
  floodlighting: "Floodlighting",
  "seating-stands": "Seating and stands",
  "broadcast-media": "Broadcast and media",
};

const DAY = 86_400_000;
const day = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY;
const round1 = (v) => Math.round(v * 10) / 10;
const num = (v) => String(v);

/** Planned completion at asOf: builds up evenly from the start day to the end of the finish day. */
export function plannedFraction(start, finish, asOf) {
  const [s, f, a] = [day(start), day(finish), day(asOf)];
  if (a < s) return 0;
  if (a >= f) return 1;
  return (a - s + 1) / (f - s + 1);
}

/** Weighted planned and actual progress (0-100) for one scope element. */
export function packageProgress(activities, asOf) {
  const weight = activities.reduce((t, a) => t + a.weight, 0);
  if (weight <= 0) throw new Error("Activity weights must add up to more than zero");
  const planned = activities.reduce((t, a) => t + a.weight * plannedFraction(a.start, a.finish, asOf), 0);
  const actual = activities.reduce((t, a) => t + (a.weight * a.actual) / 100, 0);
  return {
    planned: round1((100 * planned) / weight),
    actual: round1((100 * actual) / weight),
    activitiesDone: activities.filter((a) => a.actual >= 100).length,
    activities: activities.length,
  };
}

/** Budget-weighted roll-up of packages. */
export function overall(packages) {
  const budget = packages.reduce((t, p) => t + p.budget, 0);
  return {
    planned: round1(packages.reduce((t, p) => t + p.budget * p.planned, 0) / budget),
    actual: round1(packages.reduce((t, p) => t + p.budget * p.actual, 0) / budget),
  };
}

export function checkStatus(claimed, actual, planned, missing) {
  if (claimed != null && claimed - actual > TOLERANCE) return "overstated";
  if (missing) return "evidence-missing";
  if (planned - actual > TOLERANCE) return "behind-plan";
  return "supported";
}

function summary(r) {
  return {
    overstated: `The report claims ${num(r.claimed)}% but the detailed plans add up to ${num(r.recalculated)}%.`,
    "behind-plan": `The reported ${num(r.claimed)}% is supported by the plans (${num(r.recalculated)}%), but work is behind the ${num(r.planned)}% planned by this date.`,
    "evidence-missing": "Some reported packages have no detailed plan on file, so the claim cannot be fully checked.",
    supported: `The reported ${num(r.claimed)}% is supported by the detailed plans (${num(r.recalculated)}%).`,
  }[r.status];
}

/**
 * Check one stadium from its current filed documents and their readings.
 * stadium: { id, name, city }; report: { document, reading };
 * plans: [{ document, reading }] (one per scope element). Throws when there
 * is nothing to check, with the backend's messages.
 */
export function buildCheck(stadium, report, plans) {
  const steps = [];
  const step = (label, detail, ok = true) => steps.push({ label, detail, ok });
  if (!report) throw new Error(`No progress report is filed for ${stadium.name}.`);
  step("Found documents", `1 progress report and ${plans.length} detailed plan${plans.length === 1 ? "" : "s"} on file.`);
  const r = report.reading.data;
  step(
    "Read the progress report",
    `${report.document.name}: claims ${num(r.overall_claimed)}% overall as at ${r.as_of}, across ${r.packages.length} packages.`,
    !report.reading.problems.length,
  );
  for (const p of report.reading.problems) step("Check against page text", p, false);
  const claimedBy = Object.fromEntries(r.packages.map((p) => [p.element, p]));
  const packages = [];
  for (const { document, reading } of plans) {
    const x = reading.data;
    const element = document.element;
    const prog = packageProgress(x.activities, r.as_of);
    step(
      `Read the ${ELEMENTS[element].toLowerCase()} plan`,
      `${document.name}: ${prog.activities} activities, ${prog.activitiesDone} complete; budget SAR ${num(x.budget)}m.` +
        (reading.retried ? " Re-read once after a check failed." : ""),
      !reading.problems.length,
    );
    for (const p of reading.problems) step("Check against page text", p, false);
    const claim = claimedBy[element];
    packages.push({
      element,
      name: ELEMENTS[element],
      budget: x.budget,
      claimed: claim ? claim.claimed : null,
      claimed_page: claim ? claim.page : null,
      planned: prog.planned,
      actual: prog.actual,
      status: checkStatus(claim ? claim.claimed : null, prog.actual, prog.planned, false),
      document: { id: document.document_id, name: document.name },
      activities: x.activities.map((a) => ({
        ...a,
        planned: Math.round(100 * plannedFraction(a.start, a.finish, r.as_of)),
      })),
      problems: reading.problems,
    });
  }
  const missing = Object.keys(claimedBy).filter((e) => !plans.some((p) => p.document.element === e));
  for (const element of missing) {
    const c = claimedBy[element];
    packages.push({
      element,
      name: ELEMENTS[element],
      budget: c.budget,
      claimed: c.claimed,
      claimed_page: c.page,
      planned: null,
      actual: null,
      status: "evidence-missing",
      document: null,
      activities: [],
      problems: [],
    });
    step("Missing evidence", `The report claims ${ELEMENTS[element].toLowerCase()} progress, but no plan is on file.`, false);
  }
  const order = Object.keys(ELEMENTS);
  packages.sort((a, b) => order.indexOf(a.element) - order.indexOf(b.element));
  const measured = packages.filter((p) => p.actual != null);
  if (!measured.length) throw new Error("No detailed plans are filed for this stadium yet.");
  const total = overall(measured);
  step(
    "Recalculated progress",
    `Budget-weighted across ${measured.length} package${measured.length === 1 ? "" : "s"}: ${num(total.actual)}% actual against ${num(total.planned)}% planned.`,
  );
  const result = {
    stadium_id: stadium.id,
    stadium_name: stadium.name,
    city: stadium.city,
    as_of: r.as_of,
    claimed: r.overall_claimed,
    recalculated: total.actual,
    planned: total.planned,
    gap: round1(r.overall_claimed - total.actual),
    tolerance: TOLERANCE,
    status: checkStatus(r.overall_claimed, total.actual, total.planned, missing.length > 0),
    report: { document_id: report.document.document_id, name: report.document.name, page: r.overall_page, quote: r.overall_quote },
    packages,
    checked_at: new Date().toISOString().slice(0, 19) + "+00:00",
    offline: true,
  };
  step(
    "Compared with the claim",
    `Reported ${num(result.claimed)}%, recalculated ${num(result.recalculated)}% (tolerance ${TOLERANCE} points): ${result.status.replace("-", " ")}.`,
    result.status === "supported" || result.status === "behind-plan",
  );
  result.summary = summary(result);
  result.summary_checked = true;
  step("Wrote the finding", "Summarised the result and the gap against the claim.");
  result.steps = steps;
  return result;
}

/** Schedule slip in days from a check's plans using earned schedule. */
export function scheduleSlipDays(check) {
  const packages = (check?.packages || []).filter((p) => p.activities?.length && p.budget);
  if (!packages.length) return null;
  const budget = packages.reduce((total, pack) => total + pack.budget, 0);
  const plannedAt = (date) => packages.reduce((total, pack) => {
    const weight = pack.activities.reduce((sum, activity) => sum + activity.weight, 0);
    const progress = pack.activities.reduce((sum, activity) => sum + activity.weight * plannedFraction(activity.start, activity.finish, date), 0) / weight;
    return total + (pack.budget * 100 * progress) / budget;
  }, 0);
  const iso = (number) => new Date(number * DAY).toISOString().slice(0, 10);
  const activities = packages.flatMap((pack) => pack.activities);
  let lo = Math.min(...activities.map((activity) => day(activity.start))) - 1;
  let hi = Math.max(...activities.map((activity) => day(activity.finish)));
  if (plannedAt(iso(hi)) < check.recalculated) return day(check.as_of) - hi;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (plannedAt(iso(mid)) >= check.recalculated - 1e-9) hi = mid;
    else lo = mid;
  }
  return day(check.as_of) - hi;
}
