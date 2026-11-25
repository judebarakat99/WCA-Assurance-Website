// The requirement catalogue, built from the compliance register (data/register/*.csv): 181 checks from the
// FIFA 2034 infrastructure checklist, grouped into the chapters ("families") of the FIFA stadium book.
// The shape matches what the rest of the app reads: category is the family name.
import { FAMILIES, REGISTER_DATE, REQUIREMENTS, SECTIONS, SOURCES, familyById, sectionById } from "@/lib/register/data.mjs";

const ASSET = { stadium: "Stadium", "training-site": "Training site", "fan-festival": "Fan festival", ibc: "IBC" };
const GENERIC = "Confirm the applicable 2034 contract clause and technical threshold before treating this item as mandatory.";

const requirements = REQUIREMENTS.map((r) => {
  const family = familyById(r.familyId);
  const section = sectionById(r.section);
  return {
    id: r.id,
    version: 1,
    sourceId: r.sourceId,
    title: r.title,
    summary: r.note,
    generic: r.note === GENERIC,
    assetType: ASSET[r.appliesTo],
    appliesTo: [r.appliesTo],
    condition: r.workstream,
    workstream: r.workstream,
    category: family.name,
    categoryBasis: "Table of contents of the FIFA stadium book",
    familyId: r.familyId,
    familyShort: family.short,
    sectionId: r.section,
    section: `${r.section} ${section.title}`,
    topic: section.title,
    printedPage: r.pdfPage,
    pdfPage: r.pdfPage,
    criterion: r.criterion,
    sourceCheck: "register",
    applicabilityReview: "pending",
    applicability: r.applicability,
    suggestedEvidence: r.evidenceRequested,
    evidenceBasis: "FIFA 2034 infrastructure checklist",
    authority: "FIFA published guidance",
    sourceClass: r.sourceClass,
    sourceUrl: r.sourceUrl,
    clause2034: r.clause2034,
    reviewIssueIds: [],
  };
});

export const FIFA_CATALOGUE = {
  schemaVersion: 3,
  reviewedOn: REGISTER_DATE,
  scopeNote:
    "The FIFA 2034 infrastructure checklist, grouped by the chapters of the FIFA stadium book. The 2034 contract clause is still to be confirmed for most checks; a few carry a threshold from the book.",
  families: FAMILIES,
  sections: SECTIONS,
  sources: SOURCES,
  requirements,
  evidenceSpecifications: [],
  reviewIssues: [],
};

/** Every requirement with its source, for the requirements library. */
export function fifaRequirementRecords() {
  return requirements.map((r) => ({
    ...r,
    source: SOURCES.find((s) => s.id === r.sourceId),
    reviewIssues: [],
    evidence: [],
  }));
}

const fmt = (n) => Number(n).toLocaleString("en-US");
const SYMBOL = { min: "≥", max: "≤", eq: "=", gt: ">", gte: "≥", lt: "<", lte: "≤" };

/** A criterion as short text, for example "≥ 4.5 m". */
export function criterionLabel(criterion) {
  if (SYMBOL[criterion.operator]) return `${SYMBOL[criterion.operator]} ${fmt(criterion.value)} ${criterion.unit}`.trim();
  switch (criterion.operator) {
    case "range":
      return `${fmt(criterion.minimum)}–${fmt(criterion.maximum)} ${criterion.unit}`.trim();
    case "manual":
      return criterion.description;
    default:
      throw new Error(`Unsupported catalogue criterion ${criterion.operator}`);
  }
}
