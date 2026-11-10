import catalogue from "../../data/fifa/catalogue.json" with { type: "json" };

export const FIFA_CATALOGUE = catalogue;

export function fifaRequirementRecords() {
  return catalogue.requirements.map((requirement) => {
    const source = catalogue.sources.find((item) => item.id === requirement.sourceId);
    return {
      ...requirement,
      source,
      sourceUrl: `${source.url}#page=${requirement.pdfPage}`,
      reviewIssues: (requirement.reviewIssueIds || []).map((id) =>
        catalogue.reviewIssues.find((issue) => issue.id === id),
      ),
      evidence: (requirement.evidenceIds || []).map((id) =>
        catalogue.evidenceSpecifications.find((item) => item.id === id),
      ),
    };
  });
}

export function criterionLabel(criterion) {
  const symbols = { min: "≥", max: "≤", eq: "=", gt: ">", gte: "≥", lt: "<", lte: "≤" };
  if (symbols[criterion.operator])
    return `${symbols[criterion.operator]} ${criterion.value} ${criterion.unit}`;
  switch (criterion.operator) {
    case "range":
      return `${criterion.minimum}–${criterion.maximum} ${criterion.unit}`;
    case "design-default":
      return Object.entries(criterion.values).map(([type, value]) => `${type} ${value}`).join(" · ");
    case "adjacency":
      return `Ratio > ${criterion.ratio} · at most ${criterion.maximumFailures} failures`;
    case "measurement-protocol":
      return `${criterion.gridPoints} points · ${criterion.planes.length} planes${criterion.heightM ? ` · ${criterion.heightM} m height` : ""}`;
    case "classification":
    case "recommendation":
      return criterion.value;
    case "manual":
      return criterion.description;
    default:
      throw new Error(`Unsupported catalogue criterion ${criterion.operator}`);
  }
}
