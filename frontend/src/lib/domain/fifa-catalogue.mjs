// The FIFA 2034 venue requirements register: 181 checks in 11 chapters,
// transcribed from the supplied register (see data/fifa/README.md).
import catalogue from "../../../../data/fifa/catalogue.json" with { type: "json" };

export const FIFA_CATALOGUE = catalogue;

/** Chapters of the stadium book, in order: { id: "01", number, name, short, summary, bookPage, checks, stadiumChecks }. */
export const CHAPTERS = catalogue.chapters;
export const chapterOf = (requirement) => CHAPTERS.find((c) => c.id === requirement.chapter) || null;

/** Requirement records with their chapter, for the library. */
export function fifaRequirementRecords() {
  return catalogue.requirements.map((requirement) => ({ ...requirement, chapterInfo: chapterOf(requirement) }));
}

/**
 * The requirement as it applies to one stadium: a criterion with thresholds by
 * match category (STA-0004) is resolved to the stadium's highest match.
 */
export function resolveForStadium(requirement, stadium) {
  const tiers = requirement?.criterion?.tiers;
  if (!tiers) return requirement;
  const { tiers: _all, ...criterion } = requirement.criterion;
  return { ...requirement, criterion: { ...criterion, value: tiers[stadium.highestMatch] ?? criterion.value } };
}

const num = (v) => (typeof v === "number" && Math.abs(v) >= 1000 ? v.toLocaleString("en-US") : String(v));

export function criterionLabel(criterion) {
  const symbols = { min: "≥", max: "≤", eq: "=", gt: ">", gte: "≥", lt: "<", lte: "≤" };
  if (criterion.tiers)
    return `≥ ${[criterion.value, ...Object.values(criterion.tiers)].map(num).join(" / ")} ${criterion.unit} by match category`;
  if (symbols[criterion.operator]) return `${symbols[criterion.operator]} ${num(criterion.value)} ${criterion.unit}`;
  switch (criterion.operator) {
    case "range":
      return `${criterion.minimum}–${criterion.maximum} ${criterion.unit}`;
    case "manual":
      return criterion.description;
    default:
      throw new Error(`Unsupported catalogue criterion ${criterion.operator}`);
  }
}
