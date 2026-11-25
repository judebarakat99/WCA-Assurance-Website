// Venue Compliance Hub: national overview on the home page.
// Run from the frontend folder:  node apply-overview.cjs
// Adds src/lib/domain/exposure.mjs and src/components/organisms/NationalStatus.jsx,
// appends the styles to src/styles/components.css, and shows the overview above the map
// on the home page. Safe to run again: anything already in place is left alone.
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

// 1. new files
const NEW = [
  ["files/exposure.mjs", "lib/domain/exposure.mjs"],
  ["files/NationalStatus.jsx", "components/organisms/NationalStatus.jsx"],
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
const MARK = "/* ---------- National overview (Venue Compliance Hub) ---------- */";
const css = readText(cssPath);
if (css.text.includes(MARK)) {
  console.log("already in place: components.css");
} else {
  const add = readText(path.join(here, "files/overview.css")).text;
  writeText(cssPath, css.text.replace(/\n*$/, "\n") + add, css.crlf);
  console.log("edited  src/styles/components.css");
}

// 3. home page
const pagePath = path.join(src, "components", "pages", "AssuranceHomePage.jsx");
const page = readText(pagePath);
let t = page.text;
const IMPORT_ANCHOR = 'import PillarRail from "@/components/organisms/PillarRail";';
const IMPORT_NEW = 'import NationalStatus from "@/components/organisms/NationalStatus";';
const USE_RE = /^([ \t]*)\{\(\{ ui \}\) => <AssuranceHome ui=\{ui\} \/>\}$/m;
if (t.includes("<NationalStatus")) {
  console.log("already in place: AssuranceHomePage.jsx");
} else if (!t.includes(IMPORT_ANCHOR) || !USE_RE.test(t)) {
  console.error("AssuranceHomePage.jsx does not match what I expected. Nothing was changed there.");
  process.exit(2);
} else {
  if (!t.includes(IMPORT_NEW)) t = t.replace(IMPORT_ANCHOR, () => IMPORT_NEW + "\n" + IMPORT_ANCHOR);
  t = t.replace(USE_RE, (m, i) =>
    [`${i}{({ ui }) => (`, `${i}  <>`, `${i}    <NationalStatus />`, `${i}    <AssuranceHome ui={ui} />`, `${i}  </>`, `${i})}`].join("\n"));
  writeText(pagePath, t, page.crlf);
  console.log("edited  src/components/pages/AssuranceHomePage.jsx");
}
