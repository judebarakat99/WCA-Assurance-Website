// Venue Compliance Hub: the Evidence page (replaces Intake) and the Reports page.
// Run from the frontend folder:  node apply-evidence-reports.cjs
//
// Needs the register kit and the intake agent kit installed first. It
//   - adds /evidence (the reworked Intake: drop, confirm, on file, alerts, progress checks) and /reports,
//   - turns /intake into a redirect to /evidence,
//   - changes the tab bar (Intake becomes Evidence, Reports is added) and the link on the stadium page,
//   - starts the Evidence page empty (the bundled sample documents are no longer filed automatically),
//   - makes alerts go out when a document is confirmed, not when it is dropped.
// Safe to run again. If an existing file does not match what this script expects, it says which one and writes
// nothing at all.
const fs = require("fs");
const path = require("path");

const here = __dirname;
const front = process.cwd();
const src = path.join(front, "src");

if (!fs.existsSync(src)) { console.error("Run this from the frontend folder (src/ not found)."); process.exit(1); }
for (const need of ["lib/register/data.mjs", "lib/intake/evidenceAgent.mjs", "lib/store/alerts.js"]) {
  if (!fs.existsSync(path.join(src, need))) {
    console.error(`src/${need} is missing. Apply register-kit.zip and then intake-agent-kit.zip first.`);
    process.exit(1);
  }
}

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

const BLOCK_MARK = "// ---------------------------------------------------------------- evidence documents";
const block = readText(path.join(here, "files", "intakeLocal.block.js")).text.replace(/\n+$/, "\n");

const RESTORE_OLD = `/**
 * Start the demo populated: when the backend is not answering, file and check
 * the bundled documents. With the backend online nothing is filed
 * automatically, so no model calls are spent.
 */
export async function restoreDemoIntake() {
  if (!intake.loaded) await refreshIntake();
  if (intake.loaded && intake.mode === "offline" && !intake.documents.length && !intake.seeding) await seedIntake();
}`;
const RESTORE_NEW = `/**
 * Load intake for the page. The Evidence page starts empty: nothing is filed
 * automatically, so what a document does is clear from the moment it is dropped.
 */
export async function restoreDemoIntake() {
  if (!intake.loaded) await refreshIntake();
}`;

const plans = {
  "components/organisms/Header.jsx": [
    exact(
      "tab bar",
      (t) => t.includes('label: "Reports"'),
      '  { href: "/intake", label: "Intake" },\n',
      '  { href: "/evidence", label: "Evidence" },\n  { href: "/reports", label: "Reports" },\n',
    ),
  ],
  "components/organisms/ProgressClaim.jsx": [
    exact(
      "link to the check",
      (t) => t.includes("/evidence?tab=checks&stadium="),
      "href={`/intake?stadium=${encodeURIComponent(stadiumId)}`}",
      "href={`/evidence?tab=checks&stadium=${encodeURIComponent(stadiumId)}`}",
    ),
  ],
  "lib/store/intake.js": [
    exact("starts empty", (t) => t.includes("The Evidence page starts empty"), RESTORE_OLD, RESTORE_NEW),
  ],
  "lib/store/intakeLocal.js": [
    exact(
      "import",
      (t) => !t.includes("retargetAlerts"),
      'import { clearAlerts, raiseAlerts, removeAlertsFor, retargetAlerts } from "@/lib/store/alerts";',
      'import { clearAlerts, raiseAlerts, removeAlertsFor } from "@/lib/store/alerts";',
    ),
    {
      name: "evidence documents: alerts at confirmation, re-reading for another stadium",
      applied: (t) => t.includes("export function localReanalyse"),
      apply: (t) => {
        const i = t.indexOf(BLOCK_MARK);
        if (i < 0 || t.indexOf(BLOCK_MARK, i + 1) >= 0) return null;
        if (!t.slice(i).includes("export function localFileAndSync")) return null;
        return t.slice(0, i) + block;
      },
    },
  ],
  "lib/intake/evidenceAgent.mjs": [
    exact(
      "signature",
      (t) => t.includes("now = new Date(), options = {}) {"),
      "export function analyseDocument(doc, records, now = new Date()) {",
      "export function analyseDocument(doc, records, now = new Date(), options = {}) {",
    ),
    exact(
      "stadium chosen by the person",
      (t) => t.includes("options.stadiumId || textTop"),
      "  const stadiumId = textTop?.[0] || nameTop?.[0] || null;",
      "  const stadiumId = options.stadiumId || textTop?.[0] || nameTop?.[0] || null;",
    ),
    exact(
      "mismatch with the text",
      (t) => t.includes("You assigned this document to"),
      "  if (textTop && nameTop && textTop[0] !== nameTop[0]) {",
      [
        "  if (options.stadiumId && textTop && textTop[0] !== options.stadiumId) {",
        "    const chosen = FACILITY_REGISTER.stadiums.find((s) => s.id === options.stadiumId)?.name;",
        "    const named = FACILITY_REGISTER.stadiums.find((s) => s.id === textTop[0])?.name;",
        '    inconsistencies.push({ severity: "medium", kind: "stadium", text: `You assigned this document to ${chosen}, but its text is about ${named}.` });',
        "  } else if (!options.stadiumId && textTop && nameTop && textTop[0] !== nameTop[0]) {",
      ].join("\n"),
    ),
    exact(
      "step wording: names",
      (t) => t.includes("textTop && textTop[0] === stadium.id ?"),
      "${stadium.name}${textTop ? ",
      "${stadium.name}${textTop && textTop[0] === stadium.id ? ",
    ),
    exact(
      "step wording: chosen",
      (t) => t.includes('options.stadiumId ? " (chosen by you)"'),
      ': " (from the file name)"}.',
      ': options.stadiumId ? " (chosen by you)" : " (from the file name)"}.',
    ),
  ],
  "lib/assistant/localChat.js": [
    exact(
      "page name",
      (t) => !t.includes("on the Intake page"),
      "or file a document on the Intake page.",
      "or file a document on the Evidence page.",
      true,
    ),
  ],
};

// ---------- work out every edit before writing anything ----------
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
if (problems) {
  console.error(`\n${problems} problem(s). Nothing was written.`);
  process.exit(2);
}

// ---------- new files ----------
function copyTree(fromRoot, toRoot, skip = () => false) {
  for (const entry of fs.readdirSync(fromRoot, { withFileTypes: true })) {
    const from = path.join(fromRoot, entry.name);
    const to = path.join(toRoot, entry.name);
    if (skip(from)) continue;
    if (entry.isDirectory()) { copyTree(from, to, skip); continue; }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    const body = readText(from);
    writeText(to, body.text, fs.existsSync(to) ? readText(to).crlf : true);
    console.log("wrote   " + path.relative(front, to).replace(/\\/g, "/"));
  }
}
copyTree(path.join(here, "files", "frontend"), front);

// ---------- styles ----------
const cssPath = path.join(src, "styles", "components.css");
const MARK = "/* ---------- Evidence and Reports (Venue Compliance Hub) ---------- */";
if (!fs.existsSync(cssPath)) console.error("src/styles/components.css not found; styles not added.");
else {
  const css = readText(cssPath);
  if (css.text.includes(MARK)) console.log("already in place: components.css");
  else {
    writeText(cssPath, css.text.replace(/\n*$/, "\n") + readText(path.join(here, "files", "evidence-reports.css")).text, css.crlf);
    console.log("edited  src/styles/components.css");
  }
}

// ---------- edits ----------
for (const e of edits) if (e.changed) { writeText(e.full, e.text, e.crlf); console.log("edited  src/" + e.rel); }

// ---------- packages ----------
const missing = ["docx", "pdf-lib", "jszip"].filter((p) => !fs.existsSync(path.join(front, "node_modules", p)));
if (missing.length) {
  console.log(`\nThe report files need three packages that are not installed yet. Run:\n\n  npm install docx pdf-lib jszip\n`);
}
