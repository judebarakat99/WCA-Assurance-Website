"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo } from "react";
import StatusPill from "@/components/atoms/StatusPill";
import { STATUS } from "@/lib/domain/assessment.mjs";
import { stadiumExposure } from "@/lib/domain/exposure.mjs";
import { criterionLabel } from "@/lib/domain/fifa-catalogue.mjs";
import { getAssessments } from "@/lib/store/assessments";
import { buildDesign } from "@/lib/twin/design.mjs";
import { logSiteCondition, raiseDesignAlerts, recordDesignResults, recordedRows, withdrawSiteCondition } from "@/lib/twin/session";

// three.js runs in the browser only.
const Twin3D = dynamic(() => import("@/components/twin/Twin3D"), {
  ssr: false,
  loading: () => <p className="muted">Loading the 3D model…</p>,
});

const RESULT = {
  pass: ["good", "Meets the requirement"],
  fail: ["bad", "Below the requirement"],
  "needs-review": ["warn", "Needs a reviewer"],
};
const BASIS = { register: "Requirement register", text: "Requirement register", brief: "Design brief" };

/** What the design review has put in the register: one row per requirement it checked. */
function Recorded({ design }) {
  const rows = recordedRows(design);
  if (!rows.length) return null;
  const counts = stadiumExposure(design.stadium, getAssessments()).counts;
  return (
    <div className="dr-card" aria-labelledby="dr-card-title">
      <h3 id="dr-card-title">Design review in the register</h3>
      <p className="muted small m0">
        Each result is recorded as evidence for {design.stadium.name}, so this page, the Overview, the review queue, reports and Nabd show it. A reviewer
        accepts or rejects it in the review queue; nothing counts as compliant until then.
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Requirement</th>
              <th scope="col">Recorded</th>
              <th scope="col">Result</th>
              <th scope="col">In the register</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ check, requirement, record, latest, unit }) => {
              const [tone, label] = RESULT[latest.check] || RESULT["needs-review"];
              return (
                <tr key={check.id}>
                  <td>
                    <span className="mono">{requirement.id}</span> {requirement.title}
                    <small>
                      {check.fam} · threshold from {BASIS[check.basis]}
                    </small>
                  </td>
                  <td>
                    <span className="mono">{latest.value === "" || latest.value == null ? "–" : Number(latest.value).toLocaleString("en-US")}</span>
                    {unit && latest.value !== "" ? ` ${unit}` : ""}
                    <small>{latest.file}</small>
                  </td>
                  <td>
                    <StatusPill tone={tone}>{label}</StatusPill>
                    <small>
                      Required:{" "}
                      {requirement.criterion.operator === "manual" ? design.criterionText(check.id) || "see the requirement" : criterionLabel(requirement.criterion)}
                    </small>
                  </td>
                  <td>
                    {record.partial ? "Partially compliant" : STATUS[record.status] || record.status}
                    <small>{design.exposureLine(check.id).split(" · ")[0] || ""}</small>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="m0 small">
        Mitigation exposure for this stadium now: <b>{counts.critical}</b> critical · <b>{counts.material}</b> material · <b>{counts.manageable}</b> manageable.{" "}
        <Link className="btnlink" href="/review">
          Open the review queue →
        </Link>
      </p>
    </div>
  );
}

/** 3D design review for one stadium: design packages checked against the requirement register, and its critical areas. */
export default function DesignReviewSection() {
  const design = useMemo(() => buildDesign({ getRecords: getAssessments }), []);
  return (
    <section aria-labelledby="design-review-title" style={{ marginTop: 24 }}>
      <h2 id="design-review-title">3D design review</h2>
      <p className="muted">
        Design packages are read, turned into checks against the requirement register and shown on the stadium model. Open a check to see the requirement,
        the rule, where its threshold comes from and where it applies. The Critical areas tab shows the exposure of each part of the stadium on the model.
      </p>
      <Twin3D
        design={design}
        onResults={(rev) => recordDesignResults(design, rev)}
        onSend={() => raiseDesignAlerts(design)}
        onSite={(id, action) => (action === "withdraw" ? withdrawSiteCondition(id) : logSiteCondition(design, id))}
      />
      <Recorded design={design} />
    </section>
  );
}
