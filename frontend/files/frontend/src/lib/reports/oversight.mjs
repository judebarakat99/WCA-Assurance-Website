// Two reports built on the same block structure as the rest of the Reports page (see model.mjs), so Word, Excel, PDF and
// the preview all read them:
//   contractorReport   the reporting status of the contractors, programme managers, engineering firms and asset owners:
//                      who has reported, who is late, who has not reported, and what is missing from their reports;
//   executiveReport    one consolidated report for the programme's leadership: where intervention is needed now, the
//                      stadium portfolio, reporting, site escalations, the design review and changes to the register.
// This file imports nothing from model.mjs (which imports it), so it keeps its own small helpers.
import { summarise } from "@/lib/oversight/status.mjs";
import { longDate, num, pct, plural, shortDate } from "@/lib/reports/text.mjs";

const col = (key, label, w, extra = {}) => ({ key, label, w, ...extra });
const percent = (v) => Math.round(v * 100);
const toneOfCount = (n, tone) => (n ? tone : "mute");
const toneOfShare = (v) => (v >= 0.85 ? "good" : v >= 0.65 ? "warn" : "bad");
const list = (items) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items.at(-1)}` : items[0] || "");
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);

const STATUS_LABEL = { "on-time": "On time", incomplete: "On time, incomplete", late: "Late", missing: "Not received" };
const RANK = { missing: 0, late: 1, incomplete: 2, "on-time": 3 };

const cycleText = (c) => (c.key === "missing" ? "Not received" : c.key === "late" ? `Late ${c.days} d` : c.key === "incomplete" ? "On time, incomplete" : "On time");

/** Parties that need action, worst first: not received (longest overdue first), then late, then incomplete. */
function needingAction(parties) {
  return parties
    .filter((p) => p.needsAction)
    .sort(
      (a, b) =>
        RANK[a.latest.key] - RANK[b.latest.key] ||
        (b.latest.overdue || b.latest.days || 0) - (a.latest.overdue || a.latest.days || 0) ||
        a.completionYear - b.completionYear ||
        a.stadium.localeCompare(b.stadium) ||
        a.role.localeCompare(b.role),
    );
}

const daysOf = (p) => (p.latest.key === "missing" ? p.latest.overdue : p.latest.key === "late" ? p.latest.days : 0);

function roleTable(byRole, title) {
  return {
    type: "table",
    title,
    columns: [
      col("role", "Role", 2),
      col("parties", "Parties", 0.8, { kind: "num" }),
      col("onTime", "On time", 0.9, { kind: "num" }),
      col("incomplete", "On time, incomplete", 1.3, { kind: "num" }),
      col("late", "Late", 0.8, { kind: "num", tone: true }),
      col("missing", "Not received", 1.1, { kind: "num", tone: true }),
      col("rate", "On-time rate, last 6", 1.4, { kind: "pct", tone: true }),
      col("complete", "Average completeness", 1.5, { kind: "pct" }),
    ],
    rows: byRole
      .filter((r) => r.parties)
      .map((r) => ({
        role: r.plural,
        parties: r.parties,
        onTime: r.onTime,
        incomplete: r.incomplete,
        late: r.late,
        late_tone: toneOfCount(r.late, "warn"),
        missing: r.missing,
        missing_tone: toneOfCount(r.missing, "bad"),
        rate: r.onTimeRate,
        rate_tone: toneOfShare(r.onTimeRate),
        complete: r.avgCompleteness,
      })),
  };
}

function actionTable(parties, { title, maxRows = 30, empty = "Every party's latest report arrived on time and complete." } = {}) {
  return {
    type: "table",
    title,
    columns: [
      col("stadium", "Stadium", 2.2),
      col("party", "Party", 2.3),
      col("role", "Role", 1.4),
      col("period", "Report for", 1.2),
      col("due", "Due", 1.1),
      col("status", "Status", 1.35, { kind: "tone" }),
      col("days", "Days", 0.65, { kind: "num" }),
      col("escalate", "Escalate to", 1.5),
      col("next", "Next step", 4),
    ],
    rows: parties.map((p) => ({
      stadium: p.stadium,
      party: p.party,
      role: p.roleLabel,
      period: p.latest.period,
      due: shortDate(p.latest.due),
      status: STATUS_LABEL[p.latest.key],
      status_tone: p.latest.tone,
      days: daysOf(p) || "",
      escalate: p.escalateTo || "",
      next: p.action,
    })),
    maxRows: { docx: maxRows, pdf: maxRows },
    empty,
  };
}

function cycleNote(o, parties) {
  const roles = [...new Set(parties.map((p) => p.role))];
  const bits = o.periods.filter((x) => roles.includes(x.role) && x.latest).map((x) => `${x.label}s: the ${x.latest.period} report, due ${shortDate(x.latest.due)}`);
  return bits.join("; ");
}

// ---------- contractor reporting ----------
export function contractorReport(config, data) {
  const o = data.oversight;
  const stadiumId = config.narrow?.kind === "stadium" ? config.narrow.id : null;
  const parties = o.parties.filter((p) => !stadiumId || p.stadiumId === stadiumId);
  const { latest: L, byRole } = summarise(parties);
  const action = needingAction(parties);
  const stadiumIds = [...new Set(parties.map((p) => p.stadiumId))];
  const worst = action[0];
  const sections = [];

  const missingNames = action.filter((p) => p.latest.key === "missing");
  const headlineParts = [
    `${L.arrivedOnTime} of the ${plural(L.total, "party", "parties")} reported on time for the latest cycle${L.incomplete ? `, ${L.incomplete} of them with sections missing` : ""}.`,
    L.late ? ` ${plural(L.late, "party", "parties")} reported late.` : " No party reported late.",
    L.missing ? ` ${plural(L.missing, "party", "parties")} ${L.missing === 1 ? "has" : "have"} not reported at all; the longest is ${plural(L.overdueDays, "day")} overdue${missingNames[0] ? ` (${missingNames[0].party}, ${missingNames[0].stadium})` : ""}.` : " Every party has reported.",
  ];
  const lowest = [...byRole].filter((r) => r.parties).sort((a, b) => a.onTimeRate - b.onTimeRate)[0];
  if (lowest) headlineParts.push(` ${lowest.plural} have the lowest on-time rate over the last ${o.cycles} reports (${percent(lowest.onTimeRate)}%).`);

  sections.push({
    id: "summary",
    title: "Summary",
    blocks: [
      {
        type: "kpis",
        items: [
          { label: "Reported on time", value: `${L.arrivedOnTime} of ${L.total}`, sub: "latest report arrived by its due date", tone: toneOfShare(pct(L.arrivedOnTime, L.total)) },
          { label: "Late", value: num(L.late), sub: "latest report arrived after its due date", tone: toneOfCount(L.late, "warn") },
          { label: "Not received", value: num(L.missing), sub: L.missing ? `longest ${plural(L.overdueDays, "day")} overdue` : "none outstanding", tone: toneOfCount(L.missing, "bad") },
          { label: "Missing sections", value: num(L.withMissingSections), sub: "latest report leaves out a section", tone: toneOfCount(L.withMissingSections, "warn") },
          { label: "On-time rate", value: `${percent(L.onTimeRate)}%`, sub: `last ${o.cycles} reports, all parties`, tone: toneOfShare(L.onTimeRate) },
        ],
      },
      { type: "text", text: headlineParts.join("") },
      {
        type: "facts",
        items: [
          { label: "Scope", value: `${plural(parties.length, "party", "parties")} at ${plural(stadiumIds.length, "stadium")}${stadiumId ? ` (${parties[0]?.stadium || ""})` : ""}` },
          { label: "Latest reports", value: cycleNote(o, parties) },
          { label: "Reporting", value: "Every party reports monthly. A report covers the month before its due date." },
          ...(worst ? [{ label: "Most urgent", value: `${worst.party} (${worst.roleLabel}, ${worst.stadium}): ${worst.action}` }] : []),
        ],
      },
    ],
  });

  sections.push({ id: "roles", title: "By role", blocks: [roleTable(byRole, "How each kind of party is reporting")] });

  sections.push({
    id: "action",
    title: "Needs action",
    blocks: [actionTable(action, { title: `${plural(action.length, "party", "parties")} with a late, missing or incomplete latest report, most urgent first` })],
  });

  const perStadium = stadiumIds.map((id) => {
    const own = parties.filter((p) => p.stadiumId === id);
    const s = summarise(own).latest;
    const first = own[0];
    return { id, name: first.stadium, city: first.city, year: first.completionYear, own, s };
  });
  perStadium.sort((a, b) => b.s.missing - a.s.missing || b.s.late - a.s.late || b.s.incomplete - a.s.incomplete || a.s.onTimeRate - b.s.onTimeRate || a.name.localeCompare(b.name));
  sections.push({
    id: "stadiums",
    title: "Stadiums",
    blocks: [
      {
        type: "table",
        title: "How the parties at each stadium are reporting",
        columns: [
          col("stadium", "Stadium", 3.2),
          col("city", "City", 1.1),
          col("due", "Due", 0.65, { kind: "year" }),
          col("parties", "Parties", 0.8, { kind: "num" }),
          col("onTime", "On time", 0.85, { kind: "num" }),
          col("incomplete", "On time, incomplete", 1.3, { kind: "num" }),
          col("late", "Late", 0.7, { kind: "num", tone: true }),
          col("missing", "Not received", 1.1, { kind: "num", tone: true }),
          col("rate", "On-time rate, last 6", 1.4, { kind: "pct", tone: true }),
        ],
        rows: perStadium.map((x) => ({
          stadium: x.name,
          city: x.city,
          due: x.year,
          parties: x.s.total,
          onTime: x.s.onTime,
          incomplete: x.s.incomplete,
          late: x.s.late,
          late_tone: toneOfCount(x.s.late, "warn"),
          missing: x.s.missing,
          missing_tone: toneOfCount(x.s.missing, "bad"),
          rate: x.s.onTimeRate,
          rate_tone: toneOfShare(x.s.onTimeRate),
        })),
      },
    ],
  });

  const everyone = [...parties].sort((a, b) => a.stadium.localeCompare(b.stadium) || a.role.localeCompare(b.role));
  const cycleCols = Array.from({ length: o.cycles }, (_, k) => col(`c${k}`, k === 0 ? "Latest cycle" : `${k} ${k === 1 ? "cycle" : "cycles"} back`, 1.3, { kind: "tone", formats: ["xlsx"] }));
  sections.push({
    id: "parties",
    title: "All parties",
    blocks: [
      {
        type: "table",
        title: "Every party and its last six reports",
        columns: [
          col("stadium", "Stadium", 2.2),
          col("party", "Party", 2.3),
          col("role", "Role", 1.4),
          col("status", "Latest status", 1.35, { kind: "tone" }),
          col("received", "Received", 1.1),
          col("days", "Days late", 0.8, { kind: "num" }),
          col("complete", "Completeness", 1, { kind: "pct" }),
          col("rate", "On time, last 6", 1.1, { kind: "pct", tone: true }),
          ...cycleCols,
        ],
        rows: everyone.map((p) => {
          const row = {
            stadium: p.stadium,
            party: p.party,
            role: p.roleLabel,
            status: STATUS_LABEL[p.latest.key],
            status_tone: p.latest.tone,
            received: p.latest.received ? shortDate(p.latest.received) : "Not received",
            days: p.latest.key === "late" ? p.latest.days : "",
            complete: p.latest.completeness,
            rate: p.onTimeRate,
            rate_tone: toneOfShare(p.onTimeRate),
          };
          p.cycles.forEach((c) => {
            row[`c${c.k}`] = cycleText(c);
            row[`c${c.k}_tone`] = c.tone;
          });
          return row;
        }),
        maxRows: { docx: 40, pdf: 40 },
      },
    ],
  });

  const gaps = parties
    .filter((p) => p.latest.key === "missing" || p.latest.missing.length)
    .sort((a, b) => RANK[a.latest.key] - RANK[b.latest.key] || a.stadium.localeCompare(b.stadium) || a.role.localeCompare(b.role));
  sections.push({
    id: "missing",
    title: "What is missing",
    blocks: [
      {
        type: "table",
        title: "Sections left out of the latest reports",
        columns: [
          col("stadium", "Stadium", 2.4),
          col("party", "Party", 2.4),
          col("role", "Role", 1.4),
          col("period", "Report for", 1.2),
          col("status", "Status", 1.35, { kind: "tone" }),
          col("left", "Left out", 6),
        ],
        rows: gaps.map((p) => ({
          stadium: p.stadium,
          party: p.party,
          role: p.roleLabel,
          period: p.latest.period,
          status: STATUS_LABEL[p.latest.key],
          status_tone: p.latest.tone,
          left: p.latest.key === "missing" ? "The whole report" : p.latest.missing.join(", "),
        })),
        maxRows: { docx: 30, pdf: 30 },
        empty: "No latest report leaves out a section.",
      },
    ],
  });

  sections.push({
    id: "about",
    title: "About this report",
    blocks: [
      { type: "note", text: `Prepared by the Venue Compliance Hub on ${longDate(data.now)}. Each party reports monthly: contractors by the 5th, programme managers and engineering firms by the 10th and asset owners by the 15th, for the month before.` },
      { type: "note", text: "On time means the report arrived on or before its due date. Late means it arrived after. Not received means it has not arrived and its due date has passed. Completeness is the share of the six sections a report of that kind must contain that the report includes." },
      { type: "note", text: "A report that is not received is escalated by how long it has been overdue: up to 7 days to the delivery owner, up to 14 days to the workstream lead, up to 21 days to the authority executive, and beyond that to ministerial steering." },
      { type: "note", text: "A progress report filed on the Evidence page counts as the contractor's latest report if that report had not been received; it is shown as received on the day it was filed." },
    ],
  });
  return sections;
}

// ---------- executive report ----------
function tally(rows) {
  const t = { inScope: rows.length, fulfilled: 0, awaiting: 0, notAssessed: 0, notFulfilled: 0 };
  for (const r of rows) {
    if (r.statusKey === "compliant") t.fulfilled++;
    else if (r.statusKey === "evidence-submitted") t.awaiting++;
    else if (r.statusKey === "non-compliant" || r.statusKey === "partial") t.notFulfilled++;
    else t.notAssessed++;
  }
  return t;
}
const levelsOf = (rows) => {
  const c = { critical: 0, material: 0, manageable: 0, controlled: 0 };
  for (const r of rows) c[r.level]++;
  return c;
};

/**
 * What most needs intervention now, one line per stadium for findings (a leader wants the place, not forty rows):
 * stadiums with critical findings, reports more than a week overdue, and stadiums whose material findings site
 * conditions have raised. A mix is kept: up to five stadiums, then up to four overdue reports, then whatever fills the list.
 */
function interventions(data, parties, limit = 10) {
  const groups = (level, raisedOnly) => {
    const out = [];
    for (const s of data.stadiums) {
      const rows = s.rows.filter((r) => r.level === level && (!raisedOnly || r.reason.includes("Raised from")));
      if (!rows.length) continue;
      const raised = rows.filter((r) => r.reason.includes("Raised from"));
      const owners = [...new Set(rows.map((r) => r.owner))];
      const titles = rows.slice(0, 3).map((r) => r.title);
      const due = rows.map((r) => r.due).filter(Boolean);
      const noun = level === "critical" ? "critical finding" : "raised finding";
      out.push({
        weight: rows.length,
        raised: raised.length,
        year: s.completionYear,
        stadium: s.name,
        tone: level === "critical" ? "bad" : "warn",
        type: level === "critical" ? "Critical findings" : "Raised findings",
        issue: plural(rows.length, noun),
        why: `${list(titles)}${rows.length > 3 ? ` and ${rows.length - 3} more` : ""}.${raised.length ? ` ${plural(raised.length, "finding")} raised by site conditions.` : ""} The stadium completes in ${s.completionYear}.`,
        owner: owners.length > 2 ? `${owners[0]} and ${owners.length - 1} others` : list(owners),
        by: due[0] || "",
      });
    }
    return out.sort((a, b) => b.raised - a.raised || b.weight - a.weight || a.year - b.year || a.stadium.localeCompare(b.stadium));
  };
  const critical = groups("critical", false).map((x) => ({ ...x, sev: x.raised ? 0 : 1 }));
  const raisedMaterial = groups("material", true).map((x) => ({ ...x, sev: 3 }));
  const reports = parties
    .filter((p) => p.latest.key === "missing" && p.latest.overdue >= 8)
    .sort((a, b) => b.latest.overdue - a.latest.overdue || a.completionYear - b.completionYear)
    .map((p) => ({
      sev: p.latest.overdue > 14 ? 1 : 2,
      weight: p.latest.overdue,
      year: p.completionYear,
      stadium: p.stadium,
      type: "Report not received",
      tone: p.latest.overdue > 14 ? "bad" : "warn",
      issue: `${p.party} (${p.roleLabel}): the ${p.latest.period} report`,
      why: `${plural(p.latest.overdue, "day")} overdue. Escalate to the ${lower(p.escalateTo)}.`,
      owner: p.escalateTo,
      by: "Now",
    }));
  const picked = [...critical.slice(0, 5), ...reports.slice(0, 4)];
  for (const pool of [raisedMaterial, critical.slice(5), reports.slice(4)])
    for (const x of pool) if (picked.length < limit && !picked.includes(x)) picked.push(x);
  return picked.sort((a, b) => a.sev - b.sev || b.weight - a.weight || a.year - b.year || a.stadium.localeCompare(b.stadium)).slice(0, limit);
}

export function executiveReport(config, data) {
  const o = data.oversight;
  const sts = data.stadiums;
  const all = sts.flatMap((s) => s.rows);
  const t = tally(all);
  const lc = levelsOf(all);
  const per = sts.map((s) => {
    const rows = s.rows;
    return { s, t: tally(rows), lc: levelsOf(rows), sch: data.schedule(levelsOf(rows)), parties: o.parties.filter((p) => p.stadiumId === s.id) };
  });
  const risky = per.filter((p) => p.lc.critical + p.lc.material > 0);
  const off = per.filter((p) => p.sch.key === "off-track").length;
  const { latest: L, byRole } = summarise(o.parties);
  const action = needingAction(o.parties);
  const missingParties = action.filter((p) => p.latest.key === "missing");
  const share = pct(t.fulfilled, t.inScope);
  const site = data.siteConditions || [];
  const raisedReqs = new Set(site.flatMap((c) => c.effects.map((e) => e.requirementId))).size;
  const design = data.designReview || null;
  const sections = [];

  const first = [...per].sort((a, b) => b.lc.critical - a.lc.critical || b.lc.material - a.lc.material || a.s.name.localeCompare(b.s.name)).filter((p) => p.lc.critical + p.lc.material > 0).slice(0, 3);
  const para1 = `As of ${longDate(data.now)}, ${percent(share)}% of the ${num(t.inScope)} in-scope requirements across the ${sts.length} stadiums are fulfilled. ${plural(risky.length, "stadium")} carr${risky.length === 1 ? "ies" : "y"} critical or material findings (${off} off track, ${risky.length - off} at risk). ${plural(lc.critical, "critical finding")} and ${plural(lc.material, "material finding")} are open, and ${plural(t.awaiting, "submission")} await${t.awaiting === 1 ? "s" : ""} a reviewer's decision.`;
  const para2 = `Reporting: ${L.arrivedOnTime} of ${L.total} contractors, programme managers, engineering firms and asset owners sent their latest report on time. ${plural(L.late, "party", "parties")} ${L.late === 1 ? "was" : "were"} late and ${plural(L.missing, "party", "parties")} ${L.missing === 1 ? "has" : "have"} not reported${missingParties[0] ? `; the longest outstanding is ${missingParties[0].party} (${missingParties[0].stadium}), ${plural(missingParties[0].latest.overdue, "day")} overdue` : ""}.`;
  const para3 = site.length
    ? `Site conditions: ${plural(site.length, "site condition")} ${site.length === 1 ? "is" : "are"} logged and raise${site.length === 1 ? "s" : ""} the exposure of ${plural(raisedReqs, "requirement")}${design ? `. The design review of ${design.stadium} (revision ${design.revision}) has ${design.pass} of ${design.total} checks meeting their requirement` : ""}.`
    : `No site conditions are logged.${design ? ` The design review of ${design.stadium} (revision ${design.revision}) has ${design.pass} of ${design.total} checks meeting their requirement.` : ""}`;
  const para4 = first.length ? `Intervene first at ${list(first.map((p) => `${p.s.name} (${p.lc.critical} critical, ${p.lc.material} material)`))}.` : "No stadium carries critical or material findings.";

  sections.push({
    id: "summary",
    title: "Summary",
    blocks: [
      {
        type: "kpis",
        items: [
          { label: "Requirements fulfilled", value: `${percent(share)}%`, sub: `${num(t.fulfilled)} of ${num(t.inScope)}`, tone: share >= 0.85 ? "good" : share >= 0.5 ? "warn" : "bad" },
          { label: "Stadiums at risk", value: `${risky.length} of ${sts.length}`, sub: `${off} off track`, tone: risky.length ? "warn" : "good" },
          { label: "Critical findings", value: num(lc.critical), sub: `${num(lc.material)} material`, tone: lc.critical ? "bad" : "good" },
          { label: "Reports outstanding", value: num(L.missing), sub: `${num(L.late)} more received late`, tone: toneOfCount(L.missing, "bad") },
          { label: "Site conditions", value: num(site.length), sub: site.length ? `raising ${plural(raisedReqs, "requirement")}` : "none logged", tone: site.length ? "warn" : "mute" },
        ],
      },
      { type: "text", text: para1 },
      { type: "text", text: para2 },
      { type: "text", text: para3 },
      { type: "text", text: para4 },
    ],
  });

  const todo = interventions(data, o.parties).slice(0, 10);
  sections.push({
    id: "intervene",
    title: "Intervene now",
    blocks: [
      {
        type: "table",
        title: `${plural(todo.length, "item")}, most urgent first`,
        columns: [
          col("n", "#", 0.45, { kind: "num" }),
          col("type", "Type", 1.5, { kind: "tone" }),
          col("stadium", "Stadium", 2.3),
          col("issue", "What", 3.4),
          col("why", "Why now", 4.2),
          col("owner", "Owner", 1.8),
          col("by", "By", 1.1),
        ],
        rows: todo.map((x, i) => ({ n: i + 1, type: x.type, type_tone: x.tone, stadium: x.stadium, issue: x.issue, why: x.why, owner: x.owner, by: x.by })),
        empty: "Nothing needs intervention now.",
      },
    ],
  });

  sections.push({
    id: "portfolio",
    title: "Stadium portfolio",
    blocks: [
      {
        type: "table",
        title: `${plural(sts.length, "stadium")}, highest exposure first`,
        columns: [
          col("stadium", "Stadium", 3.2),
          col("city", "City", 1.1),
          col("due", "Due", 0.65, { kind: "year" }),
          col("share", "% fulfilled", 0.9, { kind: "pct" }),
          col("critical", "Critical", 0.85, { kind: "num", tone: true }),
          col("material", "Material", 0.9, { kind: "num", tone: true }),
          col("schedule", "Schedule", 0.95, { kind: "tone" }),
          col("reports", "Reports", 1.4, { kind: "tone" }),
          col("gate", "Next gate", 1.3),
        ],
        rows: [...per]
          .sort((a, b) => b.lc.critical - a.lc.critical || b.lc.material - a.lc.material || pct(a.t.fulfilled, a.t.inScope) - pct(b.t.fulfilled, b.t.inScope) || a.s.name.localeCompare(b.s.name))
          .map((p) => {
            const need = p.parties.filter((x) => x.needsAction).length;
            const gone = p.parties.filter((x) => x.latest.key === "missing").length;
            return {
              stadium: p.s.name,
              city: p.s.city,
              due: p.s.completionYear,
              share: pct(p.t.fulfilled, p.t.inScope),
              critical: p.lc.critical,
              critical_tone: toneOfCount(p.lc.critical, "bad"),
              material: p.lc.material,
              material_tone: toneOfCount(p.lc.material, "warn"),
              schedule: p.sch.label,
              schedule_tone: p.sch.tone,
              reports: need ? `${need} of ${p.parties.length} need action` : "All on time",
              reports_tone: gone ? "bad" : need ? "warn" : "good",
              gate: p.s.gate,
            };
          }),
      },
    ],
  });

  sections.push({
    id: "reporting",
    title: "Reporting",
    blocks: [
      roleTable(byRole, "How each kind of party is reporting"),
      actionTable(action.slice(0, 8), { title: `The ${Math.min(8, action.length)} most urgent of ${plural(action.length, "party", "parties")} needing action`, maxRows: 8 }),
    ],
  });

  const siteBlocks = [];
  if (site.length)
    siteBlocks.push({
      type: "table",
      title: "Site conditions logged",
      columns: [col("id", "ID", 0.7), col("kind", "Kind", 1.5), col("title", "What happened", 4.2), col("source", "Source", 2.4), col("logged", "Logged", 1.1), col("raised", "Requirements raised", 4.2)],
      rows: site.map((c) => ({ id: c.id, kind: c.kind, title: c.title, source: c.source, logged: c.logged, raised: c.effects.map((e) => `${e.requirementId} ${e.title} (${e.level})`).join("; ") })),
    });
  else siteBlocks.push({ type: "text", text: "No site conditions are logged." });
  if (design)
    siteBlocks.push({
      type: "facts",
      items: [
        { label: "Design review", value: `${design.stadium}, package revision ${design.revision}` },
        { label: "Checks recorded", value: `${design.pass} meet their requirement, ${design.fail} fall below it, ${design.review} need a reviewer` },
        ...(design.fail ? [{ label: "Below the requirement", value: design.items.filter((i) => i.check === "fail").map((i) => `${i.requirementId} ${i.title}`).join("; ") }] : []),
      ],
    });
  sections.push({ id: "site", title: "Site and design review", blocks: siteBlocks });

  if ((data.changes || []).length)
    sections.push({
      id: "changes",
      title: "Changes to the register",
      blocks: [
        {
          type: "table",
          title: "Requirement changes applied",
          columns: [col("requirement", "Requirement", 4), col("required", "Now required", 3), col("version", "Version", 0.9, { kind: "num" }), col("on", "Applied", 1.2)],
          rows: data.changes.map((c) => ({ requirement: `${c.requirementId} ${c.title}`, required: c.required, version: c.version, on: c.on })),
        },
      ],
    });

  sections.push({
    id: "about",
    title: "About this report",
    blocks: [
      { type: "note", text: `Prepared by the Venue Compliance Hub on ${longDate(data.now)} from the compliance register (dated ${data.registerDate}), the reporting status of the delivery parties, the site conditions logged and the evidence and reviews recorded in the application since.` },
      { type: "note", text: "Fulfilled means a reviewer has accepted the requirement. Exposure classes: " + ["critical", "material", "manageable", "controlled"].map((k) => `${data.exposure[k].label} (${data.exposure[k].definition.replace(/\.$/, "")})`).join("; ") + "." },
      { type: "note", text: "Intervene now shows each stadium with critical findings once, together with reports more than a week overdue and the stadiums whose material findings site conditions have raised. Findings raised by site conditions come first." },
      { type: "note", text: "For most requirements the 2034 contract clause is still to be confirmed, so thresholds are provisional. Use these figures to steer the programme, not as a certification." },
    ],
  });
  return sections;
}
