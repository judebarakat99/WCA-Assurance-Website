"use client";

import PageHead from "@/components/molecules/PageHead";
import ChangeImpact from "@/components/organisms/ChangeImpact";
import EvidenceIntake from "@/components/organisms/EvidenceIntake";
import RequirementIntake from "@/components/organisms/RequirementIntake";
import PageTemplate from "@/components/templates/PageTemplate";

function Intake({ S, ui }) {
  return (
    <>
      <PageHead
        chip="Compliance intake · intake PoC"
        title="Compliance intake"
        lead="Requirements enter the system on the right; evidence proving or disproving them enters on the left. Both feed the same live register, so what happens here changes readiness, corrective actions and gates everywhere else."
      />
      <div className="grid req-cols">
        <EvidenceIntake S={S} ui={ui} />
        <RequirementIntake ui={ui} />
      </div>
      <ChangeImpact S={S} ui={ui} />
    </>
  );
}

export default function IntakePage() {
  return <PageTemplate label="Compliance intake">{(p) => <Intake {...p} />}</PageTemplate>;
}
