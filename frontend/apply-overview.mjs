// Venue Compliance Hub: the new Overview (landing page).
// Run from the frontend folder:  node apply-overview.mjs
//
// Replaces the map-first landing page with a dashboard: four headline figures, the stadium portfolio, a map of Saudi Arabia
// and the exposure of the stadium that is open, with the FIFA chapters down the left. It
//   - replaces src/components/pages/AssuranceHomePage.jsx (the page that app/page.jsx renders; the export name is unchanged,
//     so nothing else needs to change). It only replaces the page that came with the app or this page; anything else it leaves
//     alone and says so,
//   - adds the page's components (Overview*.jsx) and its data code (src/lib/overview),
//   - adds data/overview/schedule.json (the forecast slip of each stadium's next gate; kept as it is if you already have one),
//   - adds one block to the stylesheet.
// Needs the earlier kits installed, including twin-areas-kit.zip (site conditions). The map, the legend and the exposure
// classes read the same register data as every other page. Safe to run again. If something does not match what this
// script expects it says what and writes nothing at all.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const front = process.cwd();
const src = path.join(front, "src");
const repoData = path.resolve(front, "..", "data");

if (!fs.existsSync(src)) { console.error("Run this from the frontend folder (src/ not found)."); process.exit(1); }

const readText = (p) => {
  let raw = fs.readFileSync(p, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  return { text: raw.replace(/\r\n/g, "\n"), crlf: raw.includes("\r\n") };
};
const writeText = (p, text, crlf) => fs.writeFileSync(p, crlf ? text.replace(/\n/g, "\r\n") : text, "utf8");

// ---------- what the page reads from the rest of the app ----------
const exportsName = (text, name) =>
  new RegExp(`export\\s+(?:async\\s+)?(?:const|let|function|class)\\s+${name}\\b`).test(text) ||
  new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`).test(text);
const NEEDS = [
  ["lib/domain/exposure.mjs", ["stadiumExposure", "schedulePosition", "nextGate", "EXPOSURE"]],
  ["lib/domain/facilities.mjs", ["FACILITY_REGISTER", "STATUS_LABEL"]],
  ["lib/domain/cityAssurance.mjs", ["PILLARS"]],
  ["lib/domain/siteConditions.mjs", ["SITE_CONDITIONS", "isLogged"]],
  ["lib/register/data.mjs", ["FAMILIES"]],
  ["lib/store/alerts.js", ["allAlerts"]],
  ["lib/store/assessments.js", ["getAssessments"]],
  ["lib/store/state.js", ["updateMap"]],
  ["components/templates/PageTemplate.jsx", []],
];
const problems = [];
for (const [rel, names] of NEEDS) {
  const full = path.join(src, rel);
  if (!fs.existsSync(full)) { problems.push(`src/${rel} is missing`); continue; }
  const text = readText(full).text;
  for (const n of names) if (!exportsName(text, n)) problems.push(`src/${rel} does not export ${n}`);
}
if (!fs.existsSync(path.join(repoData, "geo", "sa-regions.geo.json"))) problems.push("data/geo/sa-regions.geo.json is missing (expected next to the frontend folder)");
if (problems.length) {
  console.error(`The Overview needs things that are not there:\n  - ${problems.join("\n  - ")}\nApply the earlier kits first, including twin-areas-kit.zip. Nothing was written.`);
  process.exit(1);
}

// ---------- the page is replaced only when it is the one that came with the app, or this one ----------
const pagePath = path.join(src, "components", "pages", "AssuranceHomePage.jsx");
if (!fs.existsSync(pagePath)) { console.error("src/components/pages/AssuranceHomePage.jsx is missing. Nothing was written."); process.exit(1); }
const page = readText(pagePath);
const newPage = readText(path.join(here, "files", "frontend", "src", "components", "pages", "AssuranceHomePage.jsx"));
let pageAction = "replace";
if (page.text === newPage.text) pageAction = "same";
else if (!(page.text.includes("export default function AssuranceHomePage") && (page.text.includes("AssuranceMap") || page.text.includes("OverviewKpis")))) {
  console.error("NOT APPLIED   src/components/pages/AssuranceHomePage.jsx is not the landing page that came with the app, so it was left alone. Nothing was written.");
  process.exit(2);
}

// ---------- write ----------
const codeRoot = path.join(here, "files", "frontend", "src");
function copyTree(fromRoot, toRoot, { skipExisting = false, skip = () => false } = {}) {
  for (const entry of fs.readdirSync(fromRoot, { withFileTypes: true })) {
    const from = path.join(fromRoot, entry.name);
    const to = path.join(toRoot, entry.name);
    if (skip(from)) continue;
    if (entry.isDirectory()) { copyTree(from, to, { skipExisting, skip }); continue; }
    const exists = fs.existsSync(to);
    const rel = path.relative(path.resolve(front, ".."), to).replace(/\\/g, "/");
    if (exists && skipExisting) { console.log(`kept     ${rel} (already there)`); continue; }
    const body = readText(from);
    if (exists && readText(to).text === body.text) { console.log(`already in place: ${rel}`); continue; }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    writeText(to, body.text, exists ? readText(to).crlf : true);
    console.log(`wrote   ${rel}`);
  }
}
copyTree(path.join(here, "files", "data"), repoData, { skipExisting: true });
copyTree(path.join(codeRoot, "lib"), path.join(src, "lib"));
copyTree(path.join(codeRoot, "components", "organisms"), path.join(src, "components", "organisms"));
if (pageAction === "same") console.log("already in place: src/components/pages/AssuranceHomePage.jsx");
else {
  writeText(pagePath, newPage.text, page.crlf);
  console.log("wrote   src/components/pages/AssuranceHomePage.jsx (the new Overview)");
}

const cssPath = path.join(src, "styles", "components.css");
const MARK = "/* ---------- Overview (Venue Compliance Hub) ---------- */";
if (!fs.existsSync(cssPath)) console.error("src/styles/components.css not found; styles not added.");
else {
  const css = readText(cssPath);
  if (css.text.includes(MARK)) console.log("already in place: src/styles/components.css");
  else {
    writeText(cssPath, css.text.replace(/\n*$/, "\n") + readText(path.join(here, "files", "overview.css")).text, css.crlf);
    console.log("edited  src/styles/components.css");
  }
}
