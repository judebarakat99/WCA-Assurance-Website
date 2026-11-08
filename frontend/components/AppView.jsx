"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { mountView } from "../lib/engine";

// Thin client mount point: each App Router page renders this with its view key.
// The legacy-style engine renders the view's HTML synchronously into #view and
// keeps the URL in sync through the Next router (basePath-safe).
export default function AppView({ view, param = null }) {
  const router = useRouter();
  useEffect(() => {
    mountView(view, param, (path, opts) => router.push(path, opts));
  }, [view, param, router]);
  return <main className="wrap" id="view"></main>;
}
