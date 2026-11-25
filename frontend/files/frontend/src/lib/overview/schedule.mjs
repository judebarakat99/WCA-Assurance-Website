// Forecast slip of each stadium's next gate, in days. The base figures are in data/overview/schedule.json; a delay that has
// been logged on the 3D view's Critical areas tab (lib/domain/siteConditions) adds its days to the stadium it was logged for,
// so logging "the north upper tier steel is nine weeks late" moves King Salman International Stadium to "+63 days" here.
import seed from "../../../../data/overview/schedule.json" with { type: "json" };
import { SITE_CONDITIONS, isLogged } from "@/lib/domain/siteConditions.mjs";

/** Days each logged delay adds to its stadium's forecast. These are assumptions for the demonstration. */
export const CONDITION_SLIP = { "SC-01": 63, "SC-03": 90 };

/** The forecast slip of a stadium's next gate in days: its base figure plus any logged delays. 0 when none. */
export function slipDays(stadiumId) {
  let days = Number(seed.slipDays?.[stadiumId]) || 0;
  for (const c of SITE_CONDITIONS) if (c.stadiumId === stadiumId && c.kind === "delay" && isLogged(c.id)) days += CONDITION_SLIP[c.id] || 0;
  return days;
}
