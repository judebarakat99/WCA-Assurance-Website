// Venue Compliance Hub: contractor reporting and the executive report, as two new choices on the Reports page.
// Run from the frontend folder:  node apply-reports-oversight.mjs
//
// Needs the earlier kits installed, including the evidence and reports kit, the reports width fix and twin-areas-kit.zip.
//  - Contractor reporting: the status of the reports that contractors, programme managers, engineering firms and asset
//    owners send on each stadium: on time, late, not received, and which sections are missing, with the escalation level
//    for anything overdue. Data lives in ../data/oversight (parties.csv and submissions.csv).
//  - Executive report: one consolidated report for leadership: where intervention is needed now, the stadium portfolio,
//    reporting, site conditions and the design review, and changes to the register.
// Both come out as Word, Excel and PDF, with the same preview as the other reports.
// It edits src/lib/reports/model.mjs and data.js (and, optionally, pdf.js, so a small table is not split across two pages)
// with exact-text edits, replaces src/components/pages/ReportsPage.jsx
// (only when it is the page from the evidence and reports kit), adds one block to the stylesheet and, if package.json
// builds the register, makes it build the reporting data too. Safe to run again. If a file does not match what this
// script expects, it says which one and writes nothing at all.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const front = process.cwd();
const src = path.join(front, "src");
const repoData = path.resolve(front, "..", "data");

if (!fs.existsSync(src)) { console.error("Run this from the frontend folder (src/ not found)."); process.exit(1); }
const need = [
  "lib/reports/model.mjs",
  "lib/reports/data.js",
  "lib/reports/text.mjs",
  "components/pages/ReportsPage.jsx",
  "lib/domain/siteConditions.mjs",
  "lib/domain/requirementVersions.mjs",
  "lib/register/csv.mjs",
];
const missing = need.filter((f) => !fs.existsSync(path.join(src, f)));
if (missing.length) {
  console.error(`These files are missing: ${missing.map((f) => "src/" + f).join(", ")}.\nApply the earlier kits first, including twin-areas-kit.zip. Nothing was written.`);
  process.exit(1);
}
if (!fs.existsSync(path.join(repoData, "facilities", "register.json"))) {
  console.error("data/facilities/register.json was not found next to the frontend folder. Nothing was written.");
  process.exit(1);
}

const readText = (p) => {
  let raw = fs.readFileSync(p, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  return { text: raw.replace(/\r\n/g, "\n"), crlf: raw.includes("\r\n") };
};
const writeText = (p, text, crlf) => fs.writeFileSync(p, crlf ? text.replace(/\n/g, "\r\n") : text, "utf8");
const count = (a, b) => a.split(b).length - 1;
const exact = (name, from, to, applied) => ({
  name,
  applied: applied || ((t) => t.includes(to)),
  apply: (t) => (count(t, from) === 1 ? t.replace(from, () => to) : null),
});

// ---------- model.mjs ----------
const MODEL = [
  exact(
    "import",
    'import { longDate, isoDate, num, pct, plural, slug } from "@/lib/reports/text.mjs";',
    'import { longDate, isoDate, num, pct, plural, slug } from "@/lib/reports/text.mjs";\nimport { contractorReport, executiveReport } from "@/lib/reports/oversight.mjs";',
  ),
  exact(
    "the two new choices",
    '  { id: "owner", label: "Owner", hint: "What one owner has to act on", targetLabel: "Owner" },\n];',
    [
      '  { id: "owner", label: "Owner", hint: "What one owner has to act on", targetLabel: "Owner" },',
      '  { id: "contractors", label: "Contractor reporting", hint: "Who has reported, who is late and what is missing", targetLabel: null, group: "oversight" },',
      '  { id: "executive", label: "Executive report", hint: "One consolidated report for the programme\'s leadership", targetLabel: null, group: "oversight" },',
      "];",
      "/** How the choices are grouped on the Reports page. A choice with no group is a compliance report. */",
      "export const SCOPE_GROUPS = [",
      '  { id: "compliance", label: "Compliance reports" },',
      '  { id: "oversight", label: "Oversight and leadership" },',
      "];",
    ].join("\n"),
    (t) => t.includes("SCOPE_GROUPS"),
  ),
  exact(
    "contractor reporting can be limited to one stadium",
    '  if (scope === "programme" || scope === "city" || scope === "stadium")\n    return { label: "Limit to one chapter"',
    '  if (scope === "contractors")\n    return { label: "Limit to one stadium", options: [...data.stadiums].sort((a, b) => a.name.localeCompare(b.name)).map((s) => ({ id: s.id, label: s.name })), kind: "stadium" };\n  if (scope === "programme" || scope === "city" || scope === "stadium")\n    return { label: "Limit to one chapter"',
    (t) => t.includes('if (scope === "contractors")'),
  ),
  exact(
    "the two reports are built",
    '  } else {\n    title = `${config.target}: action report`;',
    [
      '  } else if (scope === "contractors") {',
      '    title = "Contractor and delivery-partner reporting";',
      '    subjectName = "contractor reporting";',
      "    sections = contractorReport(config, data);",
      '  } else if (scope === "executive") {',
      '    title = "Executive report: programme status";',
      '    subjectName = "executive report";',
      "    sections = executiveReport(config, data);",
      "  } else {",
      "    title = `${config.target}: action report`;",
    ].join("\n"),
    (t) => t.includes("contractorReport(config, data)"),
  ),
  exact(
    "their subtitle lines",
    "    owner: `Owner · ${subjectName}`,\n  }[scope]",
    "    owner: `Owner · ${subjectName}`,\n    contractors: \"Contractors, programme managers, engineering firms and asset owners\",\n    executive: `Where does intervention need to happen now? · All ${data.stadiums.length} stadiums`,\n  }[scope]",
    (t) => t.includes("Where does intervention need to happen now?"),
  ),
];

// ---------- data.js ----------
const DATA = [
  exact(
    "imports",
    'import { FAMILIES, REGISTER_DATE } from "@/lib/register/data.mjs";',
    [
      'import { FAMILIES, REGISTER_DATE } from "@/lib/register/data.mjs";',
      'import { KIND, SITE_CONDITIONS, isLogged, loggedOn } from "@/lib/domain/siteConditions.mjs";',
      'import { appliedChanges, currentRequirement } from "@/lib/domain/requirementVersions.mjs";',
      'import { oversightSnapshot } from "@/lib/oversight/status.mjs";',
    ].join("\n"),
    (t) => t.includes("oversightSnapshot"),
  ),
  exact(
    "filed documents carry the day they were filed",
    "    superseded: !!d.superseded,\n  }));",
    '    superseded: !!d.superseded,\n    filedAt: d.filed_at || "",\n  }));',
    (t) => t.includes("filedAt: d.filed_at"),
  ),
  exact(
    "reporting, site conditions, the design review and changes",
    "  const owners = [...new Set(stadiums.flatMap((s) => s.rows.map((r) => r.owner)))].sort();",
    [
      "  // Reporting status of the parties that report on each stadium (a progress report filed on the Evidence page counts).",
      "  const oversight = oversightSnapshot({ now, stadiums: stadiums.map((s) => ({ id: s.id, name: s.name, city: s.city, completionYear: s.completionYear })), documents: filed });",
      "",
      "  // Site conditions logged on the 3D view's Critical areas tab, with the requirements they raise.",
      "  const siteConditions = SITE_CONDITIONS.filter((c) => isLogged(c.id)).map((c) => {",
      "    const st = stadiums.find((s) => s.id === c.stadiumId);",
      "    return {",
      "      id: c.id,",
      "      kind: KIND[c.kind].label,",
      "      title: c.title,",
      "      source: c.source,",
      "      logged: shortDate(loggedOn(c.id)),",
      "      stadiumId: c.stadiumId,",
      "      effects: c.effects.map((e) => {",
      "        const row = st?.rows.find((r) => r.id === e.requirementId);",
      "        return { requirementId: e.requirementId, title: row?.title || e.requirementId, level: row?.levelLabel || \"\" };",
      "      }),",
      "    };",
      "  });",
      "",
      "  // The design review of King Salman International Stadium: the latest result recorded for each requirement it checked.",
      '  const designStadium = stadiums.find((s) => s.id === "king-salman-international");',
      "  const designItems = [];",
      "  for (const rec of Object.values(records)) {",
      '    if (rec.facilityId !== "king-salman-international") continue;',
      '    const e = [...(rec.evidence || [])].reverse().find((x) => String(x.file || "").startsWith("KSIS-"));',
      "    if (!e) continue;",
      "    designItems.push({ requirementId: rec.requirementId, title: designStadium?.rows.find((r) => r.id === rec.requirementId)?.title || currentRequirement(rec.requirementId)?.title || rec.requirementId, check: e.check, file: e.file });",
      "  }",
      "  const designReview = designItems.length",
      "    ? {",
      "        stadium: designStadium?.name || \"King Salman International Stadium\",",
      '        revision: designItems.map((i) => /Rev([A-Z])/.exec(i.file)?.[1] || "").sort().at(-1) || "",',
      "        total: designItems.length,",
      '        pass: designItems.filter((i) => i.check === "pass").length,',
      '        fail: designItems.filter((i) => i.check === "fail").length,',
      '        review: designItems.filter((i) => i.check !== "pass" && i.check !== "fail").length,',
      "        items: designItems,",
      "      }",
      "    : null;",
      "",
      "  // Requirement changes applied to the register.",
      "  const changes = appliedChanges().map((c) => ({ id: c.changeId, requirementId: c.requirementId, title: currentRequirement(c.requirementId)?.title || c.requirementId, version: c.version, required: criterionText(c.criterion), on: shortDate(c.on) }));",
      "",
      "  const owners = [...new Set(stadiums.flatMap((s) => s.rows.map((r) => r.owner)))].sort();",
    ].join("\n"),
    (t) => t.includes("const oversight = oversightSnapshot("),
  ),
  exact(
    "the report data carries them",
    "    exposure: EXPOSURE,\n    schedule: schedulePosition,\n  };",
    "    exposure: EXPOSURE,\n    schedule: schedulePosition,\n    oversight,\n    siteConditions,\n    designReview,\n    changes,\n  };",
    (t) => t.includes("    oversight,\n    siteConditions,"),
  ),
];

// ---------- pdf.js (optional): a small table stays on one page, with its heading ----------
const WHOLE_FN = [
  "/** The height of a whole table in the PDF, used to keep a table that fits on one page together (0 for an empty table). */",
  "function wholeTableHeight(p, block) {",
  '  const columns = columnsFor(block, "pdf");',
  '  const { rows } = rowsFor(block, "pdf");',
  "  if (!rows.length) return 0;",
  "  const total = columns.reduce((a, c) => a + c.w, 0);",
  "  const widths = columns.map((c) => (c.w / total) * (PAGE[0] - 2 * M));",
  "  const size = 7.8;",
  "  const lh = 10;",
  "  const pad = 4;",
  '  const show = (c, v) => (c.kind === "pct" ? `${Math.round(v * 100)}%` : c.kind === "num" && typeof v === "number" ? num(v) : String(v ?? ""));',
  "  const head = Math.max(...columns.map((c, i) => p.wrap(c.label, p.f.bold, size, widths[i] - 2 * pad).length)) * lh + 2 * pad;",
  "  return head + rows.reduce((t, row) => t + Math.max(...columns.map((c, i) => p.wrap(show(c, row[c.key]), p.f.regular, size, widths[i] - 2 * pad).length)) * lh + 2 * pad, 0);",
  "}",
  "",
].join("\n");
const PDF_KEEP = [
  {
    name: "a small table starts on a new page when it does not fit, with its heading",
    optional: true,
    applied: (t) => t.includes("function wholeTableHeight("),
    apply: (t) => {
      const edits = [
        ["function drawTable(p, block) {", WHOLE_FN + "function drawTable(p, block) {"],
        [
          "  if (block.title) {\n    p.need(46);",
          "  // A table that fits on one page stays together: if the space left is too small it starts on the next page.\n  const whole = wholeTableHeight(p, block);\n  const keep = whole > 0 && whole <= 340 ? whole + (block.title ? 30 : 0) : 46;\n  if (block.title) {\n    p.need(keep);",
        ],
        ["  p.need(headH + 40);\n  drawHeader();", "  p.need(Math.max(headH + 40, block.title ? 0 : keep));\n  drawHeader();"],
        [
          "function heading(p, text) {\n  p.need(60);",
          "function heading(p, text, firstBlock) {\n  // a heading moves to the next page together with a small table that follows it\n  const w = firstBlock && firstBlock.type === \"table\" ? wholeTableHeight(p, firstBlock) : 0;\n  p.need(w > 0 && w <= 340 ? 60 + w + (firstBlock.title ? 30 : 0) : 60);",
        ],
        ["    heading(p, section.title);", "    heading(p, section.title, section.blocks[0]);"],
      ];
      let out = t;
      for (const [from, to] of edits) {
        if (count(out, from) !== 1) return null;
        out = out.replace(from, () => to);
      }
      return out;
    },
  },
];

const plans = [
  { rel: "lib/reports/model.mjs", steps: MODEL },
  { rel: "lib/reports/data.js", steps: DATA },
  { rel: "lib/reports/pdf.js", steps: PDF_KEEP },
];
const edits = [];
let problems = 0;
for (const { rel, steps } of plans) {
  const full = path.join(src, rel);
  const file = readText(full);
  let text = file.text;
  let changed = false;
  for (const step of steps) {
    if (step.applied(text)) { console.log(`already in place: ${rel} [${step.name}]`); continue; }
    const next = step.apply(text);
    if (next == null && step.optional) { console.log(`skipped (not found): ${rel} [${step.name}]`); continue; }
    if (next == null) { console.error(`NOT APPLIED   src/${rel} [${step.name}]: the text is not what I expected`); problems++; continue; }
    text = next;
    changed = true;
  }
  edits.push({ rel, full, text, crlf: file.crlf, changed });
}

// The Reports page is replaced only when it is the one installed by the evidence and reports kit.
const pagePath = path.join(src, "components", "pages", "ReportsPage.jsx");
const page = readText(pagePath);
const newPage = readText(path.join(here, "files", "frontend", "src", "components", "pages", "ReportsPage.jsx"));
let pageAction = "replace";
if (page.text === newPage.text) pageAction = "same";
else if (!page.text.includes('chip="Reports · export"') || !page.text.includes("function Reports()")) {
  console.error("NOT APPLIED   src/components/pages/ReportsPage.jsx: it is not the Reports page from the evidence and reports kit, so it was left alone");
  problems++;
}

// package.json: build the reporting data wherever the register is built.
const pkgPath = path.join(front, "package.json");
let pkgEdit = null;
if (fs.existsSync(pkgPath)) {
  const pkg = readText(pkgPath);
  let json = null;
  try { json = JSON.parse(pkg.text); } catch { json = null; }
  if (!json || typeof json !== "object") {
    console.error("NOT APPLIED   package.json: it could not be read, so it was left alone");
    problems++;
  } else {
    const scripts = json.scripts || {};
    let changed = false;
    for (const [name, value] of Object.entries(scripts)) {
      if (typeof value === "string" && value.includes("build-register.mjs") && !value.includes("build-oversight.mjs")) {
        scripts[name] = `${value} && node scripts/build-oversight.mjs`;
        changed = true;
      }
    }
    if (!scripts["oversight:build"]) {
      scripts["oversight:build"] = "node scripts/build-oversight.mjs";
      changed = true;
    }
    if (changed) {
      json.scripts = scripts;
      const indent = /^(\s+)"/m.exec(pkg.text)?.[1] || "  ";
      pkgEdit = { text: JSON.stringify(json, null, indent) + "\n", crlf: pkg.crlf };
    }
  }
}

if (problems) {
  console.error(`\n${problems} problem(s). Nothing was written.`);
  process.exit(2);
}

// ---------- write ----------
function copyTree(fromRoot, toRoot, { skipExisting = false, onlyExt = null } = {}) {
  for (const entry of fs.readdirSync(fromRoot, { withFileTypes: true })) {
    const from = path.join(fromRoot, entry.name);
    const to = path.join(toRoot, entry.name);
    if (entry.isDirectory()) { copyTree(from, to, { skipExisting, onlyExt }); continue; }
    if (onlyExt && !entry.name.endsWith(onlyExt)) continue;
    const exists = fs.existsSync(to);
    if (exists && skipExisting) { console.log("kept     " + path.relative(path.resolve(front, ".."), to).replace(/\\/g, "/") + " (already there)"); continue; }
    const body = readText(from);
    if (exists && readText(to).text === body.text) { console.log("already in place: " + path.relative(path.resolve(front, ".."), to).replace(/\\/g, "/")); continue; }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    const csv = entry.name.endsWith(".csv");
    if (csv) fs.writeFileSync(to, fs.readFileSync(from));
    else writeText(to, body.text, exists ? readText(to).crlf : true);
    console.log("wrote   " + path.relative(path.resolve(front, ".."), to).replace(/\\/g, "/"));
  }
}
// the reporting data (kept as it is if it is already there, so edits to the CSVs are not lost)
copyTree(path.join(here, "files", "data"), repoData, { skipExisting: true });
// the code
const codeRoot = path.join(here, "files", "frontend");
for (const sub of ["scripts", path.join("src", "lib", "oversight"), path.join("src", "lib", "reports")]) copyTree(path.join(codeRoot, sub), path.join(front, sub));
if (pageAction === "same") console.log("already in place: components/pages/ReportsPage.jsx");
else {
  writeText(pagePath, newPage.text, page.crlf);
  console.log("wrote   src/components/pages/ReportsPage.jsx");
}

const cssPath = path.join(src, "styles", "components.css");
const MARK = "/* ---------- Reports: contractor reporting and executive report (Venue Compliance Hub) ---------- */";
if (!fs.existsSync(cssPath)) console.error("src/styles/components.css not found; styles not added.");
else {
  const css = readText(cssPath);
  if (css.text.includes(MARK)) console.log("already in place: components.css");
  else {
    writeText(cssPath, css.text.replace(/\n*$/, "\n") + readText(path.join(here, "files", "oversight.css")).text, css.crlf);
    console.log("edited  src/styles/components.css");
  }
}
for (const e of edits) if (e.changed) { writeText(e.full, e.text, e.crlf); console.log("edited  src/" + e.rel); }
if (pkgEdit) { writeText(pkgPath, pkgEdit.text, pkgEdit.crlf); console.log("edited  package.json (the reporting data is built with the register)"); }
else console.log("already in place: package.json");

// Rebuild the reporting data from the CSVs, so edits to them are picked up.
const run = spawnSync(process.execPath, [path.join("scripts", "build-oversight.mjs")], { stdio: "inherit" });
if (run.status !== 0) {
  console.error("\nThe reporting data did not build from the CSV files (the copy shipped with this kit is in use). Fix the problem shown above, then run: npm run oversight:build");
  process.exit(3);
}
