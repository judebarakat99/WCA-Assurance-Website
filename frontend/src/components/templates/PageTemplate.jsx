"use client";

import { useEffect } from "react";
import { onPageMount } from "@/lib/runtime";
import { useProgramme } from "@/lib/store/useProgramme";

/**
 * Page shell for programme screens. Renders children with the live
 * programme model once it has loaded in the browser; before that (prerender
 * and hydration) it shows an empty, labelled main region.
 *
 * children: (programme) => ReactNode, where programme = { S, ui, version }.
 */
export default function PageTemplate({ label, children }) {
  const programme = useProgramme();
  useEffect(() => {
    onPageMount();
  }, []);
  return (
    // id="view" keeps the guided tour's "#view …" selectors working.
    <main className="wrap" id="view" aria-label={label} aria-busy={programme ? undefined : true}>
      {programme ? children(programme) : null}
    </main>
  );
}
