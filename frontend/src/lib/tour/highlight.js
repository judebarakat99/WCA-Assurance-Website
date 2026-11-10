// Highlights the current tour step's target element (tour.sel).
import { tour } from "@/lib/store/state";

// Pages render after navigation, so a step's target may not exist yet.
// Watch the DOM briefly and highlight it as soon as it appears.
let targetWatch = null;
function waitForTarget(sel, scroll) {
  if (targetWatch) targetWatch.disconnect();
  const obs = new MutationObserver(() => {
    if (tour.sel !== sel || !tour.active) return stop();
    if (document.querySelector(sel)) {
      stop();
      applyHL(scroll);
    }
  });
  const timer = setTimeout(stop, 3000);
  function stop() {
    obs.disconnect();
    clearTimeout(timer);
    if (targetWatch === obs) targetWatch = null;
  }
  targetWatch = obs;
  obs.observe(document.body, { childList: true, subtree: true });
}

/** Move the highlight to the current target; optionally scroll it into view. */
export function applyHL(scroll) {
  document.querySelectorAll(".tour-hl").forEach((e) => e.classList.remove("tour-hl"));
  if (!tour.active || !tour.sel) return;
  const el = document.querySelector(tour.sel);
  if (!el) {
    waitForTarget(tour.sel, scroll);
    return;
  }
  el.classList.add("tour-hl");
  if (!scroll) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  try {
    el.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
  } catch {
    el.scrollIntoView();
  }
}
