"use client";

import { useEffect } from "react";
import { mountView } from "@/legacy/engine";

// Mount point for pages not yet rebuilt in React: the legacy engine renders
// the view's HTML into #view. Delete this file when src/legacy is gone.
export default function AppView({ view, param = null }) {
  useEffect(() => {
    mountView(view, param);
  }, [view, param]);
  return <main className="wrap" id="view"></main>;
}
