"use client";

import { currentRequirement } from "@/lib/domain/requirementVersions.mjs";
import { complianceCsv, requirementsCsv } from "@/lib/register/records.mjs";
import { getAssessments } from "@/lib/store/assessments";
import { downloadFile } from "@/lib/ui/download";

// What each button exports. Built when clicked, so it always has the latest evidence and reviews.
const DATASETS = {
  requirements: { file: "requirements.csv", build: requirementsCsv },
  compliance: {
    file: "compliance.csv",
    build: () => complianceCsv(getAssessments(), (id) => currentRequirement(id)?.version ?? 1),
  },
};

/** A link-style button that downloads one of the register's CSV extracts. dataset: "requirements" | "compliance". */
export default function CsvDownload({ dataset, label }) {
  const d = DATASETS[dataset];
  return (
    <button
      type="button"
      className="linkish small"
      onClick={() => downloadFile(d.file, d.build(), "text/csv;charset=utf-8")}
    >
      {label}
    </button>
  );
}
