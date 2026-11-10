// Narrator voice: prefer Saudi or Gulf English where the browser has one, then
// the presenter's own choice, then British English.
import { tour } from "@/lib/store/state";

export const hasVoice =
  typeof window !== "undefined" &&
  typeof window.speechSynthesis !== "undefined" &&
  typeof window.SpeechSynthesisUtterance !== "undefined";

const GULF_EN = /^en[-_](SA|AE|QA|KW|BH|OM)/i;
const ARAB_NAME = /saudi|arab|hamed|naayf|zariyah|fatima|hamdan|shakir|maged|tarik|laila/i;
const isGulf = (x) => GULF_EN.test(x.lang) || (/^en/i.test(x.lang) && ARAB_NAME.test(x.name));

function voiceList() {
  if (!hasVoice) return [];
  try {
    return speechSynthesis.getVoices().filter((x) => /^(en|ar)/i.test(x.lang));
  } catch {
    return [];
  }
}

/** The voice to narrate with, or null for the browser default. */
export function pickVoice() {
  const v = voiceList();
  if (tour.voiceName) {
    const chosen = v.find((x) => x.name === tour.voiceName);
    if (chosen) return chosen;
  }
  return (
    v.find((x) => GULF_EN.test(x.lang)) ||
    v.find((x) => /^en/i.test(x.lang) && ARAB_NAME.test(x.name)) ||
    v.find((x) => /en-GB/i.test(x.lang) && /natural|google|daniel|serena|libby|ryan/i.test(x.name)) ||
    v.find((x) => /en-GB/i.test(x.lang)) ||
    v.find((x) => /^en/i.test(x.lang)) ||
    null
  );
}

function label(x) {
  const suffix = isGulf(x) ? " · Saudi/Gulf English" : /^ar/i.test(x.lang) ? " · Arabic voice reading English" : "";
  return `${x.name.replace(/^Microsoft |^Google /, "")} · ${x.lang}${suffix}`;
}

/** Voices for the picker, best matches first: [{ name, label }]. */
export function voiceChoices() {
  const rank = (x) => (isGulf(x) ? 0 : /^ar-SA/i.test(x.lang) ? 1 : /^ar/i.test(x.lang) ? 2 : 3);
  return voiceList()
    .slice()
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
    .map((x) => ({ name: x.name, label: label(x) }));
}
