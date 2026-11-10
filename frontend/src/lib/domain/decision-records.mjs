// Keep decisions recorded by previous demo versions without replaying effects.
export function normalizeDecisionRecords(records, definitions) {
  const existing = Array.isArray(records) ? records : [];
  return definitions.map((definition) => {
    const record = existing.find((item) => item?.id === definition.id);
    if (!record) return { id: definition.id, status: "Open" };
    const normalized = { ...record };
    if (normalized.status === "Decided") normalized.status = "Taken";
    const choice = record.choice;
    const index =
      typeof choice === "number" ||
      (typeof choice === "string" && /^\d+$/.test(choice))
        ? Number(choice)
        : -1;
    if (Number.isInteger(index) && definition.options[index])
      normalized.choice = index;
    else if (typeof record.option === "string") {
      const matched = definition.options.findIndex(
        (option) => option.t === record.option,
      );
      if (matched >= 0) normalized.choice = matched;
      else delete normalized.choice;
    } else delete normalized.choice;
    return normalized;
  });
}
export function decisionOptionLabel(definition, record) {
  return (
    definition.options[record.choice]?.t ||
    (typeof record.option === "string" && record.option) ||
    "Recorded option unavailable"
  );
}
export function hasDecisionForecast(record) {
  return (
    typeof record.before === "string" &&
    typeof record.after === "string" &&
    [
      record.beforeProb,
      record.afterProb,
      record.beforeLate,
      record.afterLate,
    ].every(Number.isFinite)
  );
}
