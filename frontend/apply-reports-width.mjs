// Venue Compliance Hub: the Reports page uses the same page width as the other tabs.
// Run from the frontend folder:  node apply-reports-width.mjs
//
// The Reports page had two things of its own that made its width differ from the Evidence page: the full-width layout
// (edge to edge) and, in the first version of this fix, a column capped at 966 px (narrower than the other tabs). This
//   - replaces src/components/pages/ReportsPage.jsx with the page in the normal layout and no width of its own, so it
//     sits in the same container as the Evidence page and every other tab;
//   - removes the 966 px column rule from src/styles/components.css, if the earlier version of this fix added it.
// Needs the evidence and reports kit installed. Safe to run again. It only replaces a Reports page that came from that
// kit; anything else it leaves alone and says so.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const front = process.cwd();
const src = path.join(front, "src");
const page = path.join(src, "components", "pages", "ReportsPage.jsx");
const cssPath = path.join(src, "styles", "components.css");

if (!fs.existsSync(src)) { console.error("Run this from the frontend folder (src/ not found)."); process.exit(1); }
if (!fs.existsSync(page)) { console.error("src/components/pages/ReportsPage.jsx is missing. Apply the evidence and reports kit first."); process.exit(1); }

const readText = (p) => {
  let raw = fs.readFileSync(p, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  return { text: raw.replace(/\r\n/g, "\n"), crlf: raw.includes("\r\n") };
};
const writeText = (p, text, crlf) => fs.writeFileSync(p, crlf ? text.replace(/\n/g, "\r\n") : text, "utf8");

const current = readText(page);
if (!current.text.includes('chip="Reports · export"') || !current.text.includes("function Reports()")) {
  console.error("src/components/pages/ReportsPage.jsx is not the page from the evidence and reports kit, so it was left alone. Nothing was written.");
  process.exit(2);
}

// the 966 px column rule from the earlier version of this fix, with its comment lines
const CAP = /\n*\/\* -+ Reports page width \(Venue Compliance Hub\) -+ \*\/\n(?:\/\*[^\n]*\*\/\n)*\.rp-page \{[^}]*\}\n?/;
let css = null;
if (fs.existsSync(cssPath)) css = readText(cssPath);
const cssNeedsEdit = css && CAP.test(css.text);

const next = readText(path.join(here, "files", "frontend", "src", "components", "pages", "ReportsPage.jsx"));
if (current.text === next.text) console.log("already in place: src/components/pages/ReportsPage.jsx");
else {
  const was = /label="Reports" wide/.test(current.text) ? "the full-width layout is removed" : current.text.includes("rp-page") ? "the 966 px column is removed" : "updated";
  writeText(page, next.text, current.crlf);
  console.log(`wrote   src/components/pages/ReportsPage.jsx (${was})`);
}
if (cssNeedsEdit) {
  writeText(cssPath, css.text.replace(CAP, "\n").replace(/\n*$/, "\n"), css.crlf);
  console.log("edited  src/styles/components.css (the 966 px column rule is removed)");
} else console.log("already in place: src/styles/components.css (no width rule for the Reports page)");
