"use client";

import { useEffect } from "react";
import { mountReactView } from "@/legacy/engine";
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
    mountReactView();
  }, []);
  return (
    <main className="wrap" aria-label={label} aria-busy={programme ? undefined : true}>
      {programme ? children(programme) : null}
    </main>
  );
}
