// Guided demo player: step navigation, narration and timing. State lives in
// the shared `tour` object; every change calls notify() so TourDock re-renders.
import { ui, tour, resetS, notify } from "@/lib/store/state";
import { toast } from "@/lib/domain/actions";
import { closeDrawer } from "@/lib/drawer";
import { TOUR, EXEC } from "@/lib/tour/steps";
import { applyHL } from "@/lib/tour/highlight";
import { hasVoice, pickVoice } from "@/lib/tour/voice";

export { EXEC };

export const steps = () => tour.list || TOUR;
export const tourName = () => (tour.list === EXEC ? "Executive demo" : "Guided demo");
export const sentences = (t) => t.match(/[^.!?]+[.!?]+/g) || [t];

function stopVoice() {
  tour.timers.forEach(clearTimeout);
  tour.timers = [];
  tour.gen++;
  if (hasVoice)
    try {
      speechSynthesis.cancel();
    } catch {}
}

function markSentence(k) {
  tour.sent = k;
  notify();
}

function narrate() {
  stopVoice();
  const gen = tour.gen;
  const ss = sentences(tour.text);
  tour.sent = 0;
  const done = () => {
    if (gen !== tour.gen) return;
    markSentence(ss.length);
    tour.timers.push(
      setTimeout(() => {
        if (gen === tour.gen && tour.playing) step(1);
      }, 1100),
    );
  };
  const say = (k) => {
    if (gen !== tour.gen || !tour.playing) return;
    if (k >= ss.length) return done();
    markSentence(k);
    const estimate = ss[k].split(/\s+/).length * 390 + 700;
    if (!(tour.voice && hasVoice)) {
      tour.timers.push(setTimeout(() => say(k + 1), estimate));
      return;
    }
    let fired = false;
    const next = () => {
      if (fired) return;
      fired = true;
      say(k + 1);
    };
    const u = new SpeechSynthesisUtterance(ss[k].trim());
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = v ? v.lang : "en-GB";
    u.rate = /^ar/i.test(u.lang) ? 0.92 : 0.97;
    u.onend = next;
    u.onerror = next;
    tour.timers.push(setTimeout(next, estimate * 2 + 3000));
    try {
      speechSynthesis.speak(u);
    } catch {
      next();
    }
  };
  say(0);
}

function runStep() {
  const st = steps()[tour.i];
  tour.sel = st.run() || null;
  tour.text = typeof st.say === "function" ? st.say() : st.say;
  tour.sent = 0;
  notify();
  setTimeout(() => applyHL(true), 120);
  if (tour.playing) narrate();
}

function step(d) {
  stopVoice();
  const n = tour.i + d;
  if (n >= steps().length) return endTour(true);
  if (n < 0) return;
  tour.i = n;
  runStep();
}

/** Start a demo from fresh sample data. list: EXEC for the executive demo. */
export function startTour(list) {
  tour.list = list || null;
  stopVoice();
  resetS();
  closeDrawer();
  window.WNSTwin?.reset();
  ui.filters = { venue: "all", family: "all", state: "all", q: "" };
  ui.decoOut = null;
  tour.active = true;
  tour.i = 0;
  tour.playing = true;
  if (hasVoice)
    try {
      speechSynthesis.getVoices();
    } catch {}
  runStep();
}

export function endTour(finished) {
  stopVoice();
  window.WNSTwin?.stop();
  tour.active = false;
  tour.playing = false;
  tour.sel = null;
  applyHL(false);
  notify();
  if (finished) toast("Demo finished. The app stays in the state the demo left it; use Reset demo to start fresh.");
}

export const nextStep = () => step(1);
export const previousStep = () => step(-1);

export function togglePlay() {
  tour.playing = !tour.playing;
  if (tour.playing) narrate();
  else stopVoice();
  notify();
}

export function setVoice(on) {
  tour.voice = on;
  if (tour.playing) narrate();
  notify();
}

export function setVoiceName(name) {
  tour.voiceName = name;
  if (tour.playing) narrate();
  notify();
}
