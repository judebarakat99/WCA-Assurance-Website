// Mapping from programme values to visual tones and colours.

// Pill tone per obligation state (matches the .p-* classes).
export const STATE_TONE = {
  Verified: "good",
  Validated: "info",
  Submitted: "warn",
  Assigned: "mute",
  Rejected: "bad",
};

// Segment colours per obligation state, for rings, bars and legends.
export const STATE_COLOR = {
  Verified: "var(--brand-deep)",
  Validated: "var(--mint)",
  Submitted: "var(--warn)",
  Assigned: "color-mix(in srgb,var(--muted) 30%,var(--sunk))",
  Rejected: "var(--bad)",
};

export const STATE_ORDER = ["Verified", "Validated", "Submitted", "Assigned", "Rejected"];

// One part per state, in display order: { n, c, l } as rings and bars expect.
export function stateParts(list) {
  return STATE_ORDER.map((s) => ({
    n: list.filter((o) => o.state === s).length,
    c: STATE_COLOR[s],
    l: s.toLowerCase(),
  }));
}

// Escalation level colours (Delivery owner → Ministerial steering).
export const LEVEL_COLOR = ["var(--mint)", "var(--warn)", "var(--bad)", "var(--brand-deep)"];

// Tone for an on-time probability.
export function probTone(p) {
  return p >= 0.8 ? "good" : p >= 0.5 ? "warn" : "bad";
}

// Forecast status class ("p-good") to tone ("good").
export function toneOf(cls) {
  return (cls || "").replace(/^p-/, "") || "mute";
}
