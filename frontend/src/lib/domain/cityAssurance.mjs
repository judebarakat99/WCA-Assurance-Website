// Assurance roll-up for the map: stadium → city → country, optionally for one
// requirement category ("pillar"). Assured = reviewer-accepted compliant out of
// requirements in scope; coverage = anything assessed beyond unassessed.
import { STATUS, stadiumRequirements } from "@/lib/domain/assessment.mjs";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";

const EMPTY = () => ({ inScope: 0, ...Object.fromEntries(Object.keys(STATUS).map((s) => [s, 0])) });

function add(total, part) {
  for (const k of Object.keys(total)) total[k] += part[k];
  return total;
}

function finish(t) {
  const assessed = t.inScope - t.unassessed;
  return {
    ...t,
    assessed,
    assured: t.inScope ? t.compliant / t.inScope : 0,
    coverage: t.inScope ? assessed / t.inScope : 0,
    needsAttention: t["evidence-submitted"] + t["non-compliant"],
  };
}

/** Status counts for one stadium (category: null for every pillar). */
export function stadiumAssurance(stadium, records, category = null) {
  const t = EMPTY();
  for (const row of stadiumRequirements(stadium)) {
    if (row.applicability.value === "not-applicable") continue;
    if (category && row.requirement.category !== category) continue;
    t.inScope++;
    t[records[row.key]?.status || "unassessed"]++;
  }
  return finish(t);
}

/** Tone for an assured share; nothing reviewed yet (only declared or submitted) reads as "mute". */
export function assuranceTone(a) {
  if (!a.compliant && !a["non-compliant"]) return "mute";
  if (a["non-compliant"] > 0 && a.assured < 0.6) return "bad";
  return a.assured >= 0.85 ? "good" : a.assured >= 0.5 ? "warn" : "bad";
}

/** Cities with their stadiums' roll-ups, plus a programme total. */
export function assuranceMap(records, category = null) {
  const cities = FACILITY_REGISTER.hostCities.map((city) => {
    const stadiums = FACILITY_REGISTER.stadiums
      .filter((s) => s.cityId === city.id)
      .map((s) => ({ ...s, assurance: stadiumAssurance(s, records, category) }))
      .sort((a, b) => a.assurance.assured - b.assurance.assured);
    const total = finish(stadiums.reduce((t, s) => add(t, s.assurance), EMPTY()));
    return { ...city, stadiums, assurance: total, tone: assuranceTone(total) };
  });
  const programme = finish(cities.reduce((t, c) => add(t, c.assurance), EMPTY()));
  return { cities, programme, tone: assuranceTone(programme) };
}

/** Categories present in the catalogue for stadiums, in display order. */
export const PILLARS = [
  { id: null, label: "All requirements" },
  { id: "Capacity", label: "Capacity" },
  { id: "Pitch", label: "Pitch" },
  { id: "Lighting", label: "Lighting" },
];

/** Dimensions the catalogue does not cover yet (shown disabled). */
export const UPCOMING_PILLARS = ["Safety & security", "Sustainability", "Human rights", "Media & broadcast"];
