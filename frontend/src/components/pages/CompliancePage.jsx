"use client";

import PageHead from "@/components/molecules/PageHead";
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
            lead="The FIFA venue requirements register every stadium is assessed against, chapter by chapter, with each check's criterion, section, status and the sites it applies to; and the stadiums and host cities in the programme."
          />
          {reference}
        </>
      )}
    </PageTemplate>
  );
}
