"use client";

import LegacyCompliance from "@/components/organisms/LegacyCompliance";
import PageTemplate from "@/components/templates/PageTemplate";

/**
 * Compliance: the server-rendered reference sections (FIFA library and
 * facility register, passed in) and the legacy sample dashboard.
 */
export default function CompliancePage({ reference }) {
  return (
    <PageTemplate label="Compliance">{(p) => <LegacyCompliance ui={p.ui} reference={reference} />}</PageTemplate>
  );
}
