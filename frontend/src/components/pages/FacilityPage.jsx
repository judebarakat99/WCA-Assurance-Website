"use client";

import { useState } from "react";
import StatusPill from "@/components/atoms/StatusPill";
import Breadcrumbs from "@/components/molecules/Breadcrumbs";
import PageHead from "@/components/molecules/PageHead";
import AssessmentTable from "@/components/organisms/AssessmentTable";
import ProgressClaim from "@/components/organisms/ProgressClaim";
import StadiumModel, { MODEL_STADIUM } from "@/components/organisms/StadiumModel";
import PageTemplate from "@/components/templates/PageTemplate";
import { fmtN, pct } from "@/lib/format";
import { facilitySummary, stadiumRequirements } from "@/lib/domain/assessment.mjs";
import { FACILITY_REGISTER, MATCH_LABEL, STATUS_LABEL } from "@/lib/domain/facilities.mjs";
import { CHAPTERS } from "@/lib/domain/fifa-catalogue.mjs";
import { getAssessments } from "@/lib/store/assessments";

const CATEGORY_ORDER = CHAPTERS.map((c) => c.name);

function Summary({ summary: s }) {
  const tiles = [
    [s.inScope, "requirements in scope", ""],
    [s.applicable, "apply now", ""],
    [s.provisional, "provisional", "warn"],
    [`${pct(s.coverage)}%`, "assessed", s.coverage < 0.5 ? "warn" : "good"],
    [s.byStatus.declared, "declared only", ""],
    [s.byStatus["evidence-submitted"], "awaiting review", s.byStatus["evidence-submitted"] ? "warn" : ""],
    [s.byStatus.compliant, "compliant", "good"],
    [s.byStatus["non-compliant"], "non-compliant", s.byStatus["non-compliant"] ? "bad" : ""],
  ];
  return (
    <div className="mini-grid four">
      {tiles.map(([n, label, tone]) => (
        <div key={label} className={`mini ${tone}`.trim()}>
          <b>{n}</b>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

function Facility({ stadium }) {
  const [showAll, setShowAll] = useState(false);
  const city = FACILITY_REGISTER.hostCities.find((c) => c.id === stadium.cityId);
  const records = getAssessments();
  const rows = stadiumRequirements(stadium);
  const summary = facilitySummary(rows, records);
  const visible = showAll ? rows : rows.filter((r) => r.applicability.value !== "not-applicable");
  const categories = CATEGORY_ORDER.filter((c) => visible.some((r) => r.requirement.category === c));
  return (
    <>
      <Breadcrumbs parent={{ href: "/compliance", label: "Requirements" }} label={stadium.name} />
      <PageHead
        chip={`Facility assessment · ${city.name} · Stadium`}
        title={stadium.name}
        lead={`${fmtN(stadium.grossCapacity)} seats (declared) · ${STATUS_LABEL[stadium.status]}, complete ${stadium.completionYear} · highest match: ${MATCH_LABEL[stadium.highestMatch]}. Each FIFA requirement is assessed for this facility separately; nothing counts as compliant until a reviewer accepts the evidence.`}
      />
      <Summary summary={summary} />
      <ProgressClaim stadiumId={stadium.id} />
      {stadium.id === MODEL_STADIUM && <StadiumModel stadium={stadium} records={records} />}
      <div className="filters mt">
        <label className="f inline">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show requirements
          that do not apply
        </label>
        <span className="spacer" />
        <StatusPill tone="warn">Provisional</StatusPill>
        <span className="muted small">= working target, threshold to be confirmed against the 2034 clause</span>
      </div>
      {categories.map((c) => (
        <AssessmentTable
          key={c}
          facilityId={stadium.id}
          title={`${CHAPTERS.find((x) => x.name === c).id} ${c}`}
          rows={visible.filter((r) => r.requirement.category === c)}
          records={records}
        />
      ))}
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
