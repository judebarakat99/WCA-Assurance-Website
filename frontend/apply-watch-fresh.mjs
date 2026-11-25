// Venue Compliance Hub: the Requirement watch starts empty and nothing opens by itself.
// Run from the frontend folder:  node apply-watch-fresh.mjs
//
// Needs the earlier kits installed, including requirement-watch-map-kit.zip. It replaces five files:
//   components/organisms/RequirementTabs.jsx, RequirementWatch.jsx, AddChangePanel.jsx, lib/watch/actions.js and custom.js.
// The tab then behaves like this:
//   - opening the Requirement watch tab shows only the extraction agent: no tiles and no cards, even if changes were
//     added earlier (they stay stored, with their alerts and anything applied to the register);
//   - "Use an example" then "Find requirements" opens the found list, as before;
//   - "Add N to the watch" puts the tiles and the cards in, all closed; "View impact" opens one card at a time;
//   - opening the tab again (or reloading) starts empty again, and adding the same text again lists its changes again.
// Safe to run again. If a prerequisite file is missing it says which one and writes nothing.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const front = process.cwd();
const src = path.join(front, "src");

if (!fs.existsSync(src)) { console.error("Run this from the frontend folder (src/ not found)."); process.exit(1); }
const need = ["components/organisms/ImpactMap.jsx", "components/organisms/ChangeAssessment.jsx", "components/organisms/RequirementWatch.jsx", "components/organisms/RequirementTabs.jsx", "components/organisms/AddChangePanel.jsx", "lib/watch/actions.js", "lib/watch/custom.js", "lib/watch/extract.mjs"];
const missing = need.filter((f) => !fs.existsSync(path.join(src, f)));
if (missing.length) {
  console.error(`These files are missing: ${missing.map((f) => "src/" + f).join(", ")}.\nApply the earlier kits first, including requirement-watch-map-kit.zip. Nothing was written.`);
  process.exit(1);
}

const readText = (p) => {
  let raw = fs.readFileSync(p, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  return { text: raw.replace(/\r\n/g, "\n"), crlf: raw.includes("\r\n") };
};
const writeText = (p, text, crlf) => fs.writeFileSync(p, crlf ? text.replace(/\n/g, "\r\n") : text, "utf8");

function copyTree(fromRoot, toRoot) {
  for (const entry of fs.readdirSync(fromRoot, { withFileTypes: true })) {
    const from = path.join(fromRoot, entry.name);
    const to = path.join(toRoot, entry.name);
    if (entry.isDirectory()) { copyTree(from, to); continue; }
    const body = readText(from);
    const exists = fs.existsSync(to);
    if (exists && readText(to).text === body.text) { console.log("already in place: " + path.relative(front, to).replace(/\\/g, "/")); continue; }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    writeText(to, body.text, exists ? readText(to).crlf : true);
    console.log("wrote   " + path.relative(front, to).replace(/\\/g, "/"));
  }
}
copyTree(path.join(here, "files", "frontend"), front);
