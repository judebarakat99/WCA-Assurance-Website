"use client";

import Script from "next/script";
import { useState } from "react";

// Preserve the original dependency order. The existing demo owns the contents
// of #view and the overlay roots; React owns the surrounding page shell.
const sources = [
  "/WFA-Assurance-Website/vendor/three.min.js",
  "/WFA-Assurance-Website/vendor/OrbitControls.js",
  "/WFA-Assurance-Website/scripts/stadium-twin.js",
  "/WFA-Assurance-Website/scripts/assurance.js",
  "/WFA-Assurance-Website/scripts/menus.js",
];

export default function LegacyScripts() {
  const [loaded, setLoaded] = useState(0);
  const [failed, setFailed] = useState(false);

  return (
    <>
      {failed && <p role="alert">The demo could not load. Please reload the page.</p>}
      {sources.slice(0, loaded + 1).map((src, index) => (
        <Script
          key={src}
          src={src}
          strategy="afterInteractive"
          onReady={() => setLoaded((current) => Math.max(current, index + 1))}
          onError={() => setFailed(true)}
        />
      ))}
    </>
  );
}
