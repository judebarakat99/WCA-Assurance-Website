// Reporting status of the parties that report on each stadium (contractors, programme managers, engineering firms and
// asset owners): which of their last six monthly reports arrived on time, late or not at all, and how complete they were.
//
// Dates come from the system date. A report is due on a fixed day of each month (lib/oversight/roles.mjs); the six
// most recent due dates that have passed are the party's six cycles, cycle 0 being the latest. The CSV files record only
// how many days early or late each report was, so the demonstration always looks current.
//
// A progress report filed on the Evidence page is read here too: if the contractor's latest report is missing and a
// progress report for the same stadium has been filed, the report counts as received on the day it was filed.
import data from "./oversight.generated.json" with { type: "json" };
import { CYCLES, ROLES, roleById } from "./roles.mjs";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY = 86400000;
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const utc = (isoDate) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};
const addDays = (isoDate, n) => {
  const d = new Date(utc(isoDate) + n * DAY);
  return iso(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};
const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / DAY);
const todayIso = (now) => iso(now.getFullYear(), now.getMonth(), now.getDate());

/** The six due dates (latest first) for a day of the month, and the month each report covers. */
export function cycleDates(now, dueDay, count = CYCLES) {
  const today = todayIso(now);
  const out = [];
  for (let back = 0; out.length < count && back < 24; back++) {
    const y = now.getFullYear() + Math.floor((now.getMonth() - back) / 12);
    const m = (((now.getMonth() - back) % 12) + 12) % 12;
    const due = iso(y, m, dueDay);
    if (due > today) continue;
    const covers = m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 };
    out.push({ k: out.length, due, period: `${MONTHS[covers.m]} ${covers.y}` });
  }
  return out;
}

/** What the escalation ladder says for a report this many days overdue. */
export function escalation(days) {
  if (days <= 0) return null;
  if (days <= 7) return "Delivery owner";
  if (days <= 14) return "Workstream lead";
  if (days <= 21) return "Authority executive";
  return "Ministerial steering";
}

export const STATUS = {
  "on-time": { label: "On time", tone: "good", rank: 0 },
  incomplete: { label: "On time, incomplete", tone: "warn", rank: 1 },
  late: { label: "Late", tone: "warn", rank: 2 },
  missing: { label: "Not received", tone: "bad", rank: 3 },
};

function judge({ days, missing, sections, overdue }) {
  const completeness = days == null ? 0 : (sections.length - missing.length) / sections.length;
  if (days == null) return { key: "missing", tone: "bad", completeness, days: null, overdue };
  if (days > 0) return { key: "late", tone: days > 7 ? "bad" : "warn", completeness, days, overdue: 0 };
  if (missing.length) return { key: "incomplete", tone: "warn", completeness, days, overdue: 0 };
  return { key: "on-time", tone: "good", completeness, days, overdue: 0 };
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function actionFor(p) {
  const l = p.latest;
  const sections = l.missing.length ? ` Missing: ${l.missing.join(", ")}.` : "";
  if (l.key === "missing") return `Chase now. The ${l.period} report is ${plural(l.overdue, "day")} overdue; escalate to ${escalation(l.overdue)}.`;
  if (l.key === "late") return `Received ${plural(l.days, "day")} late${l.viaEvidence ? " (filed on the Evidence page)" : ""}.${p.lateCount >= 3 ? ` Late ${p.lateCount} times in the last ${CYCLES} reports: raise it with the ${escalation(Math.max(l.days, 8)).toLowerCase()}.` : " Agree an on-time submission date."}${sections}`;
  if (l.key === "incomplete") return `Request the missing sections.${sections}`;
  return "";
}

const count = (list, key) => list.filter((p) => p.latest.key === key).length;

/** Totals for any set of parties: how many of their latest reports are on time, late or missing, and the same by role. */
export function summarise(parties) {
  const latest = {
    total: parties.length,
    onTime: count(parties, "on-time"),
    incomplete: count(parties, "incomplete"),
    late: count(parties, "late"),
    missing: count(parties, "missing"),
    needAction: parties.filter((p) => p.needsAction).length,
    withMissingSections: parties.filter((p) => p.latest.missing.length > 0).length,
    overdueDays: Math.max(0, ...parties.map((p) => p.latest.overdue)),
    onTimeRate: parties.length ? parties.reduce((t, p) => t + p.onTime, 0) / (parties.length * CYCLES) : 0,
    arrivedOnTime: count(parties, "on-time") + count(parties, "incomplete"),
  };
  const byRole = ROLES.map((r) => {
    const own = parties.filter((p) => p.role === r.id);
    return {
      id: r.id,
      label: r.label,
      plural: r.plural,
      dueDay: r.dueDay,
      parties: own.length,
      onTime: count(own, "on-time"),
      incomplete: count(own, "incomplete"),
      late: count(own, "late"),
      missing: count(own, "missing"),
      onTimeRate: own.length ? own.reduce((t, p) => t + p.onTime, 0) / (own.length * CYCLES) : 0,
      avgCompleteness: own.length ? own.reduce((t, p) => t + p.avgCompleteness, 0) / own.length : 0,
    };
  });
  return { latest, byRole };
}

/**
 * The reporting picture for a set of stadiums.
 * stadiums: [{ id, name, city, completionYear }]; documents: filed intake documents ({ kind, stadiumId, filedAt, superseded }).
 * Returns { now, parties, latest, byRole, periods }.
 */
export function oversightSnapshot({ now = new Date(), stadiums = [], documents = [] } = {}) {
  const stadium = new Map(stadiums.map((s) => [s.id, s]));
  const subs = new Map(data.submissions.map(([id, k, days, missing]) => [`${id}#${k}`, { days, missing }]));
  const today = todayIso(now);
  const filedByStadium = new Map();
  for (const d of documents) {
    if (d.kind !== "progress-report" || !d.stadiumId || d.superseded) continue;
    const day = d.filedAt ? String(d.filedAt).slice(0, 10) : today;
    if (!filedByStadium.has(d.stadiumId) || day < filedByStadium.get(d.stadiumId)) filedByStadium.set(d.stadiumId, day);
  }

  const parties = data.parties
    .filter((p) => stadium.has(p.stadiumId))
    .map((p) => {
      const role = roleById(p.role);
      const dates = cycleDates(now, role.dueDay);
      const cycles = dates.map((c) => {
        let rec = subs.get(`${p.id}#${c.k}`) || { days: null, missing: [] };
        let viaEvidence = false;
        if (c.k === 0 && rec.days == null && p.role === "contractor" && filedByStadium.has(p.stadiumId)) {
          rec = { days: Math.max(0, daysBetween(c.due, filedByStadium.get(p.stadiumId))), missing: [] };
          viaEvidence = true;
        }
        const overdue = rec.days == null ? Math.max(0, daysBetween(c.due, today)) : 0;
        const j = judge({ days: rec.days, missing: rec.missing, sections: role.sections, overdue });
        const received = rec.days == null ? "" : addDays(c.due, rec.days);
        return { k: c.k, period: c.period, due: c.due, received, missing: rec.missing, viaEvidence, ...j, label: STATUS[j.key].label };
      });
      const latest = cycles[0];
      const onTime = cycles.filter((c) => c.key === "on-time" || c.key === "incomplete").length;
      const lateCount = cycles.filter((c) => c.key === "late").length;
      const missingCount = cycles.filter((c) => c.key === "missing").length;
      const avg = cycles.reduce((t, c) => t + c.completeness, 0) / cycles.length;
      const out = {
        id: p.id,
        stadiumId: p.stadiumId,
        stadium: stadium.get(p.stadiumId).name,
        city: stadium.get(p.stadiumId).city,
        completionYear: stadium.get(p.stadiumId).completionYear,
        party: p.party,
        role: p.role,
        roleLabel: role.label,
        dueDay: role.dueDay,
        cycles,
        latest,
        onTime,
        lateCount,
        missingCount,
        onTimeRate: onTime / cycles.length,
        avgCompleteness: avg,
        needsAction: latest.key !== "on-time",
        escalateTo: latest.key === "missing" ? escalation(latest.overdue) : latest.key === "late" ? escalation(latest.days) : null,
      };
      out.action = actionFor(out);
      return out;
    });

  const { latest, byRole } = summarise(parties);
  const periods = ROLES.map((r) => ({ role: r.id, label: r.label, dueDay: r.dueDay, latest: cycleDates(now, r.dueDay, 1)[0] }));
  return { now, parties, latest, byRole, periods, cycles: CYCLES };
}

/** Parties for one stadium. */
export const partiesOf = (snapshot, stadiumId) => snapshot.parties.filter((p) => p.stadiumId === stadiumId);
