// Venue Compliance Hub: a simpler Requirement watch and a heat map for "View impact".
// Run from the frontend folder:  node apply-watch-map.mjs
//
// Needs the earlier kits installed, including requirement-values-and-input-kit.zip. It
//   - removes the "Impact assessment agent" box from the Requirement watch, so the page starts with the requirement
//     extraction agent,
//   - leaves everything below the extraction agent empty until a change is added (type or drop, Find requirements,
//     Add to the watch),
//   - redesigns "View impact": a heat map of the stadiums affected (the same regions and pins as the Overview map),
//     the numbers beside it, a short list of the affected stadiums, then the two actions,
//   - makes Nabd's answer about proposed requirement changes read what is in the watch.
// Safe to run again. If a file does not match what this script expects, it says which one and writes nothing at all.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const front = process.cwd();
const src = path.join(front, "src");
const geo = path.resolve(front, "..", "data", "geo", "sa-regions.geo.json");

if (!fs.existsSync(src)) { console.error("Run this from the frontend folder (src/ not found)."); process.exit(1); }
for (const need of ["lib/watch/extract.mjs", "lib/watch/custom.js", "components/organisms/AddChangePanel.jsx", "components/organisms/RequirementWatch.jsx"]) {
  if (!fs.existsSync(path.join(src, need))) {
    console.error(`src/${need} is missing. Apply the earlier kits first, including requirement-values-and-input-kit.zip.`);
    process.exit(1);
  }
}
if (!fs.existsSync(geo)) { console.error("data/geo/sa-regions.geo.json was not found (the Overview map's region file, expected next to frontend/)."); process.exit(1); }

const readText = (p) => {
  let raw = fs.readFileSync(p, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  return { text: raw.replace(/\r\n/g, "\n"), crlf: raw.includes("\r\n") };
};
const writeText = (p, text, crlf) => fs.writeFileSync(p, crlf ? text.replace(/\n/g, "\r\n") : text, "utf8");
const count = (a, b) => a.split(b).length - 1;

// ---------- Nabd: all of these edits or none ----------
const CHAT_ROWS_OLD = `  const applied = new Set(appliedChanges().map((c) => c.changeId));
  const rows = CHANGE_SCENARIOS.filter((s) => !applied.has(s.id)).map((s) => assessChange(s, records)).filter(Boolean);
  if (!rows.length) return { reply: "There are no proposed requirement changes waiting for a decision.", sources: [] };`;
const CHAT_ROWS_NEW = `  void records;
  const rows = watchItems().filter((i) => i.state !== "applied" && i.assessment).map((i) => i.assessment);
  if (!rows.length)
    return {
      reply: "No requirement change has been added to the watch yet. On the Requirement watch tab, type a requirement or drop a FIFA document and the agent will assess it.",
      sources: [],
    };`;
const CHAT_LINE_OLD = "    bullets(rows.map((a) => `${a.scenario.title} (${a.before.id}: ${a.oldCrit} to ${a.crit}): ${a.counts.reopened} compliant would reopen, ${a.counts.failsInReview} would fail in review, ${plural(a.owners.length, \"owner\")} to act`)),";
const CHAT_LINE_NEW = [
  "    bullets(",
  "      rows.map((a) =>",
  "        a.kind === \"new\"",
  "          ? `${a.scenario.title} (new requirement of ${a.crit}): ${plural(a.actionable.length, \"stadium\")} to start assessing soon, ${plural(a.owners.length, \"owner\")} to act`",
  "          : `${a.scenario.title} (${a.before.id}: ${a.oldCrit} to ${a.crit}): ${a.counts.reopened} compliant would reopen, ${a.counts.failsInReview} would fail in review, ${plural(a.owners.length, \"owner\")} to act`,",
  "      ),",
  "    ),",
].join("\n");
const CHAT_IMPORT_OLD = 'import { assessChange } from "@/lib/watch/impact.mjs";';
const CHAT_IMPORT_NEW = 'import { watchItems } from "@/lib/watch/actions";';

const chatPlan = {
  name: "Nabd reads the requirement watch",
  optional: true,
  applied: (t) => t.includes("watchItems().filter"),
  apply: (t) => {
    if (count(t, CHAT_ROWS_OLD) !== 1 || count(t, CHAT_IMPORT_OLD) !== 1 || count(t, CHAT_LINE_OLD) !== 1) return null;
    return t.replace(CHAT_ROWS_OLD, () => CHAT_ROWS_NEW).replace(CHAT_IMPORT_OLD, () => CHAT_IMPORT_NEW).replace(CHAT_LINE_OLD, () => CHAT_LINE_NEW);
  },
};

const edits = [];
let problems = 0;
const chatFile = path.join(src, "lib", "assistant", "localChat.js");
if (fs.existsSync(chatFile)) {
  const file = readText(chatFile);
  if (chatPlan.applied(file.text)) console.log("already in place: lib/assistant/localChat.js [Nabd reads the requirement watch]");
  else {
    const next = chatPlan.apply(file.text);
    if (next == null) console.log("skipped (not found): lib/assistant/localChat.js [Nabd reads the requirement watch]");
    else edits.push({ full: chatFile, text: next, crlf: file.crlf, rel: "lib/assistant/localChat.js" });
  }
}
if (problems) { console.error(`\n${problems} problem(s). Nothing was written.`); process.exit(2); }

// ---------- write ----------
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

const cssPath = path.join(src, "styles", "components.css");
const MARK = "/* ---------- Requirement watch: impact map (Venue Compliance Hub) ---------- */";
if (!fs.existsSync(cssPath)) console.error("src/styles/components.css not found; styles not added.");
else {
  const css = readText(cssPath);
  if (css.text.includes(MARK)) console.log("already in place: components.css");
  else {
    writeText(cssPath, css.text.replace(/\n*$/, "\n") + readText(path.join(here, "files", "watch3.css")).text, css.crlf);
    console.log("edited  src/styles/components.css");
  }
}
for (const e of edits) { writeText(e.full, e.text, e.crlf); console.log("edited  src/" + e.rel); }
