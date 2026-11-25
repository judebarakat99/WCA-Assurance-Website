"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import PageTemplate from "@/components/templates/PageTemplate";

function Redirect() {
  const router = useRouter();
  const params = useSearchParams();
  const stadium = params.get("stadium");
  const target = stadium ? `/evidence?tab=checks&stadium=${encodeURIComponent(stadium)}` : "/evidence";
  useEffect(() => {
    router.replace(target);
  }, [router, target]);
  return (
    <p className="muted">
      This page is now <Link href={target}>Evidence</Link>.
    </p>
  );
}

/** The old Intake address: sends people (and old links) to the Evidence page. */
export default function IntakeRedirect() {
  return (
    <PageTemplate label="Evidence">
      {() => (
        <Suspense>
          <Redirect />
        </Suspense>
      )}
    </PageTemplate>
  );
}
