"use client";

import { useState } from "react";
import AssessmentTable from "@/components/organisms/AssessmentTable";
import { currentRequirement } from "@/lib/domain/requirementVersions.mjs";
import { pct } from "@/lib/format";
import { FAMILIES } from "@/lib/register/data.mjs";
import { complianceCsv } from "@/lib/register/records.mjs";
import { getAssessments } from "@/lib/store/assessments";

const order = (r) => r.requirement.sectionId.split(".").map(Number);
const bySection = (a, b) =>
  order(a)[0] - order(b)[0] || order(a)[1] - order(b)[1] || a.requirement.id.localeCompare(b.requirement.id);

function tally(rows, records) {
  const t = { inScope: 0, fulfilled: 0, notFulfilled: 0, partial: 0, awaiting: 0, notAssessed: 0 };
  for (const row of rows) {
    if (row.applicability.value === "not-applicable") continue;
    const record = records[row.key];
    t.inScope++;
    if (record?.status === "compliant") t.fulfilled++;
    else if (record?.status === "non-compliant") {
      t.notFulfilled++;
      if (record.partial) t.partial++;
    } else if (record?.status === "evidence-submitted") t.awaiting++;
    else t.notAssessed++;
  }
  return t;
}

/** Downloads the whole compliance register, with everything recorded in the app applied, as CSV. */
function downloadRegister() {
  const csv = complianceCsv(getAssessments(), (id) => currentRequirement(id)?.version ?? 1);
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "compliance.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * One stadium's requirements, grouped by the chapters ("families") of the FIFA stadium book.
 * Each family shows how many requirements are fulfilled, not fulfilled, awaiting review and not yet assessed.
 */
export default function FamilyAssessments({ stadium, rows, records }) {
  const [mode, setMode] = useState(null); // null: leave as is; true: expand all; false: collapse all
  const families = FAMILIES.map((family) => ({
    family,
    rows: rows.filter((r) => r.requirement.familyId === family.id).sort(bySection),
  })).filter((g) => g.rows.length);
  return (
    <section className="fam" aria-labelledby="fam-title">
      <div className="filters mt">
        <h3 id="fam-title" className="m0">
          Requirements by chapter of the FIFA stadium book
        </h3>
        <span className="spacer" />
        <button type="button" className="linkish small" onClick={() => setMode(true)}>
          Expand all
        </button>
        <button type="button" className="linkish small" onClick={() => setMode(false)}>
          Collapse all
        </button>
        <button type="button" className="linkish small" onClick={downloadRegister}>
          Download register (CSV)
        </button>
      </div>
      {families.map(({ family, rows: own }) => {
        const t = tally(own, records);
        return (
          <details key={`${family.id}-${mode}`} className="comp-detail" open={mode === true ? true : undefined}>
            <summary>
              <div>
                <span>
                  {family.id} · {family.name}
                </span>
                <small>
                  {t.inScope} in scope · {t.fulfilled} fulfilled · {t.notFulfilled} not fulfilled
                  {t.partial ? ` (${t.partial} partial)` : ""} · {t.awaiting} awaiting review · {t.notAssessed} not assessed
                </small>
              </div>
              <b>{t.inScope ? `${pct(t.fulfilled / t.inScope)}%` : "–"}</b>
            </summary>
            <div className="comp-detail-body">
              <AssessmentTable
                facilityId={stadium.id}
                title={`Chapter ${family.id}, page ${family.chapterPage} of the book`}
                rows={own}
                records={records}
              />
            </div>
          </details>
        );
      })}
    </section>
  );
}
