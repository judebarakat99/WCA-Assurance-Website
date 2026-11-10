"use client";

import { useEffect, useRef, useState } from "react";
import { tour } from "@/lib/store/state";
import { useProgramme } from "@/lib/store/useProgramme";
import {
  endTour,
  nextStep,
  previousStep,
  sentences,
  setVoice,
  setVoiceName,
  steps,
  togglePlay,
  tourName,
} from "@/lib/tour/player";
import { hasVoice, pickVoice, voiceChoices } from "@/lib/tour/voice";

// Voices load asynchronously in most browsers; refresh the list when they do.
function useVoices() {
  const [voices, setVoices] = useState([]);
  useEffect(() => {
    if (!hasVoice) return undefined;
    const update = () => setVoices(voiceChoices());
    update();
    speechSynthesis.addEventListener?.("voiceschanged", update);
    return () => speechSynthesis.removeEventListener?.("voiceschanged", update);
  }, []);
  return voices;
}

function Caption({ text, sent, playing }) {
  const ref = useRef(null);
  const parts = sentences(text);
  useEffect(() => {
    const cap = ref.current;
    const spans = cap?.querySelectorAll("span");
    const target = spans?.[Math.min(sent, spans.length - 1)];
    if (target) cap.scrollTop = target.offsetTop - cap.offsetTop;
  }, [sent]);
  return (
    <p className="cap" ref={ref}>
      {parts.map((s, k) => (
        <span key={k} className={k < sent ? "done" : k === sent && playing ? "now" : undefined}>
          {s}
        </span>
      ))}
    </p>
  );
}

/** The guided demo's control dock: step title, caption, progress and controls. */
export default function TourDock() {
  useProgramme(); // re-render on tour changes (the player calls notify)
  const voices = useVoices();
  const { active, i, playing, text, sent } = tour;

  useEffect(() => {
    document.body.classList.toggle("touring", active);
  }, [active]);

  if (!active) return <div id="tourRoot" />;
  const list = steps();
  const st = list[i];
  const current = pickVoice();
  const last = i === list.length - 1;
  return (
    <div id="tourRoot">
      <section className="tour dock" role="region" aria-label={tourName()} aria-live="polite">
        <div className="tour-head">
          <span className="chip">
            {tourName()} · {i + 1} of {list.length}
          </span>
          <h3>{st.title}</h3>
        </div>
        <Caption text={text} sent={sent} playing={playing} />
        <div className="tour-prog">
          <i style={{ width: `${(((i + 1) / list.length) * 100).toFixed(1)}%` }} />
        </div>
        <div className="tour-ctl">
          <button type="button" disabled={i === 0} onClick={previousStep}>
            Back
          </button>
          <button type="button" className="primary" onClick={togglePlay}>
            {playing ? "Pause" : "Play"}
          </button>
          <button type="button" onClick={nextStep}>
            {last ? "Finish" : "Next"}
          </button>
          <label htmlFor="tourVoice">
            <input
              type="checkbox"
              id="tourVoice"
              checked={tour.voice && hasVoice}
              disabled={!hasVoice}
              onChange={(e) => setVoice(e.target.checked)}
            />{" "}
            Voice
          </label>
          {hasVoice && voices.length > 0 && (
            <select
              id="tourVoiceSel"
              aria-label="Narrator voice"
              value={current?.name || ""}
              onChange={(e) => setVoiceName(e.target.value)}
            >
              {voices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.label}
                </option>
              ))}
            </select>
          )}
          <button type="button" className="ghost" onClick={() => endTour(false)}>
            Exit
          </button>
        </div>
        {!hasVoice && (
          <div className="tour-note">This browser has no speech voice, so the demo plays with captions only.</div>
        )}
      </section>
    </div>
  );
}
