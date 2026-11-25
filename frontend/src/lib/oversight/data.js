// Reads the seed, the stadium register and the Evidence page's filed documents, and returns the Oversight status.
// A progress report filed on the Evidence page counts as the main contractor's report for that stadium, so filing one
// changes this page, the executive report and every number that reads them.
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";
import seed from "@/lib/oversight/reporting.generated.json";
import { buildOversight } from "@/lib/oversight/status.mjs";
import { filedDocuments, intake } from "@/lib/store/intake";

const cities = Object.fromEntries(FACILITY_REGISTER.hostCities.map((c) => [c.id, c.name]));
const stadiums = FACILITY_REGISTER.stadiums.map((s) => ({ id: s.id, name: s.name, cityId: s.cityId, city: cities[s.cityId] || "" }));

/** The date a document was filed, from its filing time (local calendar day), or its own date. */
function filedOn(doc) {
  const text = String(doc.filed_at || doc.as_of || "");
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** The main contractor's report for each stadium that has a progress report on file: when it came in and what it lacked. */
export function liveReports() {
  const filed = filedDocuments().filter((d) => !d.superseded);
  const out = {};
  for (const d of filed.filter((x) => x.kind === "progress-report" && x.stadium_id)) {
    const on = filedOn(d);
    if (!on) continue;
    const plans = filed.filter((x) => x.kind === "detailed-plan" && x.stadium_id === d.stadium_id);
    const check = intake.checks?.[d.stadium_id];
    const gap = !plans.length || (check?.packages || []).some((p) => p.status === "evidence-missing");
    const prev = out[d.stadium_id];
    if (!prev || on > prev.filedOn) out[d.stadium_id] = { filedOn: on, missing: gap ? ["Detailed plans"] : [] };
  }
  return out;
}

/** The oversight status for today (the system date) and what is filed now. */
export function loadOversight(today = new Date()) {
  return buildOversight(seed, stadiums, today, liveReports());
}
