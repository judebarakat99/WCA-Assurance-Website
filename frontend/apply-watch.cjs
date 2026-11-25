// Venue Compliance Hub: use case 2, the requirement watch (impact assessment agent), on the Requirements page.
// Run from the frontend folder:  node apply-watch.cjs
//
// Needs the register kit, the intake agent kit and the evidence and reports kit installed first. It
//   - adds a "Requirement watch" tab to the Requirements page next to the existing library,
//   - adds seven proposed requirement changes (the file data/register/change-scenarios.json),
//   - lets the alerts store raise alerts from requirement changes and shows them on the Evidence page's Alerts tab,
//   - lets Nabd answer "What requirement changes are proposed?".
// Safe to run again. If an existing file does not match what this script expects, it says which one and writes
// nothing at all.
const fs = require("fs");
const path = require("path");

const here = __dirname;
const front = process.cwd();
const src = path.join(front, "src");
const repoData = path.resolve(front, "..", "data");

if (!fs.existsSync(src)) { console.error("Run this from the frontend folder (src/ not found)."); process.exit(1); }
for (const need of ["lib/register/data.mjs", "lib/store/alerts.js", "lib/reports/text.mjs", "components/organisms/AlertsPanel.jsx"]) {
  if (!fs.existsSync(path.join(src, need))) {
    console.error(`src/${need} is missing. Apply the register, intake agent and evidence and reports kits first.`);
    process.exit(1);
  }
}
if (!fs.existsSync(path.join(repoData, "register"))) { console.error("The data folder was not found next to frontend/ (expected ../data/register)."); process.exit(1); }

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

// ---------- Nabd: all three edits or none ----------
const CHAT_IMPORT_ANCHOR = 'import { getAssessments } from "@/lib/store/assessments";';
const CHAT_IMPORT = 'import { assessChange } from "@/lib/watch/impact.mjs";';
const CHAT_ROUTE_ANCHOR = "  const scenario = scenarioFor(raw);";
const CHAT_ROUTE = `  if (/requirement watch/.test(q) || /\\b(proposed|pending|incoming|upcoming|detected)\\b.*\\b(changes?|amendments?)\\b/.test(q) || /\\b(changes?|amendments?)\\b.*\\b(proposed|pending|incoming|upcoming|detected)\\b/.test(q))
    return watchAnswer(records);
${CHAT_ROUTE_ANCHOR}`;
const CHAT_FN_ANCHOR = "function fallback() {";
const CHAT_FN = `// ---------- proposed requirement changes ----------
function watchAnswer(records) {
  const applied = new Set(appliedChanges().map((c) => c.changeId));
  const rows = CHANGE_SCENARIOS.filter((s) => !applied.has(s.id)).map((s) => assessChange(s, records)).filter(Boolean);
  if (!rows.length) return { reply: "There are no proposed requirement changes waiting for a decision.", sources: [] };
  rows.sort((a, b) => b.counts.reopened - a.counts.reopened);
  const lines = [
    \`\${plural(rows.length, "requirement change")} \${rows.length === 1 ? "is" : "are"} proposed and not yet applied:\`,
    "",
    bullets(rows.map((a) => \`\${a.scenario.title} (\${a.before.id}: \${a.oldCrit} to \${a.crit}): \${a.counts.reopened} compliant would reopen, \${a.counts.failsInReview} would fail in review, \${plural(a.owners.length, "owner")} to act\`)),
    "",
    "Open the Requirement watch tab on the Requirements page to see the impact of each and to notify the owners.",
  ];
  const top = rows[0];
  return {
    reply: lines.join("\\n"),
    sources: [
      programmeSource("W1", "summary", "Requirement watch", [
        ["Proposed changes", rows.length],
        ["Would reopen (all)", rows.reduce((t, a) => t + a.counts.reopened, 0)],
        ["Largest impact", \`\${top.scenario.title}: \${top.counts.reopened} reopen\`],
      ]),
    ],
  };
}

${CHAT_FN_ANCHOR}`;

const plans = {
  "components/pages/CompliancePage.jsx": [
    exact(
      "import",
      (t) => t.includes('from "@/components/organisms/RequirementTabs"'),
      'import PageTemplate from "@/components/templates/PageTemplate";',
      'import RequirementTabs from "@/components/organisms/RequirementTabs";\nimport PageTemplate from "@/components/templates/PageTemplate";',
    ),
    exact("tabs", (t) => t.includes("<RequirementTabs"), "{reference}", "<RequirementTabs reference={reference} />"),
  ],
  "lib/store/alerts.js": [
    exact(
      "requirement-change label",
      (t) => t.includes('"requirement-change"'),
      "export const KIND_LABEL = {",
      'export const KIND_LABEL = {\n  "requirement-change": "Requirement change",',
    ),
    exact(
      "alert source type",
      (t) => t.includes("source.type || "),
      'source: { type: "document", id: source.id, name: source.name }',
      'source: { type: source.type || "document", id: source.id, name: source.name }',
    ),
  ],
  "lib/assistant/localChat.js": [
    {
      name: "proposed requirement changes",
      optional: true,
      applied: (t) => t.includes("function watchAnswer"),
      apply: (t) => {
        if (count(t, CHAT_IMPORT_ANCHOR) !== 1 || count(t, CHAT_ROUTE_ANCHOR) !== 1 || count(t, CHAT_FN_ANCHOR) !== 1) return null;
        if (!/\bappliedChanges\b/.test(t) || !/\bCHANGE_SCENARIOS\b/.test(t) || !/\bprogrammeSource\b/.test(t)) return null;
        return t
          .replace(CHAT_IMPORT_ANCHOR, () => `${CHAT_IMPORT_ANCHOR}\n${CHAT_IMPORT}`)
          .replace(CHAT_ROUTE_ANCHOR, () => CHAT_ROUTE)
          .replace(CHAT_FN_ANCHOR, () => CHAT_FN);
      },
    },
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
function copyTree(fromRoot, toRoot) {
  for (const entry of fs.readdirSync(fromRoot, { withFileTypes: true })) {
    const from = path.join(fromRoot, entry.name);
    const to = path.join(toRoot, entry.name);
    if (entry.isDirectory()) { copyTree(from, to); continue; }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    const body = readText(from);
    writeText(to, body.text, fs.existsSync(to) ? readText(to).crlf : true);
    console.log("wrote   " + path.relative(path.resolve(front, ".."), to).replace(/\\/g, "/"));
  }
}
copyTree(path.join(here, "files", "frontend"), front);
copyTree(path.join(here, "files", "data"), repoData);

// ---------- styles ----------
const cssPath = path.join(src, "styles", "components.css");
const MARK = "/* ---------- Requirement watch (Venue Compliance Hub) ---------- */";
if (!fs.existsSync(cssPath)) console.error("src/styles/components.css not found; styles not added.");
else {
  const css = readText(cssPath);
  if (css.text.includes(MARK)) console.log("already in place: components.css");
  else {
    writeText(cssPath, css.text.replace(/\n*$/, "\n") + readText(path.join(here, "files", "watch.css")).text, css.crlf);
    console.log("edited  src/styles/components.css");
  }
}

// ---------- edits ----------
for (const e of edits) if (e.changed) { writeText(e.full, e.text, e.crlf); console.log("edited  src/" + e.rel); }
