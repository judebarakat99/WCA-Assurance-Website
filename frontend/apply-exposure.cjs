// Venue Compliance Hub: mitigation exposure view on every stadium page.
// Run from the frontend folder:  node apply-exposure.cjs
// Adds src/lib/domain/exposure.mjs, src/lib/domain/mitigation.mjs and
// src/components/organisms/StadiumExposure.jsx, appends the styles to
// src/styles/components.css, and shows the view on the facility page above the
// requirement tables. Safe to run again: anything already in place is left alone.
const fs = require("fs");
const path = require("path");

const here = __dirname;
const src = path.resolve("src");
if (!fs.existsSync(src)) { console.error("Run this from the frontend folder (src/ not found)."); process.exit(1); }

const readText = (p) => {
  let raw = fs.readFileSync(p, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  return { text: raw.replace(/\r\n/g, "\n"), crlf: raw.includes("\r\n") };
};
const writeText = (p, text, crlf) => fs.writeFileSync(p, crlf ? text.replace(/\n/g, "\r\n") : text, "utf8");

// Check the page matches before anything is written.
const pagePath = path.join(src, "components", "pages", "FacilityPage.jsx");
if (!fs.existsSync(pagePath)) { console.error("FacilityPage.jsx not found."); process.exit(1); }
const page = readText(pagePath);
const IMPORT_ANCHOR = 'import AssessmentTable from "@/components/organisms/AssessmentTable";';
const IMPORT_NEW = 'import StadiumExposure from "@/components/organisms/StadiumExposure";';
const USE_ANCHOR = "<Summary summary={summary} />";
const count = (a, b) => a.split(b).length - 1;
const alreadyOnPage = page.text.includes("<StadiumExposure");
if (!alreadyOnPage && (count(page.text, IMPORT_ANCHOR) !== 1 || count(page.text, USE_ANCHOR) !== 1)) {
  console.error("FacilityPage.jsx does not match what I expected. Nothing was changed.");
  process.exit(2);
}

// 1. new files
const NEW = [
  ["files/exposure.mjs", "lib/domain/exposure.mjs"],
  ["files/mitigation.mjs", "lib/domain/mitigation.mjs"],
  ["files/StadiumExposure.jsx", "components/organisms/StadiumExposure.jsx"],
];
for (const [from, to] of NEW) {
  const dest = path.join(src, to);
  const body = readText(path.join(here, from));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const crlf = fs.existsSync(dest) ? readText(dest).crlf : true;
  writeText(dest, body.text, crlf);
  console.log("wrote   src/" + to);
}

// 2. styles
const cssPath = path.join(src, "styles", "components.css");
const MARK = "/* ---------- Stadium exposure view (Venue Compliance Hub) ---------- */";
const css = readText(cssPath);
if (css.text.includes(MARK)) {
  console.log("already in place: components.css");
} else {
  const add = readText(path.join(here, "files/exposure-view.css")).text;
  writeText(cssPath, css.text.replace(/\n*$/, "\n") + add, css.crlf);
  console.log("edited  src/styles/components.css");
}

// 3. facility page
if (alreadyOnPage) {
  console.log("already in place: FacilityPage.jsx");
} else {
  let t = page.text;
  t = t.replace(IMPORT_ANCHOR, () => IMPORT_ANCHOR + "\n" + IMPORT_NEW);
  const indent = (t.split("\n").find((l) => l.includes(USE_ANCHOR)) || "").match(/^\s*/)[0];
  t = t.replace(USE_ANCHOR, () => "<StadiumExposure stadium={stadium} records={records} />\n" + indent + USE_ANCHOR);
  writeText(pagePath, t, page.crlf);
  console.log("edited  src/components/pages/FacilityPage.jsx");
}
