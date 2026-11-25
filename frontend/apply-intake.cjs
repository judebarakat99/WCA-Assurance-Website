// Venue Compliance Hub: the evidence agent for document intake.
// Run from the frontend folder:  node apply-intake.cjs
//
// Any document dropped on the Intake page is read (PDFs included), matched to the requirements in the register,
// checked against their criteria and against what is already on record, and the owner of every gap is alerted.
// Filing a document records it as evidence in the register, so every page shows the change.
//
// Needs the register kit (register-kit.zip) installed first. Safe to run again. If an existing file does not
// match what this script expects, it says which one and writes nothing at all.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const here = __dirname;
const front = process.cwd();
const src = path.join(front, "src");
const repoData = path.resolve(front, "..", "data");

if (!fs.existsSync(src)) { console.error("Run this from the frontend folder (src/ not found)."); process.exit(1); }
if (!fs.existsSync(path.join(src, "lib", "register", "data.mjs"))) {
  console.error("The register kit is not installed yet (src/lib/register/data.mjs is missing). Apply register-kit.zip first.");
  process.exit(1);
}

const readText = (p) => {
  let raw = fs.readFileSync(p, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  return { text: raw.replace(/\r\n/g, "\n"), crlf: raw.includes("\r\n") };
};
const writeText = (p, text, crlf) => fs.writeFileSync(p, crlf ? text.replace(/\n/g, "\r\n") : text, "utf8");
const count = (a, b) => a.split(b).length - 1;
const exact = (name, applied, from, to) => ({
  name,
  applied,
  apply: (t) => (count(t, from) === 1 ? t.replace(from, () => to) : null),
});

const addon = readText(path.join(here, "intake-files", "intakeLocal.addon.js")).text.replace(/\n+$/, "\n");

const plans = {
  "lib/store/intakeLocal.js": [
    exact(
      "imports",
      (t) => t.includes('from "@/lib/intake/evidenceAgent.mjs"'),
      'import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";',
      [
        'import { stadiumApplicability } from "@/lib/domain/assessment.mjs";',
        'import { FACILITY_REGISTER, capacityRequirement } from "@/lib/domain/facilities.mjs";',
        'import { currentRequirement } from "@/lib/domain/requirementVersions.mjs";',
        'import { analyseDocument } from "@/lib/intake/evidenceAgent.mjs";',
        'import { readDocument } from "@/lib/intake/readDocument.mjs";',
        'import { clearAlerts, raiseAlerts, removeAlertsFor, retargetAlerts } from "@/lib/store/alerts";',
        'import { getAssessments, recordEvidence } from "@/lib/store/assessments";',
      ].join("\n"),
    ),
    exact(
      "evidence documents are not replaced by newer ones of another kind",
      (t) => t.includes('d.kind === "evidence"'),
      '    const key = [d.kind, d.stadium_id, d.kind === "detailed-plan" ? d.element : ""].join("|");',
      '    const key = [d.kind, d.stadium_id, d.kind === "detailed-plan" ? d.element : d.kind === "evidence" ? (d.requirement_ids || []).join(",") : ""].join("|");',
    ),
    exact(
      "removing a document withdraws its alerts",
      (t) => t.includes("removeAlertsFor(id);"),
      "export function localRemove(id) {\n  load().documents = db.documents.filter((d) => d.document_id !== id);",
      "export function localRemove(id) {\n  load().documents = db.documents.filter((d) => d.document_id !== id);\n  removeAlertsFor(id);",
    ),
    exact(
      "evidence documents",
      (t) => t.includes("export async function localIngest"),
      "export function localClear() {\n  db = { documents: [], checks: {} };\n  save();\n}",
      addon.replace(/\n$/, ""),
    ),
  ],
  "lib/store/intake.js": [
    exact(
      "imports",
      (t) => t.includes("  localFileAndSync,\n  localIngest,"),
      "  localFile,\n  localRemove,",
      "  localFileAndSync,\n  localIngest,\n  localRemove,",
    ),
    exact(
      "import no longer used",
      (t) => t.includes("localIngest,") && !/\n  localUpload,\n\} from/.test(t),
      '  localUpload,\n} from "@/lib/store/intakeLocal";',
      '} from "@/lib/store/intakeLocal";',
    ),
    exact(
      "any document can be added",
      (t) => t.includes("await localIngest(item.file);"),
      "        localUpload(item.file);",
      "        await localIngest(item.file);",
    ),
    exact(
      "filing records the evidence",
      (t) => t.includes("localFileAndSync(id, filing)"),
      "offline() ? localFile(id, filing) :",
      "offline() ? localFileAndSync(id, filing) :",
    ),
    exact(
      "document type",
      (t) => t.includes('evidence: "Evidence document"'),
      '  "detailed-plan": "Detailed plan",\n  other: "Other",\n};',
      '  "detailed-plan": "Detailed plan",\n  evidence: "Evidence document",\n  other: "Other",\n};',
    ),
  ],
  "components/organisms/IntakeIncoming.jsx": [
    exact(
      "import",
      (t) => t.includes('from "@/components/organisms/EvidenceAnalysis"'),
      'import StatusPill from "@/components/atoms/StatusPill";',
      'import StatusPill from "@/components/atoms/StatusPill";\nimport EvidenceAnalysis from "@/components/organisms/EvidenceAnalysis";',
    ),
    exact(
      "drop zone text",
      (t) => t.includes("Progress reports, detailed plans and evidence documents"),
      "Progress reports and detailed plans · PDF, TXT or Markdown, 10 MB each.",
      "Progress reports, detailed plans and evidence documents · PDF, TXT or Markdown, 10 MB each.",
    ),
    exact(
      "analysis under the proposal",
      (t) => t.includes("<EvidenceAnalysis"),
      '            "The agent could not identify this document with confidence. Check the details before filing."\n          )}\n        </p>',
      '            "The agent could not identify this document with confidence. Check the details before filing."\n          )}\n        </p>\n        {doc.analysis && <EvidenceAnalysis doc={doc} />}',
    ),
  ],
  "components/organisms/IntakeLibrary.jsx": [
    exact(
      "evidence list: variable",
      (t) => t.includes('d.kind === "evidence"'),
      '          const others = docs.filter((d) => d.kind === "other");',
      '          const others = docs.filter((d) => d.kind === "other");\n          const evidence = docs.filter((d) => d.kind === "evidence");',
    ),
    exact(
      "evidence list",
      (t) => t.includes("Evidence for the register"),
      "              {missing.map((p) => (",
      [
        "              {evidence.length > 0 && (",
        "                <>",
        "                  <h4>Evidence for the register</h4>",
        "                  <ul>",
        "                    {evidence.map((d) => (",
        "                      <li key={d.document_id} className={d.superseded ? \"superseded\" : undefined}>",
        '                        <span className="intake-name">{d.name}</span>',
        '                        <span className="muted small">',
        '                          {d.revision ? `rev ${d.revision} · ` : ""}',
        '                          {d.as_of || "no date"}',
        "                          {d.registered?.length",
        "                            ? ` · recorded against ${d.registered.join(\", \")}`",
        "                            : \" · nothing recorded in the register\"}",
        "                        </span>",
        '                        <button type="button" className="linkish small" disabled={!!intake.busy[d.document_id]} onClick={() => removeDocument(d.document_id)}>',
        "                          Remove",
        "                        </button>",
        "                      </li>",
        "                    ))}",
        "                  </ul>",
        "                </>",
        "              )}",
        "              {missing.map((p) => (",
      ].join("\n"),
    ),
  ],
  "components/pages/IntakePage.jsx": [
    exact(
      "import",
      (t) => t.includes('from "@/components/organisms/AlertsPanel"'),
      'import AgentRun from "@/components/organisms/AgentRun";',
      'import AgentRun from "@/components/organisms/AgentRun";\nimport AlertsPanel from "@/components/organisms/AlertsPanel";',
    ),
    exact("alerts panel", (t) => t.includes("<AlertsPanel />"), "          <IntakeLibrary />", "          <IntakeLibrary />\n          <AlertsPanel />"),
    exact(
      "lead",
      (t) => t.includes("the owner of every gap is alerted"),
      "flags claims the evidence does not support. A person files",
      "flags claims the evidence does not support. Evidence documents are checked against the FIFA requirements in the register, and the owner of every gap is alerted. A person files",
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

// The register: one row was marked non-compliant although its own check passed.
const csvPath = path.join(repoData, "register", "compliance.csv");
const OLD_ROW =
  "king-salman-international,STA-0004,Non-compliant,92760,,pass,STA-0004_king-salman-international_match-category-capacity-allocation.pdf,2026-11-05,Compliance reviewer,Programme and planning lead,Master plan revision pending client approval.,2026-11-05";
const NEW_ROW =
  "king-salman-international,STA-0004,Compliant,92760,,pass,STA-0004_king-salman-international_match-category-capacity-allocation.pdf,2026-11-05,Compliance reviewer,Programme and planning lead,,2026-11-05";
let csvEdit = null;
if (!fs.existsSync(csvPath)) { console.error("MISSING FILE  data/register/compliance.csv (apply the register kit first)"); problems++; }
else {
  const raw = fs.readFileSync(csvPath, "utf8");
  if (raw.includes(OLD_ROW)) csvEdit = raw.replace(OLD_ROW, NEW_ROW);
  else console.log("data/register/compliance.csv: nothing to correct (already correct, or edited since the register kit)");
}

if (problems) {
  console.error(`\n${problems} problem(s). Nothing was written.`);
  process.exit(2);
}

// ---------- write ----------
function copyTree(fromRoot, toRoot, skip = () => false) {
  for (const entry of fs.readdirSync(fromRoot, { withFileTypes: true })) {
    const from = path.join(fromRoot, entry.name);
    const to = path.join(toRoot, entry.name);
    if (skip(entry.name, from)) continue;
    if (entry.isDirectory()) { copyTree(from, to, skip); continue; }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    if (/\.(pdf|csv)$/i.test(entry.name)) fs.copyFileSync(from, to);
    else {
      const body = readText(from);
      writeText(to, body.text, fs.existsSync(to) ? readText(to).crlf : true);
    }
    console.log("wrote   " + path.relative(path.resolve(front, ".."), to).replace(/\\/g, "/"));
  }
}
copyTree(path.join(here, "intake-files", "frontend"), front);
copyTree(path.join(here, "demo-documents"), path.join(repoData, "intake-demo"));

const cssPath = path.join(src, "styles", "components.css");
const MARK = "/* ---------- Evidence agent and alerts (Venue Compliance Hub) ---------- */";
if (!fs.existsSync(cssPath)) console.error("src/styles/components.css not found; styles not added.");
else {
  const css = readText(cssPath);
  if (css.text.includes(MARK)) console.log("already in place: components.css");
  else {
    writeText(cssPath, css.text.replace(/\n*$/, "\n") + readText(path.join(here, "intake-files", "intake.css")).text, css.crlf);
    console.log("edited  src/styles/components.css");
  }
}
for (const e of edits) if (e.changed) { writeText(e.full, e.text, e.crlf); console.log("edited  src/" + e.rel); }
if (csvEdit) { fs.writeFileSync(csvPath, csvEdit, "utf8"); console.log("edited  data/register/compliance.csv (1 row: King Salman STA-0004 is Compliant, as its own check says)"); }

if (fs.existsSync(path.join(front, "scripts", "build-register.mjs"))) {
  const run = spawnSync(process.execPath, [path.join("scripts", "build-register.mjs")], { stdio: "inherit" });
  if (run.status !== 0) {
    console.error("\nThe register did not build. Fix the problem shown above, then run: npm run register:build");
    process.exit(3);
  }
}
