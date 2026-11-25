// Venue Compliance Hub: FIFA-critical areas on the 3D model, chapter layers and site conditions that raise exposure.
// Run from the frontend folder:  node apply-twin-areas.mjs
//
// Needs the earlier kits installed, including twin-register-kit.zip (the 3D design review reading the register). It
//   - adds a "Critical areas" tab to the 3D view: 17 areas of King Salman International Stadium, drawn on the model as a
//     heat map. Each is coloured by the worst mitigation exposure among the register requirements that belong to it, so
//     it matches the stadium page, the Overview and the reports. Click one to see its requirements, status, exposure,
//     action, owner and due date (src/lib/twin/design.mjs holds the areas);
//   - adds chapter layers: a button for each FIFA chapter shows or hides that chapter's areas and checks;
//   - makes criticality dynamic: site conditions (src/lib/domain/siteConditions.mjs) raise the exposure of the
//     requirements they touch, and a check's criticality, and say why ("raised from High because ..."). Logging one on the
//     Critical areas tab raises alerts for the owners, and the raise shows everywhere: the stadium page, the Overview,
//     reports and Nabd, because the register's exposure logic (src/lib/domain/exposure.mjs) now reads the conditions.
// It edits these of your files with exact-text edits: src/components/twin/twinEngine.js, Twin3D.jsx and twin.css,
// src/lib/domain/exposure.mjs and src/lib/store/alerts.js (so Reset demo clears the conditions). It replaces
// src/components/organisms/DesignReviewSection.jsx and src/lib/twin/design.mjs and session.js from the previous kit.
// Safe to run again. If a file does not match what this script expects, it says which one and writes nothing at all.
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
  "components/twin/twin.css",
  "components/organisms/DesignReviewSection.jsx",
  "lib/twin/design.mjs",
  "lib/twin/session.js",
  "lib/domain/exposure.mjs",
  "lib/store/alerts.js",
];
const missing = need.filter((f) => !fs.existsSync(path.join(src, f)));
if (missing.length) {
  console.error(`These files are missing: ${missing.map((f) => "src/" + f).join(", ")}.\nApply the earlier kits first, including twin-register-kit.zip. Nothing was written.`);
  process.exit(1);
}

const readText = (p) => {
  let raw = fs.readFileSync(p, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  return { text: raw.replace(/\r\n/g, "\n"), crlf: raw.includes("\r\n") };
};
const writeText = (p, text, crlf) => fs.writeFileSync(p, crlf ? text.replace(/\n/g, "\r\n") : text, "utf8");
const count = (a, b) => a.split(b).length - 1;
const exact = (name, from, to, applied) => ({
  name,
  applied: applied || ((t) => t.includes(to)),
  apply: (t) => (count(t, from) === 1 ? t.replace(from, () => to) : null),
});

const BLOCK = readText(path.join(here, "files", "engine-areas.js")).text.replace(/\n+$/, "\n");
const BLOCK_MARK = "/* ---------- FIFA-critical areas, chapter layers and site conditions (Venue Compliance Hub) ---------- */";

// ---------- twinEngine.js ----------
const ENGINE = [
  exact(
    "mode buttons",
    '<button type="button" class="tourbtn" data-tw="play">Play intake demo</button>',
    '<div class="tw-modes" role="tablist" aria-label="View"><button type="button" role="tab" data-tw="mode-review" aria-selected="true">Design review</button><button type="button" role="tab" data-tw="mode-areas" aria-selected="false">Critical areas</button></div>\n    <button type="button" class="tourbtn" data-tw="play">Play intake demo</button>',
    (t) => t.includes('data-tw="mode-areas"'),
  ),
  exact(
    "heat key and chapter buttons",
    '<div class="tw-ov tw-legend">',
    '<div class="tw-ov tw-zonekey" hidden><span class="tw-zk-t">Mitigation exposure</span><span class="l critical">Critical</span><span class="l material">Material</span><span class="l manageable">Manageable</span><span class="l controlled">Controlled</span><small>Outline colour is the FIFA chapter</small></div>\n    <div class="tw-ov tw-chapters"></div>\n    <div class="tw-ov tw-legend">',
    (t) => t.includes('class="tw-ov tw-chapters"'),
  ),
  exact(
    "areas layer button",
    '<button class="tw-layer" type="button" data-l="pins" aria-pressed="true">Check pins</button>',
    '<button class="tw-layer" type="button" data-l="pins" aria-pressed="true">Check pins</button>\n      <button class="tw-layer" type="button" data-l="areas" aria-pressed="false">FIFA-critical areas</button>',
    (t) => t.includes('data-l="areas"'),
  ),
  {
    name: "areas, chapters and site conditions",
    applied: (t) => t.includes(BLOCK_MARK),
    apply: (t) => {
      const from = "if(ok3d){try{build();}catch(e){console.error(e);ok3d=false;}}";
      if (count(t, from) !== 1) return null;
      return t.replace(from, () => `${BLOCK}if(ok3d){try{build();buildZones();}catch(e){console.error(e);ok3d=false;}}`);
    },
  },
  exact(
    "check pins follow the mode and the chapter layers",
    "el.classList.toggle('hide',!(vis&&S.layers.pins&&S.pinsOn.has(c.id)));",
    "el.classList.toggle('hide',!(vis&&S.layers.pins&&S.pinsOn.has(c.id)&&S.mode==='review'&&chapterOn(c)));",
  ),
  exact(
    "area pins are placed with the other overlays",
    "labelEls.forEach(([el,p])=>{el.style.visibility=place(el,p)?'visible':'hidden';});dimEls.forEach(([el,p])=>place(el,p));",
    "labelEls.forEach(([el,p])=>{el.style.visibility=place(el,p)?'visible':'hidden';});dimEls.forEach(([el,p])=>place(el,p));placeZones(place);",
  ),
  exact(
    "critical areas pulse",
    "const show=S.sel==='FOP-01'||S.running==='FOP-01';dimLines.visible=show;dimEls.forEach(([d])=>d.hidden=!show);",
    "const show=S.sel==='FOP-01'||S.running==='FOP-01';dimLines.visible=show;dimEls.forEach(([d])=>d.hidden=!show);zonePulse(now);",
  ),
  exact(
    "the lighting layer gives way to the areas",
    "function applyLayers(){q('.tw-heatkey').hidden=!(S.heatOn&&S.layers.heat&&ok3d);",
    "function applyLayers(){q('.tw-heatkey').hidden=!(S.heatOn&&S.layers.heat&&ok3d&&S.mode!=='areas');",
  ),
  exact(
    "the areas follow the layers",
    "heatMesh.visible=S.heatOn&&S.layers.heat;chairsBase.visible=S.layers.acc;chairsEast.visible=S.layers.acc&&S.rev==='D';roofMeshes.forEach(m=>m.visible=S.layers.roof);}",
    "heatMesh.visible=S.heatOn&&S.layers.heat&&S.mode!=='areas';chairsBase.visible=S.layers.acc;chairsEast.visible=S.layers.acc&&S.rev==='D';roofMeshes.forEach(m=>m.visible=S.layers.roof);applyZones();}",
  ),
  exact(
    "the Critical areas panel",
    "function renderPanel(){\n  const el=q('.tw-scroll');const keep=el.scrollTop;let h='';const st=S.stage;\n",
    "function renderPanel(){\n  const el=q('.tw-scroll');const keep=el.scrollTop;let h='';const st=S.stage;\n  if(S.mode==='areas'){el.innerHTML=areasPanel();el.scrollTop=keep;q('.tw-foot').hidden=true;return;}\n  q('.tw-foot').hidden=false;\n",
  ),
  exact(
    "the new buttons",
    "const b=ev.target.closest('button');if(!b||!root.contains(b))return;\n",
    "const b=ev.target.closest('button');if(!b||!root.contains(b))return;\n  if(areasClick(b))return;\n",
  ),
  exact("start again returns to the design review", "reset(){stopAuto();tok++;logged.clear();", "reset(){setMode('review');stopAuto();tok++;logged.clear();"),
  exact("Reset view frames the areas on the Critical areas tab", "else if(a==='recenter')fly(VIEW0,1000);", "else if(a==='recenter')fly(S.mode==='areas'?areasView():VIEW0,1000);"),
  exact(
    "a raised check says so in the list",
    '<span class="t">${c.t}</span>${showRes?(running?',
    '<span class="t">${c.t}${escBadge(c)}</span>${showRes?(running?',
  ),
  exact(
    "and in its detail card",
    "<dd>${c.crit} · Gate G1</dd>",
    "<dd>${c.crit} · Gate G1${critWhy(c)}</dd>",
    (t) => t.includes("${critWhy(c)}"),
  ),
];

// ---------- Twin3D.jsx ----------
const TWIN3D = [
  exact(
    "props",
    "export default function Twin3D({ onEvent, onChange, onResults, onSend, design, autoPlay }) {",
    "export default function Twin3D({ onEvent, onChange, onResults, onSend, onSite, design, autoPlay }) {",
  ),
  exact(
    "hooks",
    "twin.hooks({ onEvent, onChange, onResults, onSend });",
    "twin.hooks({ onEvent, onChange, onResults, onSend, onSite });",
  ),
];

// ---------- exposure.mjs: the register's exposure reads the site conditions ----------
const EXPOSURE = [
  exact(
    "import",
    'import { stadiumAssurance } from "@/lib/domain/cityAssurance.mjs";',
    'import { stadiumAssurance } from "@/lib/domain/cityAssurance.mjs";\nimport { escalationFor } from "@/lib/domain/siteConditions.mjs";',
  ),
  exact(
    "the base exposure keeps its logic",
    "export function findingExposure(stadium, row, record) {",
    "function baseFindingExposure(stadium, row, record) {",
    (t) => t.includes("function baseFindingExposure("),
  ),
  {
    name: "site conditions raise the exposure",
    applied: (t) => t.includes("export function findingExposure(stadium, row, record) {\n  const base = baseFindingExposure("),
    apply: (t) => {
      const from = "export function stadiumExposure(stadium, records) {";
      if (count(t, from) !== 1 || !t.includes("function baseFindingExposure(") || !t.includes("KEY_BY_LEVEL") || !t.includes("const clamp")) return null;
      const fn = [
        "/**",
        " * The exposure of one requirement at one stadium. It starts at what the requirement's status gives it; site conditions",
        " * logged against it (lib/domain/siteConditions) then raise it, and the reason says why. A compliant requirement is not raised.",
        " */",
        "export function findingExposure(stadium, row, record) {",
        "  const base = baseFindingExposure(stadium, row, record);",
        '  if ((record?.status || "unassessed") === "compliant") return base;',
        "  const esc = escalationFor(stadium.id, row.requirement.id);",
        "  if (!esc.steps) return base;",
        "  const from = KEY_BY_LEVEL.indexOf(base.level);",
        "  const to = clamp(from + esc.steps, 0, 3);",
        '  const because = esc.reasons.map((r) => r.because).join("; ");',
        "  if (to === from) return { ...base, escalated: { from: base.level, to: base.level, reasons: esc.reasons } };",
        "  const level = KEY_BY_LEVEL[to];",
        "  return { level, reason: `${base.reason} Raised from ${EXPOSURE[base.level].label} to ${EXPOSURE[level].label} because ${because}.`, escalated: { from: base.level, to: level, reasons: esc.reasons } };",
        "}",
        "",
      ].join("\n");
      return t.replace(from, () => fn + from);
    },
  },
  exact(
    "the finding carries why it was raised (1)",
    "const { level, reason } = findingExposure(stadium, row, record);",
    "const { level, reason, escalated } = findingExposure(stadium, row, record);",
  ),
  exact(
    "the finding carries why it was raised (2)",
    "findings.push({ row, record, level, reason });",
    "findings.push({ row, record, level, reason, escalated });",
  ),
];

// ---------- alerts.js: Reset demo clears the site conditions ----------
const ALERTS = [
  exact(
    "import",
    'import { clearCustom } from "@/lib/watch/custom";',
    'import { clearCustom } from "@/lib/watch/custom";\nimport { clearSiteConditions } from "@/lib/domain/siteConditions.mjs";',
  ),
  exact("Reset demo clears the site conditions", "  clearCustom();\n", "  clearCustom();\n  clearSiteConditions();\n", (t) => t.includes("clearSiteConditions();")),
];

const plans = [
  { rel: "components/twin/twinEngine.js", steps: ENGINE },
  { rel: "components/twin/Twin3D.jsx", steps: TWIN3D },
  { rel: "lib/domain/exposure.mjs", steps: EXPOSURE },
  { rel: "lib/store/alerts.js", steps: ALERTS },
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

// The section component and the twin library files come from the previous kit; replace them only when they are those.
const sectionPath = path.join(src, "components", "organisms", "DesignReviewSection.jsx");
const section = readText(sectionPath);
const newSection = readText(path.join(here, "files", "frontend", "src", "components", "organisms", "DesignReviewSection.jsx"));
let sectionAction = "replace";
if (section.text === newSection.text) sectionAction = "same";
else if (!section.text.includes("buildDesign(") || !section.text.includes('id="design-review-title"')) {
  console.error("NOT APPLIED   src/components/organisms/DesignReviewSection.jsx: it is not the section installed by twin-register-kit.zip, so it was left alone");
  problems++;
}
for (const f of ["lib/twin/design.mjs", "lib/twin/session.js"]) {
  const cur = readText(path.join(src, f)).text;
  const nxt = readText(path.join(here, "files", "frontend", "src", f)).text;
  if (cur !== nxt && !(cur.includes("buildDesign") || cur.includes("recordDesignResults"))) {
    console.error(`NOT APPLIED   src/${f}: it is not the file installed by twin-register-kit.zip, so it was left alone`);
    problems++;
  }
}

if (problems) {
  console.error(`\n${problems} problem(s). Nothing was written.`);
  process.exit(2);
}

// ---------- write ----------
for (const f of ["lib/domain/siteConditions.mjs", "lib/twin/design.mjs", "lib/twin/session.js"]) {
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
const cssPath = path.join(src, "components", "twin", "twin.css");
const MARK = "/* ---------- Critical areas, chapter layers and site conditions (Venue Compliance Hub) ---------- */";
const css = readText(cssPath);
if (css.text.includes(MARK)) console.log("already in place: twin.css");
else {
  writeText(cssPath, css.text.replace(/\n*$/, "\n") + readText(path.join(here, "files", "twin-areas.css")).text, css.crlf);
  console.log("edited  src/components/twin/twin.css");
}
for (const e of edits) if (e.changed) { writeText(e.full, e.text, e.crlf); console.log("edited  src/" + e.rel); }
