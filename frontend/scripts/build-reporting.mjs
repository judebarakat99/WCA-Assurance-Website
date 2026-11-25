// Builds src/lib/oversight/reporting.generated.json from the CSV files in ../data/register:
//   reporting-roles.csv  the kinds of party that report, the report each sends, its due day and the sections it must contain
//   reporting.csv        one row per reporting party at each stadium and how its latest report went
// The CSVs are the source of truth; edit them (or replace them with the real reporting log) and run:
//   npm run reporting:build
// It also runs before "npm run dev" and "npm run build".
//
// reporting.csv columns:
//   stadium_id    a stadium in data/facilities/register.json
//   party_id      any unique text; the usual form is "<stadium_id>:<role>"
//   party         the name shown on the Oversight page
//   role          a role in reporting-roles.csv
//   days_vs_due   days after the due date that the latest report arrived (negative = early, 0 = on the day);
//                 empty = not received. A report dated after today counts as not yet received.
//   missing       sections the report did not contain, separated by "|" (empty = complete)
//   history       the three reports before it, oldest first, separated by "|": OT (on time), LT (late), MS (missed)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "../src/lib/register/csv.mjs";

process.on("uncaughtException", (error) => {
  console.error(`\nreporting: ${error.message}`);
  process.exit(1);
});

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, "..", "..", "data", "register");
const registerFile = path.resolve(here, "..", "..", "data", "facilities", "register.json");
const outFile = path.resolve(here, "..", "src", "lib", "oversight", "reporting.generated.json");

const read = (name) => {
  const p = path.join(dataDir, name);
  if (!fs.existsSync(p)) throw new Error(`Missing ${path.relative(process.cwd(), p)}`);
  return parseCsv(fs.readFileSync(p, "utf8"));
};
const fail = (file, n, msg) => { throw new Error(`${file} row ${n + 2}: ${msg}`); };
const list = (v) => String(v || "").split("|").map((x) => x.trim()).filter(Boolean);

const stadiums = new Set(JSON.parse(fs.readFileSync(registerFile, "utf8")).stadiums.map((s) => s.id));

const roles = read("reporting-roles.csv").map((r, n) => {
  const day = Number(r.due_day);
  if (!r.role || !r.label || !r.report) fail("reporting-roles.csv", n, "role, label and report are required");
  if (!Number.isInteger(day) || day < 1 || day > 28) fail("reporting-roles.csv", n, `due_day "${r.due_day}" must be a whole number from 1 to 28`);
  const sections = list(r.sections);
  if (!sections.length) fail("reporting-roles.csv", n, "sections is empty");
  return { id: r.role, label: r.label, report: r.report, dueDay: day, sections };
});
const roleById = new Map(roles.map((r) => [r.id, r]));
if (roleById.size !== roles.length) throw new Error("reporting-roles.csv has a role listed twice");

const seen = new Set();
const parties = read("reporting.csv").map((p, n) => {
  const f = "reporting.csv";
  if (!stadiums.has(p.stadium_id)) fail(f, n, `unknown stadium ${p.stadium_id}`);
  const role = roleById.get(p.role);
  if (!role) fail(f, n, `unknown role ${p.role}`);
  if (!p.party_id || !p.party) fail(f, n, "party_id and party are required");
  if (seen.has(p.party_id)) fail(f, n, `duplicate party_id ${p.party_id}`);
  seen.add(p.party_id);
  let days = null;
  if (p.days_vs_due !== "") {
    days = Number(p.days_vs_due);
    if (!Number.isInteger(days)) fail(f, n, `days_vs_due "${p.days_vs_due}" is not a whole number`);
  }
  const missing = list(p.missing);
  const unknown = missing.filter((m) => !role.sections.includes(m));
  if (unknown.length) fail(f, n, `missing lists "${unknown[0]}", which is not a section of the ${role.label} report`);
  if (days === null && missing.length) fail(f, n, "a report that was not received cannot be missing sections");
  const history = list(p.history);
  if (history.length > 3 || history.some((h) => !["OT", "LT", "MS"].includes(h))) fail(f, n, "history must be up to three of OT, LT, MS separated by |");
  return { stadiumId: p.stadium_id, partyId: p.party_id, party: p.party, role: p.role, daysVsDue: days, missing, history };
});

const out = { roles, parties };
fs.mkdirSync(path.dirname(outFile), { recursive: true });
const text = JSON.stringify(out);
if (!fs.existsSync(outFile) || fs.readFileSync(outFile, "utf8") !== text) fs.writeFileSync(outFile, text);
console.log(`reporting: ${roles.length} roles, ${parties.length} reporting parties (${new Set(parties.map((p) => p.stadiumId)).size} stadiums)`);
