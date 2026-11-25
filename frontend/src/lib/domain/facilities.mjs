// Facility register: the programme's stadiums, host cities and other assets,
// as declared in the bid. Links each stadium to the FIFA capacity requirement
// that applies to its highest match, and checks the declared capacity
// against it. A declared check is not an assessment: evidence is still pending.
import register from "../../../../data/facilities/register.json" with { type: "json" };
import { resolveForStadium } from "@/lib/domain/fifa-catalogue.mjs";
import { currentRequirement } from "@/lib/domain/requirementVersions.mjs";

export const FACILITY_REGISTER = register;

export const MATCH_LABEL = {
  "opening-final": "Opening and final",
  "semi-final": "Semi-final",
  "third-place": "Third-place play-off",
  "quarter-final": "Quarter-final",
  "round-of-16": "Round of 16",
  "round-of-32": "Round of 32",
};

export const STATUS_LABEL = {
  "existing-refurbishment": "Existing · refurbishment",
  "under-construction": "Under construction",
  planned: "Planned",
};

// Capacity (STA-0004) has a threshold per match category; the stadium's highest
// match selects it (40,000 up to the quarter-final, 60,000 semi-final, 80,000
// opening match and final).
const CAPACITY_ID = "STA-0004";

const requirementById = (id) => currentRequirement(id);
const cityById = (id) => register.hostCities.find((c) => c.id === id);

/** The capacity requirement as it applies to a stadium, with the threshold for its highest match. */
export function capacityRequirement(stadium) {
  const requirement = requirementById(CAPACITY_ID);
  return requirement ? resolveForStadium(requirement, stadium) : null;
}

/**
 * Declared capacity against the applicable minimum.
 * status "declared-meets" | "declared-short"; evidence is always pending.
 */
export function declaredCapacityCheck(stadium) {
  const requirement = capacityRequirement(stadium);
  if (!requirement) return null;
  const minimum = requirement.criterion.value;
  return {
    requirement,
    minimum,
    declared: stadium.grossCapacity,
    margin: stadium.grossCapacity - minimum,
    status: stadium.grossCapacity >= minimum ? "declared-meets" : "declared-short",
    evidence: "pending",
  };
}

/** Stadiums with their city and capacity check, ordered by city then capacity. */
export function stadiumRecords() {
  const cityOrder = register.hostCities.map((c) => c.id);
  return register.stadiums
    .map((s) => ({ ...s, city: cityById(s.cityId), capacity: declaredCapacityCheck(s) }))
    .sort((a, b) => cityOrder.indexOf(a.cityId) - cityOrder.indexOf(b.cityId) || b.grossCapacity - a.grossCapacity);
}

/** Per-city totals: stadiums, seats and declared capacity results. */
export function cityRecords() {
  const stadiums = stadiumRecords();
  return register.hostCities.map((city) => {
    const own = stadiums.filter((s) => s.cityId === city.id);
    return {
      ...city,
      stadiums: own,
      seats: own.reduce((a, s) => a + s.grossCapacity, 0),
      declaredMeets: own.filter((s) => s.capacity?.status === "declared-meets").length,
    };
  });
}

/** Programme totals for the register summary. */
export function registerSummary() {
  const stadiums = stadiumRecords();
  const byStatus = Object.fromEntries(
    Object.keys(STATUS_LABEL).map((k) => [k, stadiums.filter((s) => s.status === k).length]),
  );
  return {
    cities: register.hostCities.length,
    stadiums: stadiums.length,
    seats: stadiums.reduce((a, s) => a + s.grossCapacity, 0),
    roomKeys: register.hostCities.reduce((a, c) => a + c.roomKeys, 0),
    byStatus,
    declaredMeets: stadiums.filter((s) => s.capacity?.status === "declared-meets").length,
    lastCompletion: Math.max(...stadiums.map((s) => s.completionYear)),
    otherAssets: register.otherAssets,
  };
}

export const registerSource = (id) => register.sources.find((s) => s.id === id);
