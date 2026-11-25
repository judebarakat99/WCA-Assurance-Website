// The Overview page's data, worked out from the same modules every other page reads (the register's exposure for each
// stadium, the alerts, the site conditions), so its numbers agree with the stadium pages, the reports and Nabd.
//
// overviewModel({ records, pillar, now }) returns the four headline figures and one row per stadium. pillar is a chapter of
// the FIFA stadium book by name (the chapter rail's choice): it narrows readiness, issues and exposure to that chapter.
// now is the system date; leave it null until the page has mounted so the page renders the same on the server and the client.
import { FACILITY_REGISTER, STATUS_LABEL } from "@/lib/domain/facilities.mjs";
import { nextGate, schedulePosition, stadiumExposure } from "@/lib/domain/exposure.mjs";
import { FAMILIES } from "@/lib/register/data.mjs";
import { allAlerts } from "@/lib/store/alerts";
import { slipDays } from "@/lib/overview/schedule.mjs";

export const LEVELS = ["critical", "material", "manageable", "controlled"];
export const BUCKET_TITLE = {
  critical: "Critical intervention",
  material: "Material impact",
  manageable: "Manageable",
  controlled: "Controlled",
};
// The deck's wording, used when the register's own definitions are not available.
export const DEFINITION = {
  critical: "Late mitigation may require major redesign, rework or threaten a key milestone.",
  material: "Mitigation remains achievable but has meaningful cost, procurement or schedule impact.",
  manageable: "A defined mitigation route exists with limited programme impact.",
  controlled: "Compliant, closed or managed through normal delivery controls.",
};
export const SHORT_DEFINITION = {
  critical: "Major redesign, rework or milestone threat",
  material: "Meaningful cost, procurement or schedule impact",
  manageable: "Clear mitigation route with limited programme impact",
  controlled: "Compliant or managed through normal delivery",
};

const DAY = 86400000;
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const isoOf = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : "");

/** The latest date on a record: when evidence was last submitted or the requirement was last reviewed. */
function lastDate(record) {
  const dates = [];
  if (record?.review && typeof record.review === "object") for (const v of Object.values(record.review)) dates.push(isoOf(v));
  dates.push(isoOf(record?.evidence?.at(-1)?.on), isoOf(record?.history?.at(-1)?.on));
  return dates.filter(Boolean).sort().at(-1) || "";
}

const worst = (counts) => LEVELS.find((k) => counts[k] > 0) || "controlled";
const short = (name) => name.replace(/ (Sports City )?Stadium$/, "").replace(/ Sports City$/, "");

/** Which chapters (families) have findings of one class at a stadium, most findings first. */
export function familiesAt(row, level) {
  const by = new Map();
  for (const f of row.findings) {
    if (f.level !== level) continue;
    const id = f.row.requirement.familyId;
    if (!by.has(id)) by.set(id, { id, name: f.row.requirement.category, count: 0 });
    by.get(id).count++;
  }
  const info = new Map(FAMILIES.map((f) => [f.id, f]));
  return [...by.values()]
    .map((x) => ({ ...x, short: info.get(x.id)?.short || x.name }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}

export function overviewModel({ records, pillar = null, now = null } = {}) {
  const today = now ? iso(now) : null;
  const cutoff = now ? iso(new Date(now.getTime() - 30 * DAY)) : null;
  const cities = new Map(FACILITY_REGISTER.hostCities.map((c) => [c.id, c]));

  const rows = FACILITY_REGISTER.stadiums.map((s) => {
    const ex = stadiumExposure(s, records);
    const findings = pillar ? ex.findings.filter((f) => f.row.requirement.category === pillar) : ex.findings;
    const counts = Object.fromEntries(LEVELS.map((k) => [k, findings.filter((f) => f.level === k).length]));
    const fulfilled = findings.filter((f) => f.record?.status === "compliant").length;
    const fulfilledThen = cutoff ? findings.filter((f) => f.record?.status === "compliant" && (lastDate(f.record) || "0000") <= cutoff).length : fulfilled;
    const pos = schedulePosition(ex.counts); // the programme position does not change with the chapter chosen
    const slip = slipDays(s.id);
    const schedule =
      slip > 0
        ? { key: pos.key, slip, label: `+${slip} days`, tone: pos.key === "off-track" || slip > 30 ? "bad" : "warn" }
        : { key: pos.key, slip: 0, label: pos.label, tone: pos.tone };
    const city = cities.get(s.cityId);
    return {
      id: s.id,
      name: s.name,
      short: short(s.name),
      cityId: s.cityId,
      city: city?.name || "",
      year: s.completionYear,
      statusLabel: STATUS_LABEL[s.status] || s.status,
      coordinates: s.location?.coordinates || city?.coordinates || null,
      approximate: s.location?.accuracy === "approximate",
      gate: nextGate(s),
      findings,
      counts,
      total: findings.length,
      fulfilled,
      fulfilledThen,
      readiness: findings.length ? fulfilled / findings.length : null,
      level: worst(counts),
      schedule,
    };
  });
  rows.sort(
    (a, b) =>
      b.counts.critical - a.counts.critical ||
      b.counts.material - a.counts.material ||
      (a.readiness ?? 1) - (b.readiness ?? 1) ||
      a.name.localeCompare(b.name),
  );

  const total = rows.reduce((t, r) => t + r.total, 0);
  const fulfilled = rows.reduce((t, r) => t + r.fulfilled, 0);
  const then = rows.reduce((t, r) => t + r.fulfilledThen, 0);
  const share = total ? fulfilled / total : null;
  const delta = now && total ? Math.round((fulfilled / total - then / total) * 1000) / 10 : null;
  const critical = rows.reduce((t, r) => t + r.counts.critical, 0);
  const overdue = today ? allAlerts(records).filter((a) => a.status === "open" && a.severity === "high" && a.due && a.due < today).length : null;
  const atRisk = rows.filter((r) => r.schedule.key !== "on-track" || r.schedule.slip > 0).length;
  const offTrack = rows.filter((r) => r.schedule.key === "off-track").length;
  const slipping = rows.filter((r) => r.schedule.slip > 0).length;

  return {
    rows,
    kpis: {
      compliance: { share, delta, fulfilled, total },
      atRisk: { n: atRisk, of: rows.length, offTrack },
      critical: { n: critical, overdue },
      milestones: { n: slipping, of: rows.length },
    },
  };
}
