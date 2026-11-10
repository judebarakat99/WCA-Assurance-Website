// Nabd assistant conversation state (in the shared `ai` store) and actions.
import { ai, notify } from "@/lib/store/state";
import { buildAssistantContext } from "@/lib/assistant/context";
import { assistantRequest } from "@/lib/assistant/api";

export const QUICK_QUESTIONS = [
  "Which venue is highest risk?",
  "Why is Jeddah at risk?",
  "Which critical obligations are unverified?",
  "What decisions are open?",
  "What do the uploaded documents require?",
];

const GREETING =
  "Hi, I'm Nabd. Ask me about programme readiness, stadiums, gates, decisions or your reference documents. Programme metrics are illustrative; answers include supporting references.";

const MAX_QUESTION = 4000;

/** Open or close the assistant panel; the first open adds the greeting. */
export function setAssistantOpen(open) {
  ai.open = open;
  if (open && !ai.msgs.length) ai.msgs.push({ who: "a", text: GREETING, greeting: true });
  notify();
}

/** Ask Nabd a question: opens the panel, sends the programme snapshot and recent history. */
export async function aiAsk(question) {
  const q = String(question || "").trim();
  if (!q || ai.pending) return;
  if (q.length > MAX_QUESTION) {
    ai.msgs.push({ who: "a", text: "Please keep your question under 4,000 characters.", error: true });
    notify();
    return;
  }
  if (!ai.open) setAssistantOpen(true);
  const history = ai.msgs
    .filter((m) => !m.error && !m.greeting)
    .slice(-12)
    .map((m) => ({ role: m.who === "u" ? "user" : "assistant", content: m.text.slice(0, 6000) }));
  ai.msgs.push({ who: "u", text: q });
  ai.pending = true;
  notify();
  try {
    const result = await assistantRequest("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: q, history, context: buildAssistantContext() }),
    });
    ai.msgs.push({ who: "a", text: result.reply, sources: result.sources, warnings: result.warnings });
  } catch (error) {
    ai.msgs.push({ who: "a", text: error.message, error: true });
  } finally {
    ai.pending = false;
    notify();
  }
}
