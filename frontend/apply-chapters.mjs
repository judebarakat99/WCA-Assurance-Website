// Venue Compliance Hub: remove chapter 11 (Futsal and beach soccer) and make chapter 12 (Temporary facilities) chapter 11.
// Run from the frontend folder:  node apply-chapters.mjs
//
// It changes the register's CSV files (families, sections and requirements), the three places in the code that name
// chapter 12 (the mitigation exposure weights, the extraction agent's chapter words and Nabd's chapter words), and
// the browser's saved watch data, so every page, report, alert and answer uses the new numbering. It also closes the
// Riyadh table in the Facility register, so every city starts closed.
// Safe to run again. If a file does not match what this script expects, it says which one and writes nothing at all.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const front = process.cwd();
const src = path.join(front, "src");
const dataDir = path.resolve(front, "..", "data", "register");
const REMOVE_NAME = "Futsal and beach soccer";

if (!fs.existsSync(src)) { console.error("Run this from the frontend folder (src/ not found)."); process.exit(1); }
for (const f of ["families.csv", "sections.csv", "requirements.csv"]) {
  if (!fs.existsSync(path.join(dataDir, f))) { console.error(`data/register/${f} was not found (expected ../data/register).`); process.exit(1); }
}
const csvModule = path.join(src, "lib", "register", "csv.mjs");
if (!fs.existsSync(csvModule)) { console.error("src/lib/register/csv.mjs is missing. Apply the register kit first."); process.exit(1); }

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
const regex = (name, applied, re, to, optional = false) => ({
  name, optional, applied,
  apply: (t) => (re.test(t) ? t.replace(re, to) : null),
});

// ---------- the code edits, worked out before anything is written ----------
const MOVE_CHAPTER =
  '    return {\n' +
  '      scenarios: (Array.isArray(data?.scenarios) ? data.scenarios : []).map((s) => (s.newRequirement?.familyId === "12" ? { ...s, newRequirement: { ...s.newRequirement, familyId: "11" } } : s)),\n' +
  '      requirements: (Array.isArray(data?.requirements) ? data.requirements : []).map((r) => (r.familyId === "12" ? { ...r, familyId: "11" } : r)),\n' +
  "    };";

const plans = {
  "lib/domain/exposure.mjs": [
    exact("exposure weight of the temporary facilities chapter", (t) => !t.includes('"12": 1'), '"10": 2, "12": 1 };', '"10": 2, "11": 1 };'),
  ],
  "lib/watch/extract.mjs": [
    exact("chapter words of the extraction agent", (t) => !/^\s*"12": \//m.test(t), '  "12": /\\b(temporary|overlay', '  "11": /\\b(temporary|overlay'),
  ],
  "lib/assistant/localChat.js": [
    regex("chapter words of Nabd", (t) => !/^\s*"12": \/\\b\(temporary/m.test(t), /^(\s*)"12": (\/\\b\(temporary\|overlay)/m, '$1"11": $2', true),
  ],
  "lib/domain/requirementVersions.mjs": [
    exact(
      "requirements added on the watch before this change move to the new chapter number",
      (t) => t.includes('familyId === "12"'),
      "    return { scenarios: Array.isArray(data?.scenarios) ? data.scenarios : [], requirements: Array.isArray(data?.requirements) ? data.requirements : [] };",
      MOVE_CHAPTER,
    ),
  ],
  "components/organisms/FacilityRegister.jsx": [
    // whichever city the file opens by itself, none should
    {
      name: "every city starts closed",
      optional: false,
      applied: (t) => !/<details className="comp-detail" open=\{[^}]*\}>/.test(t),
      apply: (t) => (count(t, '<details className="comp-detail" open={') === 1 ? t.replace(/<details className="comp-detail" open=\{[^}]*\}>/, () => '<details className="comp-detail">') : null),
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

// ---------- the register's CSV files ----------
const csv = await import(pathToFileURL(csvModule).href);
const load = (name) => {
  const rows = csv.parseCsv(fs.readFileSync(path.join(dataDir, name), "utf8"));
  return { rows, fields: Object.keys(rows[0] || {}) };
};
const families = load("families.csv");
const sections = load("sections.csv");
const requirements = load("requirements.csv");

const pad = (n) => String(n).padStart(2, "0");
const target = families.rows.find((f) => f.name === REMOVE_NAME);
let csvChanged = false;
let summary = "";
if (!target) {
  console.log(`already in place: data/register (no "${REMOVE_NAME}" chapter)`);
} else {
  const removed = target.id;
  const removedNumber = Number(removed);
  const used = requirements.rows.filter((r) => r.family_id === removed);
  if (used.length) {
    console.error(`Chapter ${removed} "${REMOVE_NAME}" still has ${used.length} requirement(s), for example ${used[0].id}. Move or delete them first.`);
    problems++;
  }
  const dropped = sections.rows.filter((s) => s.family_id === removed);
  const refs = requirements.rows.filter((r) => dropped.some((s) => s.id === r.section));
  if (refs.length) {
    console.error(`${refs.length} requirement(s) point to a section of chapter ${removed}, for example ${refs[0].id} (${refs[0].section}).`);
    problems++;
  }
  if (!problems) {
    // the chapter's number after the change: every chapter above it moves down by one
    const newId = (id) => (Number(id) > removedNumber ? pad(Number(id) - 1) : id);
    const newSection = (sid) => {
      const m = /^(\d+)\.(.+)$/.exec(sid);
      return m && Number(m[1]) > removedNumber ? `${Number(m[1]) - 1}.${m[2]}` : sid;
    };
    const keptFamilies = families.rows.filter((f) => f.id !== removed).map((f) => ({ ...f, id: newId(f.id) }));
    const keptSections = sections.rows.filter((s) => s.family_id !== removed).map((s) => ({ ...s, id: newSection(s.id), family_id: newId(s.family_id) }));
    const keptRequirements = requirements.rows.map((r) => ({ ...r, family_id: newId(r.family_id), section: newSection(r.section) }));
    const dup = (list, key) => list.length !== new Set(list.map((x) => x[key])).size;
    if (dup(keptFamilies, "id") || dup(keptSections, "id")) {
      console.error("The renumbering would give two chapters or sections the same number. Nothing was changed.");
      problems++;
    } else {
      const moved = requirements.rows.filter((r) => newId(r.family_id) !== r.family_id).length;
      const last = keptFamilies.find((f) => f.name === "Temporary facilities");
      families.rows = keptFamilies;
      sections.rows = keptSections;
      requirements.rows = keptRequirements;
      csvChanged = true;
      summary = `chapter ${removed} ${REMOVE_NAME} removed with ${dropped.length} section${dropped.length === 1 ? "" : "s"}; ${moved} requirement${moved === 1 ? "" : "s"} renumbered${last ? ` (Temporary facilities is now chapter ${last.id})` : ""}`;
    }
  }
}

if (problems) {
  console.error(`\n${problems} problem(s). Nothing was written.`);
  process.exit(2);
}

// ---------- write ----------
for (const e of edits) if (e.changed) { writeText(e.full, e.text, e.crlf); console.log("edited  src/" + e.rel); }
if (csvChanged) {
  fs.writeFileSync(path.join(dataDir, "families.csv"), csv.toCsv(families.fields, families.rows), "utf8");
  fs.writeFileSync(path.join(dataDir, "sections.csv"), csv.toCsv(sections.fields, sections.rows), "utf8");
  fs.writeFileSync(path.join(dataDir, "requirements.csv"), csv.toCsv(requirements.fields, requirements.rows), "utf8");
  console.log(`edited  data/register (${summary})`);
}
if (fs.existsSync(path.join(front, "scripts", "build-register.mjs"))) {
  const run = spawnSync(process.execPath, [path.join("scripts", "build-register.mjs")], { stdio: "inherit" });
  if (run.status !== 0) {
    console.error("\nThe register did not build. Fix the problem shown above, then run: npm run register:build");
    process.exit(3);
  }
}
