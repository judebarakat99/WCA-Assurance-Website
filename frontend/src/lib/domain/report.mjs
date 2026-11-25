// Report model: one format-neutral description of a report (title, headline
// figures, paragraphs and tables) built from the app's own data. The preview,
// Word, Excel and PDF renderers all draw this same model, so they agree.
import { STATUS, stadiumRequirements } from "@/lib/domain/assessment.mjs";
import { PILLARS } from "@/lib/domain/cityAssurance.mjs";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";
import { criterionLabel } from "@/lib/domain/fifa-catalogue.mjs";
import { portfolio } from "@/lib/domain/portfolio.mjs";
import { ELEMENTS } from "@/lib/domain/progressCheck.mjs";

export const APP_NAME = "Venue Compliance Hub";

/** Report kinds, as offered on the Reports page. */
export const REPORT_KINDS = {
  programme: { group: "compliance", label: "Programme", hint: "Every stadium in the programme" },
  city: { group: "compliance", label: "Host city", hint: "The stadiums in one host city" },
  stadium: { group: "compliance", label: "Stadium", hint: "One stadium, requirement by requirement" },
  area: { group: "compliance", label: "Chapter", hint: "One chapter of the FIFA stadium book across the stadiums" },
  contractor: { group: "oversight", label: "Contractor reporting", hint: "Who has reported, who is late and what is missing" },
  executive: { group: "oversight", label: "Executive report", hint: "One consolidated report for the programme's leadership" },
};

/** Rows shown in Word, PDF and the preview before a table says "see the workbook". */
export const DOC_ROW_LIMIT = 40;
/** A monthly progress report older than this many days counts as late. */
export const LATE_AFTER_DAYS = 35;

export const AREAS = PILLARS.filter((p) => p.id).map((p) => p.id);
const chapterLabel = (name) => {
  const p = PILLARS.find((x) => x.id === name);
  return p ? `${p.number} ${name}` : name;
};
const CITY = Object.fromEntries(FACILITY_REGISTER.hostCities.map((c) => [c.id, c]));
const RISK_LABEL = { bad: "Critical", warn: "At risk", good: "On track", mute: "Not started" };
const pct = (x) => `${Math.round(x * 100)}%`;
const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
const longDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

// ---------------------------------------------------------------- data

/** In-scope requirement rows (with their records) for the given stadiums and area. */
function requirementRows(stadiums, records, area) {
  return stadiums.flatMap((stadium) =>
    stadiumRequirements(stadium)
      .filter((r) => r.applicability.value !== "not-applicable" && (!area || r.requirement.category === area))
      .map((r) => {
        const record = records[r.key];
        const evidence = record?.evidence?.at(-1) || null;
        return { ...r, stadium, record, status: record?.status || "unassessed", evidence };
      }),
  );
}

function counts(rows) {
  const c = { inScope: rows.length, compliant: 0, "non-compliant": 0, "evidence-submitted": 0, declared: 0, unassessed: 0 };
  for (const r of rows) c[r.status]++;
  c.notAssessed = c.unassessed + c.declared;
  c.assured = rows.length ? c.compliant / rows.length : 0;
  return c;
}

const failing = (r) => r.status === "evidence-submitted" && r.evidence?.check === "fail";

function nextStep(r) {
  const crit = criterionLabel(r.requirement.criterion);
  if (r.status === "non-compliant") return `Resubmit evidence that meets ${crit}.`;
  if (failing(r)) return `Review: the submitted value${r.evidence.value !== "" && r.evidence.value != null ? ` ${r.evidence.value}` : ""} misses ${crit}.`;
  return "Review the submitted evidence.";
}

// ---------------------------------------------------------------- sections

const kpis = (title, items) => ({ type: "kpis", title, items });
const text = (body) => ({ type: "text", text: body });
const table = (title, subtitle, columns, rows, note) => ({ type: "table", title, subtitle, columns, rows, note });
const cell = (value, tone) => (tone ? { value, tone } : value);

const STADIUM_COLUMNS = [
  { key: "stadium", label: "Stadium", width: 22 },
  { key: "city", label: "City", width: 10 },
  { key: "due", label: "Due", align: "center", width: 6 },
  { key: "inScope", label: "In scope", align: "center", width: 7 },
  { key: "compliant", label: "Compliant", align: "center", width: 8 },
  { key: "nonCompliant", label: "Non-compliant", align: "center", width: 11 },
  { key: "awaiting", label: "Awaiting review", align: "center", width: 10 },
  { key: "notAssessed", label: "Not assessed", align: "center", width: 8 },
  { key: "assured", label: "% assured", align: "center", width: 8 },
  { key: "schedule", label: "Schedule", width: 11 },
  { key: "stage", label: "Stage", width: 11 },
  { key: "risk", label: "Risk", width: 9 },
];

function stadiumTable(prows, records, area, subtitle) {
  const rows = prows.map((p) => {
    const stadium = FACILITY_REGISTER.stadiums.find((s) => s.id === p.id);
    const c = counts(requirementRows([stadium], records, area));
    return {
      stadium: p.name,
      city: p.city,
      due: p.due,
      inScope: c.inScope,
      compliant: c.compliant,
      nonCompliant: cell(c["non-compliant"], c["non-compliant"] ? "bad" : null),
      awaiting: cell(c["evidence-submitted"], c["evidence-submitted"] ? "warn" : null),
      notAssessed: c.notAssessed,
      assured: cell(pct(c.assured), c.assured >= 0.85 ? "good" : c.assured >= 0.5 ? "warn" : "bad"),
      schedule: cell(p.schedule.label, p.schedule.tone),
      stage: p.stage,
      risk: cell(RISK_LABEL[p.risk], p.risk),
    };
  });
  return table("Stadiums", subtitle, STADIUM_COLUMNS, rows);
}

const AREA_COLUMNS = [
  { key: "area", label: "Chapter", width: 24 },
  { key: "inScope", label: "In scope", align: "center", width: 9 },
  { key: "compliant", label: "Compliant", align: "center", width: 9 },
  { key: "nonCompliant", label: "Non-compliant", align: "center", width: 10 },
  { key: "awaiting", label: "Awaiting review", align: "center", width: 10 },
  { key: "notAssessed", label: "Not assessed", align: "center", width: 9 },
  { key: "assured", label: "% assured", align: "center", width: 9 },
];

function areaTable(stadiums, records) {
  const rows = AREAS.map((area) => {
    const c = counts(requirementRows(stadiums, records, area));
    return {
      area: chapterLabel(area),
      inScope: c.inScope,
      compliant: c.compliant,
      nonCompliant: cell(c["non-compliant"], c["non-compliant"] ? "bad" : null),
      awaiting: cell(c["evidence-submitted"], c["evidence-submitted"] ? "warn" : null),
      notAssessed: c.notAssessed,
      assured: cell(pct(c.assured), c.assured >= 0.85 ? "good" : c.assured >= 0.5 ? "warn" : "bad"),
    };
  });
  return table("Chapters", "Compliance by chapter of the FIFA stadium book", AREA_COLUMNS, rows);
}

const FINDING_COLUMNS = [
  { key: "stadium", label: "Stadium", width: 20 },
  { key: "requirement", label: "Requirement", width: 26 },
  { key: "area", label: "Chapter", width: 12 },
  { key: "status", label: "Status", width: 13 },
  { key: "value", label: "Value on record", width: 10 },
  { key: "next", label: "Next step", width: 30 },
  { key: "due", label: "Stadium due", align: "center", width: 8 },
];

function findingsTable(rows) {
  const open = rows
    .filter((r) => r.status === "non-compliant" || failing(r))
    .sort(
      (a, b) =>
        (a.status === "non-compliant" ? 0 : 1) - (b.status === "non-compliant" ? 0 : 1) ||
        a.stadium.completionYear - b.stadium.completionYear ||
        a.stadium.name.localeCompare(b.stadium.name),
    )
    .map((r) => ({
      stadium: r.stadium.name,
      requirement: `${r.requirement.id} ${r.requirement.title}`,
      area: chapterLabel(r.requirement.category),
      status: r.status === "non-compliant" ? cell("Non-compliant", "bad") : cell("Evidence fails check", "warn"),
      value: r.evidence?.value ?? "",
      next: nextStep(r),
      due: r.stadium.completionYear,
    }));
  return table(
    "Findings",
    "Open findings, most urgent first: non-compliant requirements, then evidence that fails its check",
    FINDING_COLUMNS,
    open,
  );
}

const CLAIM_COLUMNS = [
  { key: "stadium", label: "Stadium", width: 24 },
  { key: "asOf", label: "Report date", align: "center", width: 10 },
  { key: "claimed", label: "Reported", align: "center", width: 9 },
  { key: "recalculated", label: "Recalculated", align: "center", width: 10 },
  { key: "planned", label: "Planned by then", align: "center", width: 10 },
  { key: "schedule", label: "Schedule", width: 11 },
  { key: "status", label: "Finding", width: 14 },
  { key: "decision", label: "Reviewer", width: 11 },
];
const CLAIM_STATUS = {
  overstated: ["Overstated", "bad"],
  "evidence-missing": ["Evidence missing", "warn"],
  "behind-plan": ["Behind plan", "warn"],
  supported: ["Supported", "good"],
};

function claimsTable(prows) {
  const rows = prows
    .filter((p) => p.check)
    .map((p) => ({
      stadium: p.name,
      asOf: p.check.as_of,
      claimed: `${p.check.claimed}%`,
      recalculated: cell(`${p.check.recalculated}%`, p.check.status === "overstated" ? "bad" : null),
      planned: `${p.check.planned}%`,
      schedule: cell(p.schedule.label, p.schedule.tone),
      status: cell(...CLAIM_STATUS[p.check.status]),
      decision: p.check.decision ? `Finding ${p.check.decision}` : "Awaiting decision",
    }));
  return table(
    "Progress claims",
    "Contractors' reported progress against the progress recalculated from their detailed plans",
    CLAIM_COLUMNS,
    rows,
  );
}

function about(date, sample, extra = []) {
  return [
    `Prepared by the ${APP_NAME} on ${longDate(date)}. Requirement figures come from the assessment register held in the application; progress figures come from contractor documents filed on the Intake page and checked against their detailed plans.`,
    "Assured means a reviewer has accepted evidence that the requirement is met. Non-compliant means a reviewer found the evidence does not meet it. Awaiting review means evidence has been submitted and no reviewer has decided yet. Not assessed covers requirements with no evidence (including capacities only declared in the register).",
    "Risk: Critical for an overstated progress claim, more than 30 days behind plan, or a non-compliance on a stadium due within two years; At risk for any other non-compliance, slip or failing evidence; On track otherwise. Schedule is days behind the contractor's detailed plans at the report date (earned schedule).",
    ...extra,
    ...(sample ? ["This report uses the demo's labelled sample data. Use it to illustrate the process, not as a certification."] : []),
    "Requirements come from the venue requirements register (181 checks in 11 chapters, dated 20 November 2026). Most are working targets whose threshold is still to be confirmed against the 2034 contract clause; they are marked provisional.",
  ];
}

// ---------------------------------------------------------------- reports

/**
 * Build a report. kind: a REPORT_KINDS key. scope: { cityId, stadiumId, area }.
 * data: { records, checks, documents, sample, date (ISO day) }.
 */
export function buildReport(kind, scope, data) {
  const { records, checks = {}, documents = [], sample = false, date } = data;
  const area = kind === "area" ? scope.area : scope.area || null;
  const p = portfolio(records, checks, area, Number(date.slice(0, 4)));
  const base = { kind, date, dateLabel: longDate(date), app: APP_NAME };
  const fname = (what) => `venue-compliance-hub_${slug(what)}_${date}`;

  if (kind === "stadium") {
    const stadium = FACILITY_REGISTER.stadiums.find((s) => s.id === scope.stadiumId);
    if (!stadium) return null;
    const prow = p.rows.find((r) => r.id === stadium.id);
    const rows = requirementRows([stadium], records, area);
    const c = counts(rows);
    const reqTable = table(
      "Requirements",
      "Every FIFA requirement in scope for this stadium",
      [
        { key: "requirement", label: "Requirement", width: 28 },
        { key: "area", label: "Chapter", width: 12 },
        { key: "applies", label: "Applies", width: 10 },
        { key: "criterion", label: "Criterion", width: 16 },
        { key: "status", label: "Status", width: 13 },
        { key: "evidence", label: "Evidence", width: 18 },
        { key: "value", label: "Value", align: "center", width: 8 },
        { key: "decision", label: "Reviewer decision", width: 14 },
      ],
      rows.map((r) => ({
        requirement: `${r.requirement.id} ${r.requirement.title}`,
        area: chapterLabel(r.requirement.category),
        applies: r.applicability.value === "provisional" ? cell("Provisional", "warn") : "Applies",
        criterion: criterionLabel(r.requirement.criterion),
        status: cell(
          failing(r) ? "Evidence fails check" : STATUS[r.status],
          { compliant: "good", "non-compliant": "bad", "evidence-submitted": failing(r) ? "warn" : null }[r.status],
        ),
        evidence: r.evidence?.file || "",
        value: r.evidence?.value ?? "",
        decision: r.record?.review ? `${r.record.review.outcome} · ${r.record.review.on}` : "",
      })),
    );
    return {
      ...base,
      title: "Stadium compliance report",
      subtitle: `${stadium.name} · ${CITY[stadium.cityId].name}${area ? ` · ${area}` : ""}`,
      filename: fname(`stadium-${stadium.name}${area ? `-${area}` : ""}`),
      sections: [
        kpis("Summary", [
          { value: pct(c.assured), label: "Requirements assured", note: `${c.compliant} of ${c.inScope}`, tone: c.assured >= 0.85 ? "good" : c.assured >= 0.5 ? "warn" : "bad" },
          { value: c["non-compliant"], label: "Non-compliant", note: "need new evidence", tone: c["non-compliant"] ? "bad" : "good" },
          { value: c["evidence-submitted"], label: "Awaiting review", note: `${rows.filter(failing).length} fail their check`, tone: c["evidence-submitted"] ? "warn" : "good" },
          { value: prow.schedule.label, label: "Schedule", note: prow.check ? `report ${prow.check.as_of}` : "no plan on file", tone: prow.schedule.tone || "mute" },
          { value: RISK_LABEL[prow.risk], label: "Risk", note: `${prow.stage} · due ${stadium.completionYear}`, tone: prow.risk },
        ]),
        text(
          `${stadium.name} (${CITY[stadium.cityId].name}, due ${stadium.completionYear}) has ${c.inScope} FIFA requirements in scope${area ? ` in ${area}` : ""}. ${c.compliant} are assured (${pct(c.assured)}), ${c["non-compliant"]} are non-compliant, ${c["evidence-submitted"]} await a reviewer's decision and ${c.notAssessed} are not assessed yet.` +
            (prow.check
              ? ` The contractor reported ${prow.check.claimed}% progress at ${prow.check.as_of}; the detailed plans support ${prow.check.recalculated}% (${prow.schedule.label.toLowerCase()}).`
              : " No contractor progress report has been checked for this stadium."),
        ),
        findingsTable(rows),
        reqTable,
      ],
      about: about(date, sample),
    };
  }

  if (kind === "contractor") {
    const docs = documents.filter((d) => d.status === "filed");
    const rows = p.rows.map((r) => {
      const mine = docs.filter((d) => d.stadium_id === r.id && !d.superseded);
      const report = mine.find((d) => d.kind === "progress-report");
      const plans = mine.filter((d) => d.kind === "detailed-plan");
      const age = report?.as_of ? daysBetween(report.as_of, date) : null;
      const late = age != null && age > LATE_AFTER_DAYS;
      const missingPlans = (r.check?.packages || []).filter((x) => x.status === "evidence-missing").map((x) => ELEMENTS[x.element]);
      return {
        r,
        report,
        late,
        missingPlans,
        cells: {
          stadium: r.name,
          city: r.city,
          report: report ? cell(`${report.name}`, late ? "warn" : null) : cell("No report filed", "mute"),
          asOf: report?.as_of ? cell(report.as_of, late ? "warn" : null) : "",
          plans: plans.length ? plans.map((d) => ELEMENTS[d.element]).join(", ") : cell("None", report ? "warn" : null),
          missing: missingPlans.length ? cell(missingPlans.join(", "), "warn") : "",
          claim: r.check ? cell(`${r.check.claimed}% vs ${r.check.recalculated}%`, r.check.status === "overstated" ? "bad" : null) : "",
          finding: r.check ? cell(...CLAIM_STATUS[r.check.status]) : report ? cell("Not checked", "warn") : "",
          decision: r.check ? (r.check.decision ? `Finding ${r.check.decision}` : "Awaiting decision") : "",
        },
      };
    });
    const reported = rows.filter((x) => x.report);
    const late = rows.filter((x) => x.late);
    const unsupported = rows.filter((x) => x.r.check && ["overstated", "evidence-missing"].includes(x.r.check.status));
    rows.sort((a, b) => (a.report ? 1 : 0) - (b.report ? 1 : 0) || a.r.due - b.r.due);
    return {
      ...base,
      title: "Contractor reporting report",
      subtitle: "Progress reporting across all stadiums",
      filename: fname("contractor-reporting"),
      sections: [
        kpis("Summary", [
          { value: `${reported.length} of ${rows.length}`, label: "Stadiums reporting", note: "progress report on file", tone: reported.length === rows.length ? "good" : "warn" },
          { value: rows.length - reported.length, label: "Not reporting", note: "no progress report filed", tone: rows.length - reported.length ? "bad" : "good" },
          { value: late.length, label: "Late", note: `report older than ${LATE_AFTER_DAYS} days`, tone: late.length ? "warn" : "good" },
          { value: unsupported.length, label: "Claims not supported", note: "overstated or missing plans", tone: unsupported.length ? "bad" : "good" },
          { value: rows.reduce((t, x) => t + x.missingPlans.length, 0), label: "Plans missing", note: "claimed without a plan", tone: rows.some((x) => x.missingPlans.length) ? "warn" : "good" },
        ]),
        text(
          `${reported.length} of ${rows.length} stadiums have a contractor progress report on file${late.length ? `, ${late.length} of them late` : ""}. ${unsupported.length ? `${unsupported.length} reported figure${unsupported.length === 1 ? " is" : "s are"} not supported by the detailed plans.` : "Every checked claim is supported by the detailed plans."} ${rows.length - reported.length} stadiums have not reported.`,
        ),
        table(
          "Reporting by stadium",
          "Stadiums without a report first, then by due date",
          [
            { key: "stadium", label: "Stadium", width: 22 },
            { key: "city", label: "City", width: 9 },
            { key: "report", label: "Latest progress report", width: 22 },
            { key: "asOf", label: "Report date", align: "center", width: 9 },
            { key: "plans", label: "Plans on file", width: 22 },
            { key: "missing", label: "Plans missing", width: 14 },
            { key: "claim", label: "Reported vs recalculated", align: "center", width: 12 },
            { key: "finding", label: "Finding", width: 11 },
            { key: "decision", label: "Reviewer", width: 11 },
          ],
          rows.map((x) => x.cells),
        ),
        claimsTable(p.rows),
      ],
      about: about(date, sample, [
        `Contractors are expected to file a progress report monthly; a report dated more than ${LATE_AFTER_DAYS} days before this report counts as late.`,
      ]),
    };
  }

  // Programme, host city, requirement area and executive reports share the portfolio.
  const cityId = kind === "city" ? scope.cityId : null;
  if (kind === "city" && !CITY[cityId]) return null;
  if (kind === "area" && !area) return null;
  const prows = cityId ? p.rows.filter((r) => r.cityId === cityId) : p.rows;
  const stadiums = prows.map((r) => FACILITY_REGISTER.stadiums.find((s) => s.id === r.id));
  const rows = requirementRows(stadiums, records, area);
  const c = counts(rows);
  const atRisk = prows.filter((r) => r.risk === "bad" || r.risk === "warn");
  const critical = prows.filter((r) => r.risk === "bad");
  const claims = prows.filter((r) => r.check && !r.check.decision && ["overstated", "evidence-missing"].includes(r.check.status));
  const where = cityId ? `${prows.length} stadiums in ${CITY[cityId].name}` : `all ${prows.length} stadiums`;
  const summary = kpis("Summary", [
    { value: pct(c.assured), label: "Requirements assured", note: `${c.compliant} of ${c.inScope}`, tone: c.assured >= 0.85 ? "good" : c.assured >= 0.5 ? "warn" : "bad" },
    { value: `${atRisk.length} of ${prows.length}`, label: "Stadiums at risk", note: `${critical.length} critical`, tone: critical.length ? "bad" : atRisk.length ? "warn" : "good" },
    { value: c["non-compliant"], label: "Non-compliant", note: "requirements needing new evidence", tone: c["non-compliant"] ? "bad" : "good" },
    { value: c["evidence-submitted"], label: "Awaiting review", note: `${rows.filter(failing).length} fail their check`, tone: c["evidence-submitted"] ? "warn" : "good" },
    { value: claims.length, label: "Progress claims", note: "not supported, awaiting decision", tone: claims.length ? "bad" : "good" },
  ]);
  const overview = text(
    `${pct(c.assured)} of the ${c.inScope} in-scope requirements${area ? ` in ${area}` : ""} are assured across ${where}. ${atRisk.length} stadium${atRisk.length === 1 ? " is" : "s are"} at risk (${critical.length} critical). ${c["non-compliant"]} requirements are non-compliant and ${c["evidence-submitted"]} await a reviewer's decision${rows.filter(failing).length ? `, ${rows.filter(failing).length} of them with evidence that fails its check` : ""}.` +
      (claims.length ? ` ${claims.length} contractor progress claim${claims.length === 1 ? " is" : "s are"} not supported by the detailed plans.` : ""),
  );

  if (kind === "executive") {
    const exceptions = table(
      "Exceptions",
      "Stadiums at risk, most urgent first",
      [
        { key: "stadium", label: "Stadium", width: 26 },
        { key: "city", label: "City", width: 11 },
        { key: "due", label: "Due", align: "center", width: 7 },
        { key: "assured", label: "Readiness", align: "center", width: 9 },
        { key: "schedule", label: "Schedule", width: 12 },
        { key: "issues", label: "Issues", align: "center", width: 7 },
        { key: "why", label: "Why", width: 32 },
        { key: "risk", label: "Risk", width: 9 },
      ],
      atRisk.map((r) => ({
        stadium: r.name,
        city: r.city,
        due: r.due,
        assured: r.readiness == null ? "–" : pct(r.readiness),
        schedule: cell(r.schedule.label, r.schedule.tone),
        issues: r.issues.total,
        why: [
          r.overstated && "progress claim overstated",
          r.issues.nonCompliant && `${r.issues.nonCompliant} non-compliant`,
          r.issues.failing && `${r.issues.failing} evidence failing`,
          r.schedule.tone === "bad" && "well behind plan",
        ]
          .filter(Boolean)
          .join(" · "),
        risk: cell(RISK_LABEL[r.risk], r.risk),
      })),
    );
    return {
      ...base,
      title: "Executive report",
      subtitle: "Programme status for leadership",
      filename: fname("executive-report"),
      sections: [
        kpis("Programme at a glance", [
          ...summary.items.slice(0, 2),
          { value: p.kpis.milestones.count, label: "Milestones at risk", note: `of ${p.kpis.milestones.due} handovers by ${p.kpis.milestones.horizon}`, tone: p.kpis.milestones.count ? "bad" : "good" },
          ...summary.items.slice(2, 3),
          ...summary.items.slice(4),
        ]),
        overview,
        exceptions,
        claimsTable(p.rows),
        areaTable(stadiums, records),
      ],
      about: about(date, sample),
    };
  }

  const titles = {
    programme: ["Programme compliance report", `All ${prows.length} stadiums`, "programme"],
    city: ["Host city compliance report", cityId && `${CITY[cityId].name} · ${prows.length} stadiums`, `city-${cityId}`],
    area: ["Chapter compliance report", `${chapterLabel(area)} · all ${prows.length} stadiums`, `chapter-${area}`],
  };
  const [title, subtitle, file] = titles[kind];
  return {
    ...base,
    title,
    subtitle,
    filename: fname(file),
    sections: [
      summary,
      overview,
      stadiumTable(prows, records, area, `${prows.length} stadiums, highest risk first`),
      ...(kind === "area" ? [] : [areaTable(stadiums, records)]),
      findingsTable(rows),
      ...(prows.some((r) => r.check) ? [claimsTable(prows)] : []),
    ],
    about: about(date, sample),
  };
}

/** Plain text of a cell (tables hold plain values or { value, tone }). */
export const cellText = (c) => (c && typeof c === "object" ? String(c.value ?? "") : String(c ?? ""));
/** Tone of a cell, or null. */
export const cellTone = (c) => (c && typeof c === "object" ? c.tone || null : null);
