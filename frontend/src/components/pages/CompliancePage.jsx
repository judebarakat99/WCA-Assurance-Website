"use client";

import LegacyCompliance from "@/components/organisms/LegacyCompliance";
import PageTemplate from "@/components/templates/PageTemplate";

/** Compliance: the sourced FIFA library (server-rendered, passed in) and the legacy sample dashboard. */
export default function CompliancePage({ library }) {
  return (
    <PageTemplate label="Compliance">{(p) => <LegacyCompliance ui={p.ui} library={library} />}</PageTemplate>
  );
}
