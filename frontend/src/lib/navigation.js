// In-app navigation that also sets the shared UI state a destination reads.
// goView() goes through the app runtime to the Next router.
import { ui, goView } from "@/lib/store/state";

const ALL_FILTERS = { venue: "all", family: "all", state: "all", q: "" };

/** Obligation register, optionally filtered to one venue. */
export function openRegister(venueId) {
  ui.filters = { ...ALL_FILTERS, venue: venueId || "all" };
  goView("register");
}

/** Readiness gates, scrolled to a venue's card when given. */
export function openGates(venueId) {
  ui.filters = { ...ALL_FILTERS, venue: venueId || "all" };
  goView("gates");
  if (venueId) scrollToWhenReady(`gate-${venueId}`);
}

/** FIFA inspection dossier for one venue. */
export function openDossier(venueId) {
  ui.dossierVenue = venueId;
  goView("dossier");
}

/** Venue detail page. */
export function openVenue(venueId) {
  goView(`venue-${venueId}`);
}

// The destination renders after navigation; retry for a short while.
export function scrollToWhenReady(id, tries = 20) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ block: "start" });
  else if (tries > 0) setTimeout(() => scrollToWhenReady(id, tries - 1), 50);
}
