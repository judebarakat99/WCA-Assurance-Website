"use client";

import Script from "next/script";
import { useState } from "react";

// Preserve the original dependency order for the 3D twin (Three.js and
// OrbitControls stay untouched). The assurance engine itself now lives in
// lib/ and components/views/ as ES modules.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const sources = [
  "/vendor/three.min.js",
  "/vendor/OrbitControls.js",
  "/scripts/stadium-twin.js",
  "/scripts/menus.js",
].map((src) => `${basePath}${src}`);

export default function LegacyScripts() {
  const [loaded, setLoaded] = useState(0);
  const [failed, setFailed] = useState(false);

  return (
    <>
      {failed && <p role="alert">The 3D demo could not load. Please reload the page.</p>}
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
