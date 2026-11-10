"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Mounts the imperative 3D stadium twin (public/scripts/stadium-twin.js,
 * loaded by TwinScripts) into a container this component owns. The twin keeps
 * one DOM root for the page's lifetime and re-attaches it on every mount.
 */
export default function StadiumTwin() {
  const host = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let timer = null;
    function attach() {
      if (window.WNSTwin && host.current) {
        window.WNSTwin.mount(host.current);
        setReady(true);
      } else {
        timer = setTimeout(attach, 200);
      }
    }
    attach();
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {!ready && <p className="muted">Loading the 3D design engine…</p>}
      <div ref={host} />
    </>
  );
}
