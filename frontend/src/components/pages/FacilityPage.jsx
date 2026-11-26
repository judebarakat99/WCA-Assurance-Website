"use client";

import { useState } from "react";
import StatusPill from "@/components/atoms/StatusPill";
import Breadcrumbs from "@/components/molecules/Breadcrumbs";
import PageHead from "@/components/molecules/PageHead";
import StatTiles from "@/components/molecules/StatTiles";
import FamilyAssessments from "@/components/organisms/FamilyAssessments";
import DesignReviewSection from "@/components/organisms/DesignReviewSection";
import PageTemplate from "@/components/templates/PageTemplate";
import { fmtN, pct } from "@/lib/format";
import { facilitySummary, stadiumRequirements } from "@/lib/domain/assessment.mjs";
import { FACILITY_REGISTER, MATCH_LABEL, STATUS_LABEL } from "@/lib/domain/facilities.mjs";
import { getAssessments } from "@/lib/store/assessments";

function Summary({ summary: s }) {
  return (
    <StatTiles
      columns="eight"
      tiles={[
        { value: s.inScope, label: "requirements in scope" },
        { value: s.applicable, label: "apply now" },
        { value: s.provisional, label: "provisional", tone: "warn" },
        { value: `${pct(s.coverage)}%`, label: "assessed", tone: s.coverage < 0.5 ? "warn" : "good" },
        { value: s.byStatus.unassessed, label: "declared only" },
        {
          value: s.byStatus["evidence-submitted"],
          label: "awaiting review",
          tone: s.byStatus["evidence-submitted"] ? "warn" : "",
        },
        { value: s.byStatus.compliant, label: "compliant", tone: "good" },
        { value: s.byStatus["non-compliant"], label: "non-compliant", tone: s.byStatus["non-compliant"] ? "bad" : "" },
      ]}
    />
  );
}

function Facility({ stadium }) {
  const [showAll, setShowAll] = useState(false);
  const records = getAssessments();
  const rows = stadiumRequirements(stadium);
  const summary = facilitySummary(rows, records);
  const visible = showAll ? rows : rows.filter((r) => r.applicability.value !== "not-applicable");
  return (
    <>
      <Breadcrumbs parent={{ href: "/", label: "Overview" }} label={stadium.name} />
      <PageHead
        title={stadium.name}
        lead={`${fmtN(stadium.grossCapacity)} seats (declared) · ${STATUS_LABEL[stadium.status]}, complete ${stadium.completionYear} · highest match: ${MATCH_LABEL[stadium.highestMatch]}. Each FIFA requirement is assessed for this facility separately; nothing counts as compliant until a reviewer accepts the evidence.`}
        wideLead
      />
      <Summary summary={summary} />
      {stadium.id === "king-salman-international" && <DesignReviewSection />}
      <div className="filters mt">
        <label className="f inline">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show requirements
          that do not apply
        </label>
        <span className="spacer" />
        <StatusPill tone="warn">Provisional</StatusPill>
        <span className="muted small">= 2034 clause still to be confirmed</span>
      </div>
      <FamilyAssessments stadium={stadium} rows={visible} records={records} />
    </>
  );
}

export default function FacilityPage({ facilityId }) {
  const stadium = FACILITY_REGISTER.stadiums.find((s) => s.id === facilityId);
  return (
    <PageTemplate label={stadium ? stadium.name : "Facility"}>
      {() => (stadium ? <Facility stadium={stadium} /> : <p className="muted">Unknown facility.</p>)}
    </PageTemplate>
  );
}
