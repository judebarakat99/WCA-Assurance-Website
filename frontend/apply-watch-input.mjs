// Venue Compliance Hub: requirement values in the library, adding a requirement change, a shorter impact view.
// Run from the frontend folder:  node apply-watch-input.mjs
//
// Needs the register kit, the intake agent kit, the evidence and reports kit and the requirement watch kit installed
// first. It
//   - gives every requirement in the library a value (the criterion column) and keeps "Threshold to be confirmed
//     (2034 clause)" under it as a disclaimer; the values are merged into data/register/requirements.csv,
//   - removes the register header and summary tiles from the Requirements page (the stadium tables stay),
//   - adds "Add a requirement change" to the Requirement watch: type or paste text, or drop a document, and the agent
//     finds the requirements in it (changes to existing requirements, and new requirements),
//   - shortens the impact view that opens under "View impact".
// Safe to run again. If a file does not match what this script expects, it says which one and writes nothing at all.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const front = process.cwd();
const src = path.join(front, "src");
const repoData = path.resolve(front, "..", "data");

if (!fs.existsSync(src)) { console.error("Run this from the frontend folder (src/ not found)."); process.exit(1); }
for (const need of ["lib/watch/impact.mjs", "components/organisms/RequirementTabs.jsx", "lib/register/csv.mjs", "lib/store/alerts.js", "components/organisms/FifaLibrary.jsx"]) {
  if (!fs.existsSync(path.join(src, need))) {
    console.error(`src/${need} is missing. Apply the register, intake agent, evidence and reports, and requirement watch kits first.`);
    process.exit(1);
  }
}
const csvFile = path.join(repoData, "register", "requirements.csv");
if (!fs.existsSync(csvFile)) { console.error("data/register/requirements.csv was not found (expected ../data/register)."); process.exit(1); }

const readText = (p) => {
  let raw = fs.readFileSync(p, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  return { text: raw.replace(/\r\n/g, "\n"), crlf: raw.includes("\r\n") };
};
const writeText = (p, text, crlf) => fs.writeFileSync(p, crlf ? text.replace(/\n/g, "\r\n") : text, "utf8");
const count = (a, b) => a.split(b).length - 1;
const exact = (name, applied, from, to, optional = false) => ({
  name, optional, applied,
  apply: (t) => (count(t, from) === 1 ? t.replace(from, () => to) : null),
});

// ---------- the edits to existing files ----------
const REGISTER_IMPORT = /import \{\n  FACILITY_REGISTER,\n  MATCH_LABEL,\n  STATUS_LABEL,\n  cityRecords,\n  registerSource,\n  registerSummary,\n\} from "@\/lib\/domain\/facilities\.mjs";/;
const REGISTER_FUNCS = /function SourceNote\(\) \{[\s\S]*?\n\}\n\nfunction Summary\(\) \{[\s\S]*?\n\}\n\n(?=function CapacityCheck)/;
const REGISTER_P = /\n[ \t]*<p>\n[ \t]*Reviewed \{FACILITY_REGISTER\.reviewedOn\}[^\n]*\n[ \t]*<\/p>/;
const REGISTER_USES = /\n[ \t]*<SourceNote \/>\n[ \t]*<Summary \/>/;

const GENERIC_TEXT = '"threshold to be confirmed against the 2034 contract"';
const GENERIC_NEW = "`${r.criterion.description} (2034 clause to be confirmed)`";

const plans = {
  "components/organisms/FacilityRegister.jsx": [
    {
      name: "remove the register header, source note and summary tiles",
      applied: (t) => !t.includes("function SourceNote") && !t.includes("<Summary />") && !t.includes("registerSummary"),
      apply: (t) => {
        if (!REGISTER_IMPORT.test(t) || !REGISTER_FUNCS.test(t) || !REGISTER_P.test(t) || !REGISTER_USES.test(t)) return null;
        return t
          .replace(REGISTER_IMPORT, () => 'import { MATCH_LABEL, STATUS_LABEL, cityRecords } from "@/lib/domain/facilities.mjs";')
          .replace(REGISTER_FUNCS, () => "")
          .replace(REGISTER_P, () => "")
          .replace(REGISTER_USES, () => "");
      },
    },
  ],
  "lib/store/alerts.js": [
    exact(
      "import",
      (t) => t.includes('from "@/lib/watch/custom"'),
      'import { notify } from "@/lib/store/state";',
      'import { notify } from "@/lib/store/state";\nimport { clearCustom } from "@/lib/watch/custom";',
    ),
    exact(
      "Reset demo clears what was added on the watch",
      (t) => t.includes("clearCustom();"),
      "export function clearAlerts() {\n  list = [];\n  save();\n}",
      "export function clearAlerts() {\n  list = [];\n  save();\n  clearCustom();\n}",
    ),
  ],
  "../scripts/build-register.mjs": [
    exact(
      "reference basis",
      (t) => t.includes("referenceBasis"),
      "note: r.criterion_note, sourceClass: r.source_class,",
      'note: r.criterion_note, referenceBasis: r.reference_basis || "", sourceClass: r.source_class,',
      true,
    ),
  ],
  "lib/domain/fifa-catalogue.mjs": [
    exact(
      "reference basis",
      (t) => t.includes("referenceBasis"),
      "    clause2034: r.clause2034,\n",
      '    clause2034: r.clause2034,\n    referenceBasis: r.referenceBasis || "",\n',
      true,
    ),
  ],
  "lib/reports/text.mjs": [
    exact(
      "reports show the value of a requirement",
      (t) => t.includes('criterion.operator === "manual" && criterion.description'),
      '    default:\n      return "Threshold to be confirmed";',
      '    default:\n      return criterion.operator === "manual" && criterion.description ? criterion.description : "Threshold to be confirmed";',
      true,
    ),
  ],
  "lib/assistant/localChat.js": [
    {
      name: "Nabd gives the value of a requirement",
      optional: true,
      applied: (t) => !t.includes(GENERIC_TEXT),
      apply: (t) => (t.includes(GENERIC_TEXT) ? t.split(GENERIC_TEXT).join(GENERIC_NEW) : null),
    },
  ],
};

const edits = [];
let problems = 0;
for (const [rel, steps] of Object.entries(plans)) {
  const full = path.join(src, rel);
  if (!fs.existsSync(full)) {
    if (steps.every((s) => s.optional)) { console.log(`skipped (file not found): ${rel}`); continue; }
    console.error(`MISSING FILE  src/${rel}`);
    problems++;
    continue;
  }
  const file = readText(full);
  let text = file.text;
  let changed = false;
  for (const step of steps) {
    if (step.applied(text)) { console.log(`already in place: ${rel} [${step.name}]`); continue; }
    const next = step.apply(text);
    if (next == null) {
      if (step.optional) { console.log(`skipped (not found): ${rel} [${step.name}]`); continue; }
      console.error(`NOT APPLIED   src/${rel} [${step.name}]: the text is not what I expected`);
      problems++;
      continue;
    }
    text = next;
    changed = true;
  }
  edits.push({ rel, full, text, crlf: file.crlf, changed });
}

// ---------- the values for requirements.csv ----------
const csv = await import(pathToFileURL(path.join(src, "lib", "register", "csv.mjs")).href);
const values = JSON.parse(fs.readFileSync(path.join(here, "files", "reference-values.json"), "utf8"));
const rows = csv.parseCsv(fs.readFileSync(csvFile, "utf8"));
const header = Object.keys(rows[0] || {});
const hadBasis = header.includes("reference_basis");
const fields = hadBasis ? header : [...header, "reference_basis"];
let setCount = 0;
let kept = 0;
for (const row of rows) {
  const ref = values[row.id];
  if (ref && row.operator === "manual") {
    const edited = row.description && row.description !== row.check_item && row.description !== ref.value;
    if (edited) kept++;
    else if (row.description !== ref.value || row.reference_basis !== ref.basis) {
      row.description = ref.value;
      row.reference_basis = ref.basis;
      setCount++;
    }
  }
  if (row.reference_basis === undefined) row.reference_basis = "";
}
const missing = Object.keys(values).filter((id) => !rows.some((r) => r.id === id));
if (missing.length) { console.error(`requirements.csv has no row for: ${missing.slice(0, 6).join(", ")}${missing.length > 6 ? "…" : ""}`); problems++; }

if (problems) {
  console.error(`\n${problems} problem(s). Nothing was written.`);
  process.exit(2);
}

// ---------- write ----------
function copyTree(fromRoot, toRoot) {
  for (const entry of fs.readdirSync(fromRoot, { withFileTypes: true })) {
    const from = path.join(fromRoot, entry.name);
    const to = path.join(toRoot, entry.name);
    if (entry.isDirectory()) { copyTree(from, to); continue; }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    if (/\.(pdf)$/i.test(entry.name)) fs.copyFileSync(from, to);
    else {
      const body = readText(from);
      writeText(to, body.text, fs.existsSync(to) ? readText(to).crlf : true);
    }
    console.log("wrote   " + path.relative(path.resolve(front, ".."), to).replace(/\\/g, "/"));
  }
}
copyTree(path.join(here, "files", "frontend"), front);
if (fs.existsSync(path.join(here, "demo-documents"))) copyTree(path.join(here, "demo-documents"), path.join(repoData, "watch-demo"));

const cssPath = path.join(src, "styles", "components.css");
const MARK = "/* ---------- Requirement watch: add a change, shorter impact (Venue Compliance Hub) ---------- */";
if (!fs.existsSync(cssPath)) console.error("src/styles/components.css not found; styles not added.");
else {
  const css = readText(cssPath);
  if (css.text.includes(MARK)) console.log("already in place: components.css");
  else {
    writeText(cssPath, css.text.replace(/\n*$/, "\n") + readText(path.join(here, "files", "watch2.css")).text, css.crlf);
    console.log("edited  src/styles/components.css");
  }
}
for (const e of edits) if (e.changed) { writeText(e.full, e.text, e.crlf); console.log("edited  " + path.relative(front, e.full).replace(/\\/g, "/")); }
if (setCount || !hadBasis) {
  fs.writeFileSync(csvFile, csv.toCsv(fields, rows), "utf8");
  console.log(`edited  data/register/requirements.csv (${setCount} requirement value${setCount === 1 ? "" : "s"} set${kept ? `, ${kept} you had edited were left alone` : ""})`);
} else console.log(`already in place: data/register/requirements.csv${kept ? ` (${kept} you had edited were left alone)` : ""}`);

if (fs.existsSync(path.join(front, "scripts", "build-register.mjs"))) {
  const run = spawnSync(process.execPath, [path.join("scripts", "build-register.mjs")], { stdio: "inherit" });
  if (run.status !== 0) {
    console.error("\nThe register did not build. Fix the problem shown above, then run: npm run register:build");
    process.exit(3);
  }
}
