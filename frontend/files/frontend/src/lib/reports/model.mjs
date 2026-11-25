// The report model. buildReport(config, data) turns a choice (what the report is for) into one structure
// that Word, Excel, PDF and the preview all read, so the numbers and wording are identical in each.
//
//   report = { title, subtitle, scopeLine, generatedText, generatedIso, filenameBase, sections: [{ id, title, blocks }] }
//   blocks:  { type: "kpis", items: [{ label, value, sub, tone }] }
//            { type: "facts", items: [{ label, value }] }
//            { type: "text", text }
//            { type: "table", title?, columns: [{ key, label, w, kind?, formats? }], rows: [{ ... , <key>_tone }], maxRows? }
//            { type: "note", text }
// Columns: kind "num" (right-aligned number), "year" (a number shown without separators), "pct" (a fraction shown as a percentage), "tone" cells take
// their colour from row[key + "_tone"]. formats limits a column to some of "docx", "pdf", "xlsx".
// maxRows: { docx, pdf } caps a long table in the documents; the workbook always has every row.
import { longDate, isoDate, num, pct, plural, slug } from "@/lib/reports/text.mjs";

export const SCOPES = [
  { id: "programme", label: "Programme", hint: "Every stadium in the programme", targetLabel: null },
  { id: "city", label: "Host city", hint: "The stadiums in one host city", targetLabel: "Host city" },
  { id: "stadium", label: "Stadium", hint: "One stadium, requirement by requirement", targetLabel: "Stadium" },
  { id: "chapter", label: "Chapter", hint: "One chapter of the FIFA stadium book across the stadiums", targetLabel: "Chapter" },
  { id: "owner", label: "Owner", hint: "What one owner has to act on", targetLabel: "Owner" },
];
export const FORMATS = [
  { id: "docx", label: "Word document", ext: "docx", hint: "An editable report to review and share", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  { id: "xlsx", label: "Excel workbook", ext: "xlsx", hint: "Tables to filter, sort and work with", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  { id: "pdf", label: "PDF", ext: "pdf", hint: "A fixed layout to send or print", mime: "application/pdf" },
];

/** What to choose after the scope: the options for the report's subject. */
export function targetsFor(scope, data) {
  if (scope === "city") return data.cities.filter((c) => data.stadiums.some((s) => s.cityId === c.id)).map((c) => ({ id: c.id, label: c.name }));
  if (scope === "stadium") return [...data.stadiums].sort((a, b) => a.name.localeCompare(b.name)).map((s) => ({ id: s.id, label: s.name }));
  if (scope === "chapter") return data.families.map((f) => ({ id: f.id, label: f.label }));
  if (scope === "owner") return data.owners.map((o) => ({ id: o, label: o }));
  return [];
}
/** An optional way to narrow the report, or null when the scope has none. */
export function narrowFor(scope, data) {
  if (scope === "programme" || scope === "city" || scope === "stadium")
    return { label: "Limit to one chapter", options: data.families.map((f) => ({ id: f.id, label: f.label })), kind: "family" };
  if (scope === "chapter")
    return { label: "Limit to one host city", options: data.cities.map((c) => ({ id: c.id, label: c.name })), kind: "city" };
  if (scope === "owner")
    return { label: "Limit to one stadium", options: [...data.stadiums].sort((a, b) => a.name.localeCompare(b.name)).map((s) => ({ id: s.id, label: s.name })), kind: "stadium" };
  return null;
}
/** True when the choice is complete: a scope, and its subject when the scope needs one. */
export function isComplete(config) {
  if (!config?.scope) return false;
  const needs = SCOPES.find((s) => s.id === config.scope)?.targetLabel;
  return needs ? !!config.target : true;
}

// ---------- table pieces ----------
const col = (key, label, w, extra = {}) => ({ key, label, w, ...extra });
const TONE_OF_STATUS = { Compliant: "good", "Partially compliant": "warn", "Non-compliant": "bad", "Evidence submitted": "info", "Not assessed": "mute" };

function tally(rows) {
  const t = { inScope: rows.length, fulfilled: 0, notFulfilled: 0, partial: 0, awaiting: 0, notAssessed: 0 };
  for (const r of rows) {
    if (r.statusKey === "compliant") t.fulfilled++;
    else if (r.statusKey === "non-compliant" || r.statusKey === "partial") {
      t.notFulfilled++;
      if (r.statusKey === "partial") t.partial++;
    } else if (r.statusKey === "evidence-submitted") t.awaiting++;
    else t.notAssessed++;
  }
  return t;
}
function levels(rows) {
  const c = { critical: 0, material: 0, manageable: 0, controlled: 0 };
  for (const r of rows) c[r.level]++;
  return c;
}
const toneOfCount = (n, tone) => (n ? tone : "mute");

const sectionKey = (r) => r.section.split(" ")[0].split(".").map(Number);
const bySection = (a, b) => sectionKey(a)[0] - sectionKey(b)[0] || sectionKey(a)[1] - sectionKey(b)[1] || a.id.localeCompare(b.id);

/** Rows of one stadium that the report's filters keep. */
function rowsOf(stadium, f) {
  return stadium.rows.filter((r) => (!f.family || r.familyId === f.family) && (!f.owner || r.owner === f.owner));
}

function findingRows(items, { stadiumColumn = true } = {}) {
  return items
    .filter(({ row }) => row.level !== "controlled")
    .sort((a, b) => a.row.dueOrder - b.row.dueOrder || a.stadium.completionYear - b.stadium.completionYear || a.stadium.name.localeCompare(b.stadium.name) || a.row.id.localeCompare(b.row.id))
    .map(({ stadium, row }) => ({
      stadium: stadium.name,
      requirement: `${row.id} ${row.title}`,
      chapter: `${row.familyId} ${row.family}`,
      level: row.levelLabel,
      level_tone: row.levelTone,
      status: row.status,
      status_tone: TONE_OF_STATUS[row.status],
      owner: row.owner,
      action: row.action,
      due: row.due,
      _stadiumColumn: stadiumColumn,
    }));
}
function findingsTable(items, { title, maxRows = 40, stadiumColumn = true, ownerColumn = true } = {}) {
  const rows = findingRows(items, { stadiumColumn });
  const columns = [
    ...(stadiumColumn ? [col("stadium", "Stadium", 2.3)] : []),
    col("requirement", "Requirement", 3.2),
    col("chapter", "Chapter", 1.9),
    col("level", "Class", 0.95, { kind: "tone" }),
    col("status", "Status", 1.25, { kind: "tone" }),
    ...(ownerColumn ? [col("owner", "Owner", 1.8)] : []),
    col("action", "Next step", 3.6),
    col("due", "Due", 1.2),
  ];
  return { type: "table", title, columns, rows, maxRows: { docx: maxRows, pdf: maxRows }, empty: "No critical, material or manageable findings are open." };
}

function alertsTable(alerts, { title = "Open alerts", maxRows = 25, stadiumColumn = true } = {}) {
  const rows = alerts.map((a) => ({
    severity: a.severity === "high" ? "High" : a.severity === "medium" ? "Medium" : "Low",
    severity_tone: a.severity === "high" ? "bad" : a.severity === "medium" ? "warn" : "info",
    stadium: a.stadium,
    requirement: a.requirement,
    alert: a.title,
    owner: a.owner,
    due: a.due,
    source: a.source,
  }));
  return {
    type: "table",
    title,
    columns: [
      col("severity", "Severity", 0.85, { kind: "tone" }),
      ...(stadiumColumn ? [col("stadium", "Stadium", 2)] : []),
      col("requirement", "Requirement", 2.4),
      col("alert", "Alert", 4),
      col("owner", "Owner", 1.8),
      col("due", "Due", 1.2),
      col("source", "Source", 1.6),
    ],
    rows,
    maxRows: { docx: maxRows, pdf: maxRows },
    empty: "No alerts are open.",
  };
}

function chapterTable(sts, f, { title = "Compliance by chapter" } = {}) {
  const families = new Map();
  for (const s of sts) for (const r of rowsOf(s, f)) {
    if (!families.has(r.familyId)) families.set(r.familyId, { id: r.familyId, name: r.family, owner: r.owner, rows: [] });
    families.get(r.familyId).rows.push(r);
  }
  const rows = [...families.values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((fam) => {
      const t = tally(fam.rows);
      const lc = levels(fam.rows);
      return {
        chapter: `${fam.id} ${fam.name}`,
        inScope: t.inScope,
        fulfilled: t.fulfilled,
        notFulfilled: t.notFulfilled,
        notFulfilled_tone: toneOfCount(t.notFulfilled, "bad"),
        awaiting: t.awaiting,
        notAssessed: t.notAssessed,
        share: pct(t.fulfilled, t.inScope),
        critical: lc.critical,
        critical_tone: toneOfCount(lc.critical, "bad"),
        owner: fam.owner,
      };
    });
  return {
    type: "table",
    title,
    columns: [
      col("chapter", "Chapter", 3.2),
      col("inScope", "In scope", 0.8, { kind: "num" }),
      col("fulfilled", "Fulfilled", 0.9, { kind: "num" }),
      col("notFulfilled", "Not fulfilled", 1, { kind: "num", tone: true }),
      col("awaiting", "Awaiting review", 1.1, { kind: "num" }),
      col("notAssessed", "Not assessed", 1, { kind: "num" }),
      col("share", "% fulfilled", 0.9, { kind: "pct" }),
      col("critical", "Critical", 0.8, { kind: "num", tone: true }),
      col("owner", "Owner", 2.2),
    ],
    rows,
  };
}

function aboutSection(data, extra = []) {
  return {
    id: "about",
    title: "About this report",
    blocks: [
      { type: "note", text: `Prepared by the Venue Compliance Hub on ${longDate(data.now)}. The figures come from the compliance register (dated ${data.registerDate}) and from any evidence or review recorded in the application since.` },
      { type: "note", text: "Fulfilled means a reviewer has accepted the requirement. Not fulfilled counts requirements that are non-compliant or only partially compliant. Awaiting review means evidence has been submitted and no reviewer has decided yet." },
      { type: "note", text: "Exposure classes: " + ["critical", "material", "manageable", "controlled"].map((k) => `${data.exposure[k].label} (${data.exposure[k].definition.replace(/\.$/, "")})`).join("; ") + "." },
      { type: "note", text: "For most requirements the 2034 contract clause is still to be confirmed, so thresholds are provisional. Use these figures to steer the programme, not as a certification." },
      ...extra.map((text) => ({ type: "note", text })),
    ],
  };
}

function headline(sts, per, f) {
  const all = per.flatMap((p) => p.rows);
  const t = tally(all);
  const lc = levels(all);
  const risky = per.filter((p) => p.lc.critical + p.lc.material > 0);
  const off = per.filter((p) => p.sch.key === "off-track").length;
  const first = `${Math.round(pct(t.fulfilled, t.inScope) * 100)}% of the ${num(t.inScope)} in-scope requirements are fulfilled across ${plural(sts.length, "stadium")}${f.family ? " in this chapter" : ""}.`;
  const second = risky.length
    ? ` ${plural(risky.length, "stadium")} carry${risky.length === 1 ? "es" : ""} critical or material findings (${off} off track, ${risky.length - off} at risk).`
    : " No stadium carries critical or material findings.";
  const third = ` ${plural(lc.critical, "critical finding")} and ${plural(lc.material, "material finding")} are open, and ${plural(t.awaiting, "submission")} await${t.awaiting === 1 ? "s" : ""} a reviewer's decision.`;
  return first + second + third;
}

// ---------- scopes ----------
function multiReport(kind, config, data, subject) {
  const f = { family: config.narrow?.kind === "family" ? config.narrow.id : null, owner: kind === "owner" ? config.target : null };
  let sts = subject.stadiums;
  const per = sts.map((s) => {
    const rows = rowsOf(s, f);
    return { s, rows, t: tally(rows), lc: levels(rows), sch: data.schedule(levels(rows)) };
  });
  const all = per.flatMap((p) => p.rows);
  const t = tally(all);
  const lc = levels(all);
  const risky = per.filter((p) => p.lc.critical + p.lc.material > 0).length;
  const alerts = data.alerts.filter(
    (a) =>
      a.status === "open" &&
      sts.some((s) => s.id === a.stadiumId) &&
      (!f.owner || a.owner === f.owner) &&
      (!f.family || (a.requirementId && all.some((r) => r.id === a.requirementId && r.familyId === f.family))),
  );
  const sections = [];

  sections.push({
    id: "summary",
    title: "Summary",
    blocks: [
      {
        type: "kpis",
        items: [
          { label: "Requirements fulfilled", value: `${Math.round(pct(t.fulfilled, t.inScope) * 100)}%`, sub: `${num(t.fulfilled)} of ${num(t.inScope)}`, tone: pct(t.fulfilled, t.inScope) >= 0.85 ? "good" : pct(t.fulfilled, t.inScope) >= 0.5 ? "warn" : "bad" },
          { label: "Stadiums at risk", value: `${risky} of ${sts.length}`, sub: "with critical or material findings", tone: risky ? "warn" : "good" },
          { label: "Critical findings", value: num(lc.critical), sub: `${num(lc.material)} material`, tone: lc.critical ? "bad" : "good" },
          { label: "Awaiting review", value: num(t.awaiting), sub: "submissions without a decision", tone: t.awaiting ? "warn" : "good" },
          { label: "Open alerts", value: num(alerts.length), sub: `${alerts.filter((a) => a.severity === "high").length} high severity`, tone: alerts.length ? "warn" : "good" },
        ],
      },
      { type: "text", text: headline(sts, per, f) },
    ],
  });

  sections.push({
    id: "portfolio",
    title: "Stadiums",
    blocks: [
      {
        type: "table",
        title: `${plural(sts.length, "stadium")}, highest exposure first`,
        columns: [
          col("stadium", "Stadium", 3.2),
          col("city", "City", 1.1),
          col("due", "Due", 0.65, { kind: "year" }),
          col("inScope", "In scope", 0.8, { kind: "num" }),
          col("fulfilled", "Fulfilled", 0.85, { kind: "num" }),
          col("notFulfilled", "Not fulfilled", 1, { kind: "num" }),
          col("awaiting", "Awaiting review", 1.1, { kind: "num" }),
          col("notAssessed", "Not assessed", 1, { kind: "num" }),
          col("share", "% fulfilled", 0.9, { kind: "pct" }),
          col("critical", "Critical", 0.9, { kind: "num", tone: true }),
          col("material", "Material", 0.95, { kind: "num", tone: true }),
          col("schedule", "Schedule", 0.95, { kind: "tone" }),
          col("gate", "Next gate", 1.3),
        ],
        rows: [...per]
          .sort((a, b) => b.lc.critical - a.lc.critical || b.lc.material - a.lc.material || pct(a.t.fulfilled, a.t.inScope) - pct(b.t.fulfilled, b.t.inScope) || a.s.name.localeCompare(b.s.name))
          .map((p) => ({
            stadium: p.s.name,
            city: p.s.city,
            due: p.s.completionYear,
            inScope: p.t.inScope,
            fulfilled: p.t.fulfilled,
            notFulfilled: p.t.notFulfilled,
            awaiting: p.t.awaiting,
            notAssessed: p.t.notAssessed,
            share: pct(p.t.fulfilled, p.t.inScope),
            critical: p.lc.critical,
            critical_tone: toneOfCount(p.lc.critical, "bad"),
            material: p.lc.material,
            material_tone: toneOfCount(p.lc.material, "warn"),
            schedule: p.sch.label,
            schedule_tone: p.sch.tone,
            gate: p.s.gate,
          })),
      },
    ],
  });

  if (kind === "owner") {
    const owned = data.families.filter((fam) => all.some((r) => r.familyId === fam.id));
    sections[0].blocks.push({ type: "facts", items: [{ label: "Chapters", value: owned.map((x) => x.label).join("; ") || "None" }] });
  } else {
    sections.push({ id: "chapters", title: "Chapters", blocks: [chapterTable(sts, f)] });
  }

  const items = per.flatMap((p) => p.rows.map((row) => ({ stadium: p.s, row })));
  sections.push({
    id: "findings",
    title: "Findings",
    blocks: [findingsTable(items, { title: kind === "owner" ? "Actions for this owner" : "Open findings, most urgent first", maxRows: 40, ownerColumn: kind !== "owner" })],
  });
  sections.push({ id: "alerts", title: "Alerts", blocks: [alertsTable(alerts)] });
  sections.push(aboutSection(data, subject.notes));
  return sections;
}

function stadiumReport(config, data, stadium) {
  const f = { family: config.narrow?.kind === "family" ? config.narrow.id : null };
  const rows = rowsOf(stadium, f);
  const t = tally(rows);
  const lc = levels(rows);
  const sch = data.schedule(lc);
  const alerts = data.alerts.filter((a) => a.status === "open" && a.stadiumId === stadium.id && (!f.family || (a.requirementId && rows.some((r) => r.id === a.requirementId))));
  const sections = [];
  sections.push({
    id: "summary",
    title: "Summary",
    blocks: [
      {
        type: "kpis",
        items: [
          { label: "Requirements fulfilled", value: `${Math.round(pct(t.fulfilled, t.inScope) * 100)}%`, sub: `${num(t.fulfilled)} of ${num(t.inScope)}`, tone: pct(t.fulfilled, t.inScope) >= 0.85 ? "good" : pct(t.fulfilled, t.inScope) >= 0.5 ? "warn" : "bad" },
          { label: "Not fulfilled", value: num(t.notFulfilled), sub: t.partial ? `${num(t.partial)} partially compliant` : "non-compliant", tone: t.notFulfilled ? "bad" : "good" },
          { label: "Awaiting review", value: num(t.awaiting), sub: "submissions without a decision", tone: t.awaiting ? "warn" : "good" },
          { label: "Not assessed", value: num(t.notAssessed), sub: "no evidence yet", tone: "mute" },
          { label: "Critical findings", value: num(lc.critical), sub: `${num(lc.material)} material`, tone: lc.critical ? "bad" : "good" },
        ],
      },
      {
        type: "facts",
        items: [
          { label: "City", value: stadium.city },
          { label: "Delivery status", value: `${stadium.statusLabel}, complete ${stadium.completionYear}` },
          { label: "Highest match", value: stadium.matchLabel },
          { label: "Declared capacity", value: `${num(stadium.grossCapacity)} seats` },
          { label: "Schedule position", value: sch.label },
          { label: "Next gate", value: stadium.gate },
          ...(f.family ? [{ label: "Limited to", value: data.families.find((x) => x.id === f.family)?.label }] : []),
        ],
      },
    ],
  });
  sections.push({
    id: "exposure",
    title: "Exposure",
    blocks: [
      {
        type: "table",
        title: "Findings by mitigation exposure",
        columns: [col("cls", "Class", 1.2, { kind: "tone" }), col("count", "Requirements", 1, { kind: "num" }), col("meaning", "What it means", 7)],
        rows: ["critical", "material", "manageable", "controlled"].map((k) => ({ cls: data.exposure[k].label, cls_tone: data.exposure[k].tone, count: lc[k], meaning: data.exposure[k].definition })),
      },
    ],
  });
  sections.push({ id: "chapters", title: "Chapters", blocks: [chapterTable([stadium], f)] });
  sections.push({ id: "findings", title: "Open findings", blocks: [findingsTable(rows.map((row) => ({ stadium, row })), { title: "Open findings, most urgent first", maxRows: 40, stadiumColumn: false })] });

  const families = [...new Set(rows.map((r) => r.familyId))].sort();
  sections.push({
    id: "requirements",
    title: "Requirements",
    blocks: families.map((id) => {
      const own = rows.filter((r) => r.familyId === id).sort(bySection);
      const name = own[0].family;
      return {
        type: "table",
        title: `${id} ${name} · ${plural(own.length, "requirement")}`,
        columns: [
          col("id", "ID", 0.9),
          col("title", "Requirement", 3.6),
          col("required", "Required", 2),
          col("status", "Status", 1.3, { kind: "tone" }),
          col("value", "Recorded", 1),
          col("date", "Evidence date", 1.1),
          col("owner", "Owner", 1.9),
          col("file", "Evidence file", 3, { formats: ["xlsx"] }),
          col("action", "Next step", 3.6, { formats: ["xlsx"] }),
        ],
        rows: own.map((r) => ({ id: r.id, title: r.title, required: r.required, status: r.status, status_tone: TONE_OF_STATUS[r.status], value: r.value, date: r.evidenceDate, owner: r.owner, file: r.evidenceFile, action: r.action })),
      };
    }),
  });

  const docs = data.documents.filter((d) => d.stadiumId === stadium.id);
  if (docs.length)
    sections.push({
      id: "documents",
      title: "Documents",
      blocks: [
        {
          type: "table",
          title: "Documents on file from the Evidence page",
          columns: [col("name", "Document", 4), col("kind", "Type", 1.4), col("rev", "Revision", 0.9), col("date", "Date", 1.1), col("registered", "Recorded against", 3)],
          rows: docs.map((d) => ({ name: d.name, kind: d.kind === "evidence" ? "Evidence" : d.kind === "progress-report" ? "Progress report" : d.kind === "detailed-plan" ? "Detailed plan" : "Other", rev: d.revision, date: d.asOf, registered: d.superseded ? "Replaced by a newer revision" : d.registered.join(", ") })),
        },
      ],
    });
  sections.push({ id: "alerts", title: "Alerts", blocks: [alertsTable(alerts, { stadiumColumn: false })] });
  sections.push(aboutSection(data));
  return sections;
}

function chapterReport(config, data, family) {
  const city = config.narrow?.kind === "city" ? config.narrow.id : null;
  const sts = data.stadiums.filter((s) => !city || s.cityId === city);
  const f = { family: family.id };
  const per = sts.map((s) => {
    const rows = rowsOf(s, f);
    return { s, rows, t: tally(rows), lc: levels(rows) };
  });
  const all = per.flatMap((p) => p.rows);
  const t = tally(all);
  const lc = levels(all);
  const reqIds = [...new Set(all.map((r) => r.id))];
  const alerts = data.alerts.filter((a) => a.status === "open" && sts.some((s) => s.id === a.stadiumId) && a.requirementId && all.some((r) => r.id === a.requirementId));
  const sections = [];
  sections.push({
    id: "summary",
    title: "Summary",
    blocks: [
      {
        type: "kpis",
        items: [
          { label: "Requirements fulfilled", value: `${Math.round(pct(t.fulfilled, t.inScope) * 100)}%`, sub: `${num(t.fulfilled)} of ${num(t.inScope)} stadium requirements`, tone: pct(t.fulfilled, t.inScope) >= 0.85 ? "good" : pct(t.fulfilled, t.inScope) >= 0.5 ? "warn" : "bad" },
          { label: "Not fulfilled", value: num(t.notFulfilled), sub: t.partial ? `${num(t.partial)} partially compliant` : "non-compliant", tone: t.notFulfilled ? "bad" : "good" },
          { label: "Awaiting review", value: num(t.awaiting), sub: "submissions without a decision", tone: t.awaiting ? "warn" : "good" },
          { label: "Critical findings", value: num(lc.critical), sub: `${num(lc.material)} material`, tone: lc.critical ? "bad" : "good" },
          { label: "Open alerts", value: num(alerts.length), sub: "for this chapter", tone: alerts.length ? "warn" : "good" },
        ],
      },
      {
        type: "facts",
        items: [
          { label: "Chapter", value: family.label },
          { label: "What it covers", value: family.description },
          { label: "Owner", value: family.owner },
          { label: "FIFA stadium book", value: `from page ${family.page}` },
          { label: "Requirements", value: `${plural(reqIds.length, "requirement")} at ${plural(sts.length, "stadium")}${city ? ` in ${sts[0]?.city || ""}` : ""}` },
        ],
      },
    ],
  });
  sections.push({
    id: "stadiums",
    title: "Stadiums",
    blocks: [
      {
        type: "table",
        title: "How each stadium stands in this chapter",
        columns: [
          col("stadium", "Stadium", 3.2),
          col("city", "City", 1.1),
          col("inScope", "In scope", 0.8, { kind: "num" }),
          col("fulfilled", "Fulfilled", 0.9, { kind: "num" }),
          col("notFulfilled", "Not fulfilled", 1, { kind: "num" }),
          col("awaiting", "Awaiting review", 1.1, { kind: "num" }),
          col("notAssessed", "Not assessed", 1, { kind: "num" }),
          col("share", "% fulfilled", 0.9, { kind: "pct" }),
          col("critical", "Critical", 0.9, { kind: "num", tone: true }),
          col("material", "Material", 0.95, { kind: "num", tone: true }),
        ],
        rows: [...per]
          .sort((a, b) => pct(a.t.fulfilled, a.t.inScope) - pct(b.t.fulfilled, b.t.inScope) || a.s.name.localeCompare(b.s.name))
          .map((p) => ({ stadium: p.s.name, city: p.s.city, inScope: p.t.inScope, fulfilled: p.t.fulfilled, notFulfilled: p.t.notFulfilled, awaiting: p.t.awaiting, notAssessed: p.t.notAssessed, share: pct(p.t.fulfilled, p.t.inScope), critical: p.lc.critical, critical_tone: toneOfCount(p.lc.critical, "bad"), material: p.lc.material, material_tone: toneOfCount(p.lc.material, "warn") })),
      },
    ],
  });
  const byReq = new Map();
  for (const r of all) {
    if (!byReq.has(r.id)) byReq.set(r.id, { row: r, rows: [] });
    byReq.get(r.id).rows.push(r);
  }
  sections.push({
    id: "requirements",
    title: "Requirements",
    blocks: [
      {
        type: "table",
        title: "Requirements in this chapter, across the stadiums",
        columns: [
          col("id", "ID", 0.9),
          col("title", "Requirement", 3.6),
          col("section", "Section", 2),
          col("required", "Required", 2),
          col("fulfilled", "Fulfilled", 0.9, { kind: "num" }),
          col("notFulfilled", "Not fulfilled", 1, { kind: "num", tone: true }),
          col("awaiting", "Awaiting review", 1.1, { kind: "num" }),
          col("notAssessed", "Not assessed", 1, { kind: "num" }),
        ],
        rows: [...byReq.values()]
          .sort((a, b) => bySection(a.row, b.row))
          .map(({ row, rows: rs }) => {
            const x = tally(rs);
            return { id: row.id, title: row.title, section: row.section, required: row.required, fulfilled: x.fulfilled, notFulfilled: x.notFulfilled, notFulfilled_tone: toneOfCount(x.notFulfilled, "bad"), awaiting: x.awaiting, notAssessed: x.notAssessed };
          }),
      },
    ],
  });
  sections.push({ id: "findings", title: "Findings", blocks: [findingsTable(per.flatMap((p) => p.rows.map((row) => ({ stadium: p.s, row }))), { title: "Open findings in this chapter, most urgent first", maxRows: 40 })] });
  sections.push({ id: "alerts", title: "Alerts", blocks: [alertsTable(alerts)] });
  sections.push(aboutSection(data));
  return sections;
}

/** Build the report for a choice. config: { scope, target, narrow: { kind, id } | null }. */
export function buildReport(config, data) {
  if (!isComplete(config)) throw new Error("Choose what the report is for first.");
  const scope = config.scope;
  let title;
  let subjectName;
  let sections;
  const notes = [];
  const narrowLabel = (() => {
    if (!config.narrow) return null;
    const opt = narrowFor(scope, data)?.options.find((o) => o.id === config.narrow.id);
    return opt ? `${narrowFor(scope, data).label.replace("Limit to one", "Limited to")}: ${opt.label}` : null;
  })();

  if (scope === "programme") {
    title = "Programme compliance report";
    subjectName = "programme";
    sections = multiReport("programme", config, data, { stadiums: data.stadiums, notes });
  } else if (scope === "city") {
    const city = data.cities.find((c) => c.id === config.target);
    title = `${city.name}: compliance report`;
    subjectName = city.name;
    sections = multiReport("city", config, data, { stadiums: data.stadiums.filter((s) => s.cityId === city.id), notes });
  } else if (scope === "stadium") {
    const stadium = data.stadiums.find((s) => s.id === config.target);
    title = `${stadium.name}: compliance report`;
    subjectName = stadium.name;
    sections = stadiumReport(config, data, stadium);
  } else if (scope === "chapter") {
    const family = data.families.find((x) => x.id === config.target);
    title = `${family.label}: compliance report`;
    subjectName = family.label;
    sections = chapterReport(config, data, family);
  } else {
    title = `${config.target}: action report`;
    subjectName = config.target;
    const sts = config.narrow?.kind === "stadium" ? data.stadiums.filter((s) => s.id === config.narrow.id) : data.stadiums;
    sections = multiReport("owner", config, data, { stadiums: sts, notes });
  }

  const scopeLine = {
    programme: `All ${data.stadiums.length} stadiums`,
    city: `Host city · ${subjectName}`,
    stadium: `Stadium · ${subjectName}`,
    chapter: `Chapter · ${subjectName}`,
    owner: `Owner · ${subjectName}`,
  }[scope] + (narrowLabel ? ` · ${narrowLabel}` : "");

  return {
    title,
    subtitle: `Venue Compliance Hub · ${longDate(data.now)}`,
    scopeLine,
    generatedText: longDate(data.now),
    generatedIso: isoDate(data.now),
    filenameBase: `venue-compliance-hub_${slug(subjectName)}${config.narrow ? `_${slug(config.narrow.id)}` : ""}_${isoDate(data.now)}`,
    sections: sections.filter((s) => s.blocks.length),
  };
}

/** Which columns a format shows. */
export const columnsFor = (block, format) => block.columns.filter((c) => !c.formats || c.formats.includes(format));
/** The rows a format shows (documents cap long tables; the workbook has every row) and how many were left out. */
export function rowsFor(block, format) {
  const cap = format === "xlsx" ? null : block.maxRows?.[format];
  if (cap && block.rows.length > cap) return { rows: block.rows.slice(0, cap), hidden: block.rows.length - cap };
  return { rows: block.rows, hidden: 0 };
}
