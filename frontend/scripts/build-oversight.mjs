// Builds src/lib/oversight/oversight.generated.json from the CSV files in ../data/oversight.
// The CSVs are the source of truth: edit them and run
//   npm run oversight:build        (or: node scripts/build-oversight.mjs)
// parties.csv        party_id, stadium_id, party, role           who reports on which stadium
// submissions.csv    party_id, cycle, days_vs_due, missing_sections
//                    cycle 0 is the latest report due, 1 the one before, up to 5.
//                    days_vs_due: negative is early, 0 on the day, positive is late; blank means the report was not received.
//                    missing_sections: sections of the report that were left out, separated by ";" (blank means complete).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "../src/lib/register/csv.mjs";
import { CYCLES, ROLE_IDS, roleById } from "../src/lib/oversight/roles.mjs";

process.on("uncaughtException", (error) => {
  console.error(`\noversight: ${error.message}`);
  process.exit(1);
});

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, "..", "..", "data", "oversight");
const outFile = path.resolve(here, "..", "src", "lib", "oversight", "oversight.generated.json");
const stadiumFile = path.resolve(here, "..", "..", "data", "facilities", "register.json");

const read = (name) => {
  const p = path.join(dataDir, name);
  if (!fs.existsSync(p)) throw new Error(`Missing ${path.relative(process.cwd(), p)}`);
  return parseCsv(fs.readFileSync(p, "utf8"));
};
const fail = (file, n, msg) => { throw new Error(`${file} row ${n + 2}: ${msg}`); };

const stadiums = new Set(JSON.parse(fs.readFileSync(stadiumFile, "utf8")).stadiums.map((s) => s.id));

const ids = new Set();
const parties = read("parties.csv").map((r, n) => {
  const f = "parties.csv";
  if (!r.party_id) fail(f, n, "missing party_id");
  if (ids.has(r.party_id)) fail(f, n, `duplicate party_id ${r.party_id}`);
  ids.add(r.party_id);
  if (!stadiums.has(r.stadium_id)) fail(f, n, `unknown stadium ${r.stadium_id}`);
  if (!ROLE_IDS.includes(r.role)) fail(f, n, `role must be one of ${ROLE_IDS.join(", ")}`);
  if (!r.party.trim()) fail(f, n, "missing party name");
  return { id: r.party_id, stadiumId: r.stadium_id, party: r.party.trim(), role: r.role };
});
const roleOf = new Map(parties.map((p) => [p.id, p.role]));

const seen = new Set();
const submissions = read("submissions.csv").map((r, n) => {
  const f = "submissions.csv";
  if (!roleOf.has(r.party_id)) fail(f, n, `unknown party ${r.party_id}`);
  const cycle = Number(r.cycle);
  if (!Number.isInteger(cycle) || cycle < 0 || cycle >= CYCLES) fail(f, n, `cycle must be a whole number from 0 to ${CYCLES - 1}`);
  const key = `${r.party_id}#${cycle}`;
  if (seen.has(key)) fail(f, n, `duplicate row for ${r.party_id} cycle ${cycle}`);
  seen.add(key);
  let days = null;
  if (r.days_vs_due !== "") {
    days = Number(r.days_vs_due);
    if (!Number.isInteger(days)) fail(f, n, `days_vs_due "${r.days_vs_due}" is not a whole number`);
  }
  const missing = r.missing_sections ? r.missing_sections.split(";").map((x) => x.trim()).filter(Boolean) : [];
  const sections = roleById(roleOf.get(r.party_id)).sections;
  for (const m of missing) if (!sections.includes(m)) fail(f, n, `"${m}" is not a section of the ${roleOf.get(r.party_id)} report (${sections.join(", ")})`);
  if (days === null && missing.length) fail(f, n, "a report that was not received cannot have missing sections");
  return [r.party_id, cycle, days, missing];
});
for (const p of parties) for (let k = 0; k < CYCLES; k++) if (!seen.has(`${p.id}#${k}`)) throw new Error(`submissions.csv has no row for ${p.id} cycle ${k}`);

const out = { parties, submissions };
fs.mkdirSync(path.dirname(outFile), { recursive: true });
const text = JSON.stringify(out);
if (!fs.existsSync(outFile) || fs.readFileSync(outFile, "utf8") !== text) fs.writeFileSync(outFile, text);
console.log(`oversight: ${parties.length} parties, ${submissions.length} reports (${new Set(parties.map((p) => p.stadiumId)).size} stadiums)`);
