'use client';

import { useEffect, useRef, useState } from 'react';
import './twin.css';

/**
 * Venue Compliance Hub: interactive 3D design review.
 * three.js is loaded in the browser only. Both modules come from the same
 * build, so the controls and the scene share one copy of three.
 * Props:
 *   onEvent(text)     optional, called when the engine logs an event
 *   onChange(summary) optional, called when the gate or score changes
 *   autoPlay          optional, step indexes to play on mount, e.g. [0,1,2]
 */
export default function Twin3D({ onEvent, onChange, onResults, onSend, onSite, design, autoPlay }) {
  const hostRef = useRef(null);
  const twinRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const THREE = await import('three/build/three.module.js');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
        const { createTwin } = await import('./twinEngine.js');
        if (cancelled || !hostRef.current) return;
        const twin = createTwin(THREE, OrbitControls, design);
        twin.hooks({ onEvent, onChange, onResults, onSend, onSite });
        twin.mount(hostRef.current);
        twinRef.current = twin;
        if (autoPlay && autoPlay.length) twin.play(autoPlay);
      } catch (e) {
        console.error('3D view failed to load', e);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      if (twinRef.current) {
        twinRef.current.stop();
        twinRef.current.root?.remove();
        twinRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (failed) return <p className="muted">The 3D view could not be loaded in this browser.</p>;
  return <div ref={hostRef} className="tw-host" />;
}
