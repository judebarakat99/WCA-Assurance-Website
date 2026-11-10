"use client";

import Script from "next/script";
import { useState } from "react";

// Loads Three.js, OrbitControls and the 3D stadium twin in order, after the
// page is interactive. They load app-wide (not only on /design-review) because
// the guided demo drives the twin right after navigating to it.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const sources = [
  "/vendor/three.min.js",
  "/vendor/OrbitControls.js",
  "/scripts/stadium-twin.js",
].map((src) => `${basePath}${src}`);

export default function TwinScripts() {
  const [loaded, setLoaded] = useState(0);
  const [failed, setFailed] = useState(false);

  return (
    <>
      {failed && (
        <p role="alert">The 3D demo could not load. Please reload the page.</p>
      )}
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
