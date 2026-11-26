"use client";

import CollapsibleList from "@/components/molecules/CollapsibleList";
import CsvDownload from "@/components/molecules/CsvDownload";
import AssessmentTable from "@/components/organisms/AssessmentTable";
import { pct } from "@/lib/format";
import { FAMILIES } from "@/lib/register/data.mjs";

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

/**
 * One stadium's requirements, grouped by the chapters ("families") of the FIFA stadium book.
 * Each family shows how many requirements are fulfilled, not fulfilled, awaiting review and not yet assessed.
 */
export default function FamilyAssessments({ stadium, rows, records }) {
  const items = FAMILIES.map((family) => ({
    family,
    rows: rows.filter((r) => r.requirement.familyId === family.id).sort(bySection),
  }))
    .filter((g) => g.rows.length)
    .map(({ family, rows: own }) => {
      const t = tally(own, records);
      return {
        id: family.id,
        summary: (
          <>
            <div>
              <span>
                {family.id} · {family.name}
              </span>
              <small>
                {t.inScope} in scope · {t.fulfilled} fulfilled · {t.notFulfilled} not fulfilled
                {t.partial ? ` (${t.partial} partial)` : ""} · {t.awaiting} awaiting review · {t.notAssessed} not
                assessed
              </small>
            </div>
            <b>{t.inScope ? `${pct(t.fulfilled / t.inScope)}%` : "–"}</b>
          </>
        ),
        body: (
          <AssessmentTable
            facilityId={stadium.id}
            title={`Chapter ${family.id}, page ${family.chapterPage} of the book`}
            rows={own}
            records={records}
          />
        ),
      };
    });
  return (
    <section className="fam" aria-labelledby="fam-title">
      <CollapsibleList
        heading={
          <h3 id="fam-title" className="m0">
            Requirements by chapter of the FIFA stadium book
          </h3>
        }
        actions={<CsvDownload dataset="compliance" label="Download register (CSV)" />}
        items={items}
      />
    </section>
  );
}
