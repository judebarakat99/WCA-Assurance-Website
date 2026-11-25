// Venue Compliance Hub: rename, wording clean-up and demo-data defaults.
// Run from the frontend folder:   node apply-hub-changes.mjs --dry     (preview)
//                                 node apply-hub-changes.mjs           (apply)
// Safe to run more than once: edits that are already in place are skipped.
// Edits are exact-match. If any edit for a file cannot be found, nothing is
// written for that file and it is reported.
// Edits marked "requires" wait until the 3D files are in src/components/twin.
import fs from "node:fs";
import path from "node:path";

const dry = process.argv.includes("--dry");
const root = path.resolve("src");
if (!fs.existsSync(root)) {
  console.error("Run this from the frontend folder (src/ not found).");
  process.exit(1);
}
const edits = JSON.parse(fs.readFileSync(new URL("./hub-edits.json", import.meta.url), "utf8"));
// The 3D files travel with this script (a "twin" folder next to it). Copy them in first.
const twinSrc = new URL("./twin/", import.meta.url);
if (fs.existsSync(twinSrc)) {
  const dest = path.join(root, "components/twin");
  for (const f of fs.readdirSync(twinSrc)) {
    const to = path.join(dest, f);
    const body = fs.readFileSync(new URL(f, twinSrc));
    if (fs.existsSync(to) && fs.readFileSync(to).equals(body)) continue;
    if (!dry) {
      fs.mkdirSync(dest, { recursive: true });
      fs.writeFileSync(to, body);
    }
    console.log(`${dry ? "would copy " : "copied     "}  components/twin/${f}`);
  }
}
const has3d = dry ? fs.existsSync(twinSrc) || fs.existsSync(path.join(root, "components/twin/Twin3D.jsx")) : fs.existsSync(path.join(root, "components/twin/Twin3D.jsx"));

const byFile = new Map();
for (const e of edits) byFile.set(e.file, [...(byFile.get(e.file) || []), e]);

const count = (text, s) => text.split(s).length - 1;
let failed = 0;
let deferred = 0;

for (const [file, list] of byFile) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    console.log(`MISSING FILE  ${file}`);
    failed++;
    continue;
  }
  const raw = fs.readFileSync(full, "utf8");
  const crlf = raw.includes("\r\n");
  let text = raw.replace(/\r\n/g, "\n");
  let ok = true;
  let applied = 0;
  let already = 0;

  for (const e of list) {
    if (e.requires && !has3d) {
      console.log(`DEFERRED      ${file}  [${e.note}] waits for src/${e.requires}`);
      deferred++;
      continue;
    }
    if (e.type === "replace") {
      const n = count(text, e.find);
      if (n === 1) {
        text = text.replace(e.find, () => e.replace);
        applied++;
      } else if (n === 0 && e.replace !== "" && count(text, e.replace) >= 1) {
        already++;
      } else if (n === 0 && e.replace === "") {
        already++; // a deletion that is already gone
      } else {
        console.log(`NOT APPLIED   ${file}  [${e.note}] found ${n} times: ${JSON.stringify(e.find.slice(0, 70))}`);
        ok = false;
      }
    } else {
      const a = text.indexOf(e.from);
      const b = a < 0 ? -1 : text.indexOf(e.to, a);
      if (a >= 0 && b >= 0) {
        text = text.slice(0, a) + e.replace + text.slice(b);
        applied++;
      } else if (a < 0 && text.includes(e.replace.trim().split("\n")[0])) {
        already++;
      } else {
        console.log(`NOT APPLIED   ${file}  [${e.note}] block markers not found`);
        ok = false;
      }
    }
  }

  if (!ok) {
    failed++;
    console.log(`SKIPPED       ${file}`);
    continue;
  }
  if (applied && !dry) fs.writeFileSync(full, crlf ? text.replace(/\n/g, "\r\n") : text);
  console.log(`${dry ? "would edit " : "edited     "}  ${file}  (${applied} new, ${already} already in place)`);
}

// New files for the 3D design review page (only once the 3D component exists).
const pages = {
  "components/pages/DesignReviewPage.jsx": `"use client";

import dynamic from "next/dynamic";
import PageHead from "@/components/molecules/PageHead";
import PageTemplate from "@/components/templates/PageTemplate";

// three.js runs in the browser only.
const Twin3D = dynamic(() => import("@/components/twin/Twin3D"), {
  ssr: false,
  loading: () => <p className="muted">Loading the 3D model…</p>,
});

/** Interactive 3D design review: design submissions checked against the FIFA requirement families. */
export default function DesignReviewPage() {
  return (
    <PageTemplate label="3D design review" wide>
      {() => (
        <>
          <PageHead
            chip="Design review · King Salman International Stadium"
            title="3D design review"
            lead="Design packages are read, turned into checks against the FIFA requirement families and shown on the stadium model. Open a check to see the requirement, the rule and where it applies."
          />
          <Twin3D />
        </>
      )}
    </PageTemplate>
  );
}
`,
  "app/design-review/page.jsx": `import DesignReviewPage from "@/components/pages/DesignReviewPage";

export const metadata = { title: "3D design review · Venue Compliance Hub" };

export default function Page() {
  return <DesignReviewPage />;
}
`,
};
if (has3d) {
  for (const [rel, body] of Object.entries(pages)) {
    const full = path.join(root, rel);
    if (fs.existsSync(full) && fs.statSync(full).size > 0) {
      console.log(`exists, kept   ${rel}`);
      continue;
    }
    if (!dry) {
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, body);
    }
    console.log(`${dry ? "would add  " : "added      "}  ${rel}`);
  }
} else {
  console.log("\n3D files not found in src/components/twin yet: the /design-review page, its header tab and its tour path are skipped.");
  console.log("When you have them, copy them in and run this script again.");
}

// Wording this script did not touch (files it cannot see, such as tour narration).
const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((x) => (x.isDirectory() ? walk(path.join(d, x.name)) : [path.join(d, x.name)]));
const hits = [];
for (const f of walk(root).filter((f) => /\.(jsx?|mjs|css)$/.test(f))) {
  fs.readFileSync(f, "utf8")
    .split(/\r?\n/)
    .forEach((line, i) => {
      const t = line.trim();
      if (/^(import |\/\/|\/\*|\*)/.test(t)) return;
      // The word on its own (not a property such as city.assurance, not an identifier such as ASSURANCE_FULL).
      if (/(^|[^.\w])[Aa]ssurance\b/.test(t) && /["'`>]/.test(t))
        hits.push(`${path.relative(root, f)}:${i + 1}  ${t.slice(0, 120)}`);
    });
}
console.log(`\n${hits.length} remaining line(s) that mention "assurance" in text or strings (identifiers and comments excluded):`);
hits.forEach((h) => console.log("  " + h));
if (deferred) console.log(`\n${deferred} edit(s) deferred until the 3D files are added.`);
if (failed) {
  console.log(`\n${failed} file(s) had problems. Nothing was written for them.`);
  process.exitCode = 2;
}
