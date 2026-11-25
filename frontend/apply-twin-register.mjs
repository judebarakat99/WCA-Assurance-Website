// Venue Compliance Hub: the 3D design review reads its thresholds from the requirement register and records its
// results there.
// Run from the frontend folder:  node apply-twin-register.mjs
//
// Before, the 3D twin carried its own thresholds (1% wheelchair positions, 2,500 lux, 150 m² dressing rooms) and its
// results lived only in the twin. This
//   - builds the design review from the register (src/lib/twin/design.mjs): each check names the requirement it comes
//     from, takes its number from the register, and says where the threshold came from (the register, the register's
//     own wording, or the design brief where the register has nothing);
//   - groups the checks by the register's FIFA chapters (so the "assured by family" bars match the rest of the site);
//   - records each result as evidence for King Salman International Stadium when the check runs (Rev C, then the Rev D
//     re-check), and raises an alert for each finding when it is sent to the design team (src/lib/twin/session.js);
//   - shows each check's mitigation exposure and where its threshold came from in the check's detail card;
//   - shows "Design review in the register" under the 3D view (components/organisms/DesignReviewSection.jsx).
// It edits three of your files: src/components/twin/twinEngine.js and Twin3D.jsx (small exact-text edits) and
// components/organisms/DesignReviewSection.jsx (replaced). Safe to run again. If a file does not match what this script
// expects, it says which one and writes nothing at all.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const front = process.cwd();
const src = path.join(front, "src");

if (!fs.existsSync(src)) { console.error("Run this from the frontend folder (src/ not found)."); process.exit(1); }
const need = [
  "components/twin/twinEngine.js",
  "components/twin/Twin3D.jsx",
  "components/organisms/DesignReviewSection.jsx",
  "lib/domain/exposure.mjs",
  "lib/store/alerts.js",
  "lib/store/assessments.js",
  "lib/register/data.mjs",
];
const missing = need.filter((f) => !fs.existsSync(path.join(src, f)));
if (missing.length) {
  console.error(`These files are missing: ${missing.map((f) => "src/" + f).join(", ")}.\nApply the earlier kits first (the register kit, the intake agent kit and the 3D design review on the King Salman page). Nothing was written.`);
  process.exit(1);
}

const readText = (p) => {
  let raw = fs.readFileSync(p, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  return { text: raw.replace(/\r\n/g, "\n"), crlf: raw.includes("\r\n") };
};
const writeText = (p, text, crlf) => fs.writeFileSync(p, crlf ? text.replace(/\n/g, "\r\n") : text, "utf8");
const count = (a, b) => a.split(b).length - 1;
const exact = (name, from, to) => ({
  name,
  applied: (t) => t.includes(to),
  apply: (t) => (count(t, from) === 1 ? t.replace(from, () => to) : null),
});

// ---------- twinEngine.js ----------
const ENGINE = [
  exact("the engine takes the design", "export function createTwin(THREE,OrbitControls){", "export function createTwin(THREE,OrbitControls,design){"),
  exact("lowest lux on the heat ramp", "const HAS3=!!(THREE&&OrbitControls);", "const HAS3=!!(THREE&&OrbitControls);\nconst LMIN=(design&&design.lightMin)||2500;"),
  exact("checks from the register", "const CHECKS=[", "const CHECKS=(design&&design.checks)||["),
  exact("facts from the design", "const FACTS=[", "const FACTS=(design&&design.facts)||["),
  exact("results from the register's thresholds", "const RES={C:{", "const RES=(design&&design.res)||{C:{"),
  exact("Rev D results", "RES.D=Object.assign({},RES.C,{", "RES.D=(design&&design.res)?RES.D:Object.assign({},RES.C,{"),
  exact("findings from the design", "const ITEMS=[", "const ITEMS=(design&&design.items)||["),
  exact(
    "heat map ramp starts at the register's lux",
    "const stops=[[2500,[44,79,143]],[2900,[42,161,152]],[3150,[216,201,90]],[3300,[243,163,59]]];",
    "const stops=[[LMIN,[44,79,143]],[LMIN+Math.round((3300-LMIN)*.5),[42,161,152]],[LMIN+Math.round((3300-LMIN)*.8125),[216,201,90]],[3300,[243,163,59]]];",
  ),
  exact("heat map clamp", "v=Math.max(2500,Math.min(3300,v));", "v=Math.max(LMIN,Math.min(3300,v));"),
  exact(
    "heat map key",
    "<span>2,500</span><span>2,900</span><span>3,300</span>",
    "<span>${fmt(LMIN)}</span><span>${fmt(LMIN+Math.round((3300-LMIN)/2))}</span><span>3,300</span>",
  ),
  exact(
    "exposure and threshold source on a check",
    "<dt>Criticality</dt><dd>${c.crit} · Gate G1</dd>",
    "<dt>Criticality</dt><dd>${c.crit} · Gate G1</dd>${(design&&design.exposureLine&&design.exposureLine(c.id))?`<dt>Exposure</dt><dd>${design.exposureLine(c.id)}</dd>`:''}${(design&&c.basis)?`<dt>Threshold from</dt><dd>${{register:'The requirement register',text:'The requirement register (its wording)',brief:'The design brief'}[c.basis]||''}</dd>`:''}",
  ),
  exact(
    "checks note",
    '<p class="tw-note">Checks are generated from the FIFA requirement families for an opening-match and final venue.</p>',
    '<p class="tw-note">Checks are generated from the requirement register for an opening-match and final venue. Each shows where its threshold comes from.</p>',
  ),
  exact("bars by chapter", '<p class="tw-sec">Assured by requirement family</p>', '<p class="tw-sec">Assured by FIFA chapter</p>'),
  exact(
    "results are recorded when the checks run",
    "emit('run','King Salman International Stadium design Rev C checked: 3 fails, 2 clarifications, G1 Design freeze blocked');",
    "emit('run','King Salman International Stadium design Rev C checked: 3 fails, 2 clarifications, G1 Design freeze blocked');if(hooks.onResults)hooks.onResults('C');",
  ),
  exact(
    "and when Rev D is re-checked",
    "emit('resub','King Salman International Stadium design Rev D re-checked: 4 checks re-run, all pass');",
    "emit('resub','King Salman International Stadium design Rev D re-checked: 4 checks re-run, all pass');if(hooks.onResults)hooks.onResults('D');",
  ),
  exact("alerts are raised when the findings are sent", "S.sent=true;emit('send',", "S.sent=true;if(hooks.onSend)hooks.onSend();emit('send',"),
];

// ---------- Twin3D.jsx ----------
const TWIN3D = [
  exact("props", "export default function Twin3D({ onEvent, onChange, autoPlay }) {", "export default function Twin3D({ onEvent, onChange, onResults, onSend, design, autoPlay }) {"),
  exact("the design reaches the engine", "const twin = createTwin(THREE, OrbitControls);", "const twin = createTwin(THREE, OrbitControls, design);"),
  exact("the hooks reach the engine", "twin.hooks({ onEvent, onChange });", "twin.hooks({ onEvent, onChange, onResults, onSend });"),
];

const plans = [
  { rel: "components/twin/twinEngine.js", steps: ENGINE },
  { rel: "components/twin/Twin3D.jsx", steps: TWIN3D },
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
    if (next == null) { console.error(`NOT APPLIED   src/${rel} [${step.name}]: the text is not what I expected`); problems++; continue; }
    text = next;
    changed = true;
  }
  edits.push({ rel, full, text, crlf: file.crlf, changed });
}

// The section component is replaced only when it is the one that was installed with the 3D design review.
const sectionPath = path.join(src, "components", "organisms", "DesignReviewSection.jsx");
const section = readText(sectionPath);
const newSection = readText(path.join(here, "files", "frontend", "src", "components", "organisms", "DesignReviewSection.jsx"));
let sectionAction = "replace";
if (section.text === newSection.text) sectionAction = "same";
else if (!section.text.includes('id="design-review-title"') || !section.text.includes("Twin3D")) {
  console.error("NOT APPLIED   src/components/organisms/DesignReviewSection.jsx: it is not the section installed with the 3D design review, so it was left alone");
  problems++;
}

if (problems) {
  console.error(`\n${problems} problem(s). Nothing was written.`);
  process.exit(2);
}

// ---------- write ----------
for (const f of ["lib/twin/design.mjs", "lib/twin/session.js"]) {
  const from = readText(path.join(here, "files", "frontend", "src", f));
  const to = path.join(src, f);
  const exists = fs.existsSync(to);
  if (exists && readText(to).text === from.text) { console.log(`already in place: ${f}`); continue; }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  writeText(to, from.text, exists ? readText(to).crlf : true);
  console.log(`wrote   src/${f}`);
}
if (sectionAction === "same") console.log("already in place: components/organisms/DesignReviewSection.jsx");
else {
  writeText(sectionPath, newSection.text, section.crlf);
  console.log("wrote   src/components/organisms/DesignReviewSection.jsx");
}
const cssPath = path.join(src, "styles", "components.css");
const MARK = "/* ---------- 3D design review in the register (Venue Compliance Hub) ---------- */";
if (!fs.existsSync(cssPath)) console.error("src/styles/components.css not found; styles not added.");
else {
  const css = readText(cssPath);
  if (css.text.includes(MARK)) console.log("already in place: components.css");
  else {
    writeText(cssPath, css.text.replace(/\n*$/, "\n") + readText(path.join(here, "files", "dr.css")).text, css.crlf);
    console.log("edited  src/styles/components.css");
  }
}
for (const e of edits) if (e.changed) { writeText(e.full, e.text, e.crlf); console.log("edited  src/" + e.rel); }
