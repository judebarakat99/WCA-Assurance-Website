"use client";

import { useEffect } from "react";
import StadiumTwin from "@/components/organisms/StadiumTwin";
import { onPageMount } from "@/lib/runtime";

/** Design intake: the 3D twin of King Salman International Stadium with simulated checks. */
export default function DesignReviewPage() {
  useEffect(() => {
    onPageMount();
  }, []);
  return (
    <main className="wrap" id="view" aria-label="Design review">
      <h2>Design intake · King Salman International Stadium</h2>
      <p className="lead">
        Before anything is built, the design team&apos;s model goes in and compliance checks come out. This is the
        Riyadh venue for the 2034 opening match and final, beside King Abdulaziz Park in north Riyadh. The 3D massing
        follows Populous&apos;s published concept: a circular, segmented form like a seed cracking the earth, green
        walls and roof, and a ring of hospitality boxes between two tiers. Proportions are approximate. The submissions
        and findings are simulated, and thresholds are illustrative.
      </p>
      <StadiumTwin />
    </main>
  );
}
