// Builds src/lib/register/register.generated.json from the CSV files in ../data/register.
// The CSVs are the source of truth; edit them (or replace compliance.csv with an export) and run:
//   npm run register:build
// It also runs before "npm run dev" and "npm run build".
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "../src/lib/register/csv.mjs";

process.on("uncaughtException", (error) => {
  console.error(`\nregister: ${error.message}`);
  process.exit(1);
});

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, "..", "..", "data", "register");
const outFile = path.resolve(here, "..", "src", "lib", "register", "register.generated.json");

const STATUSES = ["Not assessed", "Evidence submitted", "Compliant", "Partially compliant", "Non-compliant", "Not applicable"];
const CHECKS = ["", "pass", "fail", "needs-review"];
const OPERATORS = ["manual", "min", "max", "eq", "gt", "gte", "lt", "lte", "range"];
const APPLIES = ["stadium", "training-site", "fan-festival", "ibc"];

const read = (name) => {
  const p = path.join(dataDir, name);
  if (!fs.existsSync(p)) throw new Error(`Missing ${path.relative(process.cwd(), p)}`);
  return parseCsv(fs.readFileSync(p, "utf8"));
};
const fail = (file, n, msg) => { throw new Error(`${file} row ${n + 2}: ${msg}`); };
const num = (file, n, label, v) => {
  if (v === "") return null;
  const x = Number(String(v).replace(/,/g, ""));
  if (!Number.isFinite(x)) fail(file, n, `${label} "${v}" is not a number`);
  return x;
};

const families = read("families.csv").map((f) => ({
  id: f.id, name: f.name, short: f.short, chapterPage: Number(f.chapter_page),
  description: f.description, defaultOwner: f.default_owner, inScope: f.in_scope === "yes",
}));
const familyIds = new Set(families.map((f) => f.id));

const sections = read("sections.csv").map((s, n) => {
  if (!familyIds.has(s.family_id)) fail("sections.csv", n, `unknown family ${s.family_id}`);
  return { id: s.id, familyId: s.family_id, title: s.title, page: Number(s.page) };
});
const sectionIds = new Set(sections.map((s) => s.id));

const sources = read("sources.csv").map((s) => ({
  id: s.id, title: s.title, publisher: s.publisher, url: s.url || null, edition: s.edition, kind: s.kind,
}));
const sourceIds = new Set(sources.map((s) => s.id));

const seen = new Set();
const requirements = read("requirements.csv").map((r, n) => {
  const f = "requirements.csv";
  if (!r.id) fail(f, n, "missing id");
  if (seen.has(r.id)) fail(f, n, `duplicate id ${r.id}`);
  seen.add(r.id);
  if (!familyIds.has(r.family_id)) fail(f, n, `unknown family ${r.family_id}`);
  if (!sectionIds.has(r.section)) fail(f, n, `unknown section ${r.section}`);
  if (!sourceIds.has(r.source_id)) fail(f, n, `unknown source ${r.source_id}`);
  if (!APPLIES.includes(r.applies_to)) fail(f, n, `applies_to must be one of ${APPLIES.join(", ")}`);
  if (!OPERATORS.includes(r.operator)) fail(f, n, `operator must be one of ${OPERATORS.join(", ")}`);
  const criterion = { operator: r.operator };
  if (r.operator === "manual") criterion.description = r.description || r.check_item;
  else if (r.operator === "range") {
    criterion.minimum = num(f, n, "minimum", r.minimum);
    criterion.maximum = num(f, n, "maximum", r.maximum);
    criterion.unit = r.unit;
    if (criterion.minimum == null || criterion.maximum == null) fail(f, n, "range needs minimum and maximum");
  } else {
    criterion.value = num(f, n, "value", r.value);
    criterion.unit = r.unit;
    if (criterion.value == null) fail(f, n, `${r.operator} needs a value`);
  }
  return {
    id: r.id, familyId: r.family_id, section: r.section, workstream: r.workstream, title: r.check_item,
    note: r.criterion_note, sourceClass: r.source_class, sourceId: r.source_id, sourceUrl: r.source_url || null,
    clause2034: r.clause_2034, evidenceRequested: r.evidence_requested, appliesTo: r.applies_to,
    applicability: r.applicability === "applicable" ? "applicable" : "provisional",
    criterion, pdfPage: Number(r.pdf_page),
  };
});
const reqById = new Map(requirements.map((r) => [r.id, r]));

const pairs = new Set();
const compliance = read("compliance.csv").map((c, n) => {
  const f = "compliance.csv";
  const req = reqById.get(c.id);
  if (!req) fail(f, n, `unknown requirement ${c.id}`);
  if (req.appliesTo !== "stadium") fail(f, n, `${c.id} does not apply to stadiums`);
  if (!c.stadium_id) fail(f, n, "missing stadium_id");
  const key = `${c.stadium_id}::${c.id}`;
  if (pairs.has(key)) fail(f, n, `duplicate row for ${key}`);
  pairs.add(key);
  if (!STATUSES.includes(c.status)) fail(f, n, `status "${c.status}" is not one of ${STATUSES.join(", ")}`);
  if (!CHECKS.includes(c.check)) fail(f, n, `check "${c.check}" is not one of pass, fail, needs-review or blank`);
  if (c.value !== "") num(f, n, "value", c.value);
  return [c.stadium_id, c.id, c.status, c.value, c.unit, c.check, c.evidence_file, c.evidence_on, c.reviewed_by, c.owner, c.comments, c.updated_on];
});

const generatedOn = compliance.reduce((m, r) => (r[11] > m ? r[11] : m), "") || "2026-01-01";
const out = { generatedOn, families, sections, sources, requirements, compliance };
fs.mkdirSync(path.dirname(outFile), { recursive: true });
const text = JSON.stringify(out);
if (!fs.existsSync(outFile) || fs.readFileSync(outFile, "utf8") !== text) fs.writeFileSync(outFile, text);
const stadiums = new Set(compliance.map((r) => r[0])).size;
console.log(`register: ${families.length} families, ${requirements.length} requirements, ${compliance.length} stadium rows (${stadiums} stadiums)`);
