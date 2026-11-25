// Venue Compliance Hub: requirement register grouped by the chapters of the FIFA stadium book.
// Run from the frontend folder:  node apply-register.cjs
//
// It adds the register (CSV files in ../data/register), the build step that turns them into
// src/lib/register/register.generated.json, and the domain modules, components and assistant that read them.
// Every page then reads the same records, so the counts agree wherever they appear.
//
// Safe to run again. If an existing file does not match what this script expects, it says which one and
// writes nothing at all.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const here = __dirname;
const front = process.cwd();
const src = path.join(front, "src");
const repoData = path.resolve(front, "..", "data");
if (!fs.existsSync(src)) { console.error("Run this from the frontend folder (src/ not found)."); process.exit(1); }
if (!fs.existsSync(repoData)) { console.error("The data folder was not found next to frontend/ (expected ../data)."); process.exit(1); }

const readText = (p) => {
  let raw = fs.readFileSync(p, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  return { text: raw.replace(/\r\n/g, "\n"), crlf: raw.includes("\r\n") };
};
const writeText = (p, text, crlf) => fs.writeFileSync(p, crlf ? text.replace(/\n/g, "\r\n") : text, "utf8");
const count = (a, b) => a.split(b).length - 1;

// ---------- 1. edits to existing files, worked out before anything is written ----------
const exact = (name, applied, from, to) => ({
  name,
  applied: (t) => applied(t),
  apply: (t) => (count(t, from) === 1 ? t.replace(from, () => to) : null),
});
const regex = (name, applied, re, to) => ({
  name,
  applied: (t) => applied(t),
  apply: (t) => (re.test(t) ? t.replace(re, () => to) : null),
});

const PARTIAL_PILL_FROM = `                    {inScope ? <StatusPill tone={STATUS_TONE[status]}>{STATUS[status]}</StatusPill> : "–"}`;
const PARTIAL_PILL_TO = `                    {inScope ? (
                      <StatusPill tone={record?.partial ? "warn" : STATUS_TONE[status]}>
                        {record?.partial ? "Partially compliant" : STATUS[status]}
                      </StatusPill>
                    ) : (
                      "–"
                    )}`;
const PARTIAL_BTN_FROM = `          <button type="button" className="danger" onClick={() => reviewAssessment(facilityId, requirement, "non-compliant")}>
            Mark non-compliant
          </button>`;
const PARTIAL_BTN_TO = `${PARTIAL_BTN_FROM}
          <button type="button" onClick={() => reviewAssessment(facilityId, requirement, "partially-compliant")}>
            Mark partially compliant
          </button>`;

const REVIEW_FROM = `export function reviewAssessment(facilityId, requirement, outcome, note = "") {
  return upsert(facilityId, requirement, (a) => ({
    ...a,
    status: outcome,
    review: { outcome, by: REVIEWER, on: today(), note },
    history: [...a.history, { on: today(), action: \`\${REVIEWER}: \${outcome === "compliant" ? "compliant" : "non-compliant"}\` }],
  }));
}`;
const REVIEW_TO = `export function reviewAssessment(facilityId, requirement, outcome, note = "") {
  // "partially-compliant" is stored as non-compliant with partial: true, so every count of fulfilled
  // and not fulfilled requirements adds up the same way on every page.
  const partial = outcome === "partially-compliant";
  const result = partial ? "non-compliant" : outcome;
  return upsert(facilityId, requirement, (a) => ({
    ...a,
    status: result,
    partial,
    review: { outcome: result, by: REVIEWER, on: today(), note },
    history: [
      ...a.history,
      { on: today(), action: \`\${REVIEWER}: \${partial ? "partially compliant" : result === "compliant" ? "compliant" : "non-compliant"}\` },
    ],
  }));
}`;
const EVIDENCE_FROM = `      status: "evidence-submitted",
      review: null,
      evidence: [...a.evidence,`;
const EVIDENCE_TO = `      status: "evidence-submitted",
      partial: false,
      review: null,
      evidence: [...a.evidence,`;

const plans = {
  "components/pages/FacilityPage.jsx": [
    exact(
      "import",
      (t) => t.includes('from "@/components/organisms/FamilyAssessments"'),
      'import AssessmentTable from "@/components/organisms/AssessmentTable";',
      'import FamilyAssessments from "@/components/organisms/FamilyAssessments";',
    ),
    regex("category list", (t) => !t.includes("CATEGORY_ORDER"), /^const CATEGORY_ORDER = .*\n\n?/m, ""),
    regex("category filter", (t) => !t.includes("const categories ="), /^  const categories = .*\n/m, ""),
    regex(
      "family sections",
      (t) => t.includes("<FamilyAssessments"),
      /\{categories\.map\(\(c\) => \(\n\s*<AssessmentTable[\s\S]*?\/>\n\s*\)\)\}/,
      "<FamilyAssessments stadium={stadium} rows={visible} records={records} />",
    ),
    exact(
      "summary: not assessed tile",
      (t) => t.includes('[s.byStatus.unassessed, "not assessed", ""]'),
      '[s.byStatus.declared, "declared only", ""],',
      '[s.byStatus.unassessed, "not assessed", ""],',
    ),
    exact(
      "summary: fulfilled",
      (t) => t.includes('"fulfilled", "good"'),
      '[s.byStatus.compliant, "compliant", "good"],',
      '[s.byStatus.compliant, "fulfilled", "good"],',
    ),
    exact(
      "summary: not fulfilled",
      (t) => t.includes("not fulfilled (${s.partial} partial)"),
      '[s.byStatus["non-compliant"], "non-compliant", s.byStatus["non-compliant"] ? "bad" : ""],',
      '[\n      s.byStatus["non-compliant"],\n      s.partial ? `not fulfilled (${s.partial} partial)` : "not fulfilled",\n      s.byStatus["non-compliant"] ? "bad" : "",\n    ],',
    ),
    exact(
      "provisional legend",
      (t) => t.includes("2034 clause still to be confirmed"),
      "= 2020 lighting baseline, pending the tournament package",
      "= 2034 clause still to be confirmed",
    ),
  ],
  "components/organisms/AssessmentTable.jsx": [
    exact("partial status pill", (t) => t.includes('"Partially compliant"'), PARTIAL_PILL_FROM, PARTIAL_PILL_TO),
    exact("partial review button", (t) => t.includes('"partially-compliant"'), PARTIAL_BTN_FROM, PARTIAL_BTN_TO),
  ],
  "lib/store/assessments.js": [
    regex("storage version", (t) => t.includes('"wca-assessments-v3"'), /const KEY = "wca-assessments-v\d+";/, 'const KEY = "wca-assessments-v3";'),
    exact("partial review", (t) => t.includes('const partial = outcome === "partially-compliant"'), REVIEW_FROM, REVIEW_TO),
    exact("evidence clears partial", (t) => t.includes("      partial: false,\n      review: null,"), EVIDENCE_FROM, EVIDENCE_TO),
  ],
  "components/pages/ReviewQueuePage.jsx": [
    exact(
      "reason tone",
      (t) => t.includes('"partially-compliant": "warn"'),
      'const REASON_TONE = { fail: "bad", "needs-review": "warn", pass: "good", "non-compliant": "bad" };',
      'const REASON_TONE = { fail: "bad", "needs-review": "warn", pass: "good", "non-compliant": "bad", "partially-compliant": "warn" };',
    ),
    exact(
      "queue tile",
      (t) => t.includes('"not fulfilled, awaiting new evidence"'),
      '"non-compliant, awaiting new evidence"',
      '"not fulfilled, awaiting new evidence"',
    ),
  ],
};

const edits = [];
let problems = 0;
for (const [rel, steps] of Object.entries(plans)) {
  const full = path.join(src, rel);
  if (!fs.existsSync(full)) { console.error(`MISSING FILE  src/${rel}`); problems++; continue; }
  const file = readText(full);
  let text = file.text;
  let changed = false;
  for (const step of steps) {
    if (step.applied(text)) { console.log(`already in place: ${rel} [${step.name}]`); continue; }
    const next = step.apply(text);
    if (next == null) { console.error(`NOT APPLIED   src/${rel} [${step.name}]: the text is not what I expected`); problems++; continue; }
    text = next;
    changed = true;
  }
  edits.push({ rel, full, text, crlf: file.crlf, changed });
}

// package.json: build the register before dev and build
const pkgPath = path.join(front, "package.json");
let pkgText = null;
if (!fs.existsSync(pkgPath)) { console.error("MISSING FILE  package.json"); problems++; }
else {
  const raw = fs.readFileSync(pkgPath, "utf8");
  const pkg = JSON.parse(raw.replace(/^\uFEFF/, ""));
  pkg.scripts = pkg.scripts || {};
  const want = { "register:build": "node scripts/build-register.mjs", predev: "node scripts/build-register.mjs", prebuild: "node scripts/build-register.mjs" };
  let changed = false;
  for (const [k, v] of Object.entries(want)) if (pkg.scripts[k] !== v) { pkg.scripts[k] = v; changed = true; }
  if (changed) {
    pkgText = JSON.stringify(pkg, null, 2) + "\n";
    if (raw.includes("\r\n")) pkgText = pkgText.replace(/\n/g, "\r\n");
  } else console.log("already in place: package.json scripts");
}

if (problems) {
  console.error(`\n${problems} problem(s). Nothing was written.`);
  process.exit(2);
}

// ---------- 2. new and replaced files ----------
function copyTree(fromRoot, toRoot) {
  for (const name of fs.readdirSync(fromRoot, { withFileTypes: true })) {
    const from = path.join(fromRoot, name.name);
    const to = path.join(toRoot, name.name);
    if (name.isDirectory()) { copyTree(from, to); continue; }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    const text = /\.(csv)$/i.test(name.name);
    if (text) fs.copyFileSync(from, to); // CSV keeps its BOM and CRLF as shipped
    else {
      const body = readText(from);
      writeText(to, body.text, fs.existsSync(to) ? readText(to).crlf : true);
    }
    console.log("wrote   " + path.relative(path.resolve(front, ".."), to).replace(/\\/g, "/"));
  }
}
copyTree(path.join(here, "files", "data"), repoData);
copyTree(path.join(here, "files", "frontend"), front);

// ---------- 3. styles ----------
const cssPath = path.join(src, "styles", "components.css");
const MARK = "/* ---------- Requirement families (Venue Compliance Hub) ---------- */";
if (!fs.existsSync(cssPath)) { console.error("src/styles/components.css not found; styles not added."); }
else {
  const css = readText(cssPath);
  if (css.text.includes(MARK)) console.log("already in place: components.css");
  else {
    const add = readText(path.join(here, "files", "register.css")).text;
    writeText(cssPath, css.text.replace(/\n*$/, "\n") + add, css.crlf);
    console.log("edited  src/styles/components.css");
  }
}

// ---------- 4. edits ----------
for (const e of edits) {
  if (e.changed) { writeText(e.full, e.text, e.crlf); console.log("edited  src/" + e.rel); }
}
if (pkgText) { fs.writeFileSync(pkgPath, pkgText, "utf8"); console.log("edited  package.json"); }

// ---------- 5. build the register ----------
const run = spawnSync(process.execPath, [path.join("scripts", "build-register.mjs")], { stdio: "inherit" });
if (run.status !== 0) {
  console.error("\nThe register did not build. Fix the CSV problem shown above, then run: npm run register:build");
  process.exit(3);
}
