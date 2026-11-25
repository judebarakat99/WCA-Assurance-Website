"use client";

import ReadinessGatesTab from "@/components/pages/ReadinessGatesTab";
import PageTemplate from "@/components/templates/PageTemplate";

export default function Page() {
  return (
    <PageTemplate label="Readiness Gates">
      {() => <ReadinessGatesTab />}
    </PageTemplate>
  );
}
