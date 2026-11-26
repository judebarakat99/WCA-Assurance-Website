// Nabd assistant conversation state (in the shared `ai` store) and actions. Nabd answers in the browser, from the
// same programme data the pages use (lib/assistant/localChat); the reply is revealed a few words at a time.
import { ai, notify } from "@/lib/store/state";
import { localAnswer } from "@/lib/assistant/localChat";

export const QUICK_QUESTIONS = [
  "What is the latest compliance status?",
  "Which stadium has the lowest assured share?",
  "What is outstanding at King Salman International Stadium?",
  "Which stadiums are behind schedule?",
  "Where is the budget overrunning?",
  "How many items are waiting for review?",
];

const GREETING =
  "Hi, I'm Nabd. Ask me about stadium compliance, the review queue, project progress and cost, requirement changes or the documents on file. Answers include supporting references.";

const MAX_QUESTION = 4000;

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Open or close the assistant panel; the first open adds the greeting. */
export function setAssistantOpen(open) {
  ai.open = open;
  if (open && !ai.msgs.length) ai.msgs.push({ who: "a", text: GREETING, greeting: true });
  notify();
}

/** Reveal an answer a few words at a time; its sources appear once the text is complete. */
async function reveal(answer) {
  const message = { who: "a", text: "", streaming: true };
  ai.msgs.push(message);
  ai.pending = false;
  const words = answer.reply.split(/(\s+)/);
  if (!reducedMotion()) {
    const step = Math.max(2, Math.ceil(words.length / 60)); // about 60 updates, however long the answer
    for (let i = 0; i < words.length; i += step) {
      message.text = words.slice(0, i + step).join("");
      notify();
      await wait(28);
    }
  }
  Object.assign(message, { text: answer.reply, sources: answer.sources, warnings: answer.warnings, streaming: false });
  notify();
}

/** Ask Nabd a question: opens the panel, then answers from the programme data. */
export async function aiAsk(question) {
  const q = String(question || "").trim();
  if (!q || ai.pending || ai.msgs.some((m) => m.streaming)) return;
  if (q.length > MAX_QUESTION) {
    ai.msgs.push({ who: "a", text: "Please keep your question under 4,000 characters.", error: true });
    notify();
    return;
  }
  if (!ai.open) setAssistantOpen(true);
  ai.msgs.push({ who: "u", text: q });
  ai.pending = true;
  notify();
  try {
    await reveal(await localAnswer(q));
  } catch (error) {
    ai.msgs.push({ who: "a", text: error.message || "I could not answer that just now.", error: true });
  } finally {
    ai.pending = false;
    notify();
  }
}
