// Nabd assistant conversation state (in the shared `ai` store) and actions.
import { ai, notify } from "@/lib/store/state";
import { buildAssistantContext } from "@/lib/assistant/context";
import { assistantRequest } from "@/lib/assistant/api";
import { localAnswer } from "@/lib/assistant/localChat";

export const QUICK_QUESTIONS = [
  "What is the latest compliance status?",
  "Which stadium has the lowest assured share?",
  "What is outstanding at King Salman International Stadium?",
  "What are the lighting requirements for a stadium?",
  "What evidence is needed for lighting?",
  "How many items are waiting for review?",
];

const GREETING =
  "Hi, I'm Nabd. Ask me about stadium compliance, the review queue, requirement changes or your reference documents. Answers include supporting references.";

const MAX_QUESTION = 4000;

/** Open or close the assistant panel; the first open adds the greeting. */
export function setAssistantOpen(open) {
  ai.open = open;
  if (open && !ai.msgs.length) ai.msgs.push({ who: "a", text: GREETING, greeting: true });
  notify();
}

/** Ask Nabd a question: opens the panel, sends the assurance snapshot and recent history. */
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
      timeoutMs: 25000,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: q, history, context: buildAssistantContext() }),
    });
    ai.msgs.push({ who: "a", text: result.reply, sources: result.sources, warnings: result.warnings });
  } catch (error) {
    // The service did not answer (not running, timed out or refused): answer from the programme data instead.
    try {
      const local = await localAnswer(q);
      ai.msgs.push({ who: "a", text: local.reply, sources: local.sources, warnings: local.warnings });
    } catch {
      ai.msgs.push({ who: "a", text: error.message, error: true });
    }
  } finally {
    ai.pending = false;
    notify();
  }
}
