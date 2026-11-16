// Number formatting shared by the assurance screens.

/** Fraction (0–1) to a whole percentage. */
export const pct = (x) => Math.round(x * 100);

/** Numbers with thousands separators and at most two decimals; other values unchanged. */
export const fmtN = (n) => (typeof n === "number" ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : n);
