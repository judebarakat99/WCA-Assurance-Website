"use client";

import PageHead from "@/components/molecules/PageHead";
import RequirementTabs from "@/components/organisms/RequirementTabs";
import PageTemplate from "@/components/templates/PageTemplate";

/**
 * Requirements: the FIFA source library and the facility register. Both are
 * server-rendered and passed in as `reference`.
 */
export default function CompliancePage({ reference }) {
  return (
    <PageTemplate label="Requirements">
      {() => (
        <>
          <PageHead
            chip="Requirements · FIFA sources and host facilities"
            title="Requirements"
            wideLead
            lead="The FIFA criteria every stadium is assessed against, each with its source document, section and version, and the stadiums and host cities they apply to."
          />
          <RequirementTabs reference={reference} />
        </>
      )}
    </PageTemplate>
  );
}
