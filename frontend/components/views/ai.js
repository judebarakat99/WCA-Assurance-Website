// Azure-backed assistant (Nabd). Model output is escaped as text, never inserted as HTML.
import { esc } from "../../lib/data";
import { ai } from "../../lib/state";
import { buildAssistantContext } from "../../lib/assistant-context";
import { assistantRequest } from "../../lib/assistant-api";
import { sourceHtml } from "./assistantSources";

const AI_CHIPS = [
  "Which venue is highest risk?",
  "Why is Jeddah at risk?",
  "Which critical obligations are unverified?",
  "What decisions are open?",
  "What do the uploaded documents require?",
];
let pending = false;
let uploading = false;
let indexedDocuments = [];

export function renderAIMsgs() {
  const box = document.getElementById("aiMsgs");
  if (!box) return;
  box.innerHTML =
    ai.msgs
      .map(
        (message) =>
          `<div class="ai-msg ${message.who}" ${message.error ? 'role="alert"' : ""}><div class="ai-answer">${esc(message.html)}</div>${message.sources?.length ? `<div class="ai-sources"><p class="ai-sources-label">Supporting sources</p>${message.sources.map(sourceHtml).join("")}</div>` : ""}${(message.warnings || []).map((w) => `<p class="ai-warning">${esc(w)}</p>`).join("")}</div>`,
      )
      .join("") +
    (pending
      ? '<div class="ai-msg a" role="status">Nabd is checking programme data and documents…</div>'
      : "");
  box.scrollTop = box.scrollHeight;
  const form = document.getElementById("aiForm");
  if (form) {
    form.setAttribute("aria-busy", String(pending));
    form.querySelector("button").disabled = pending;
  }
  document.querySelectorAll("[data-aiq]").forEach((button) => {
    button.disabled = pending;
  });
}

export async function aiAsk(question) {
  const q = String(question || "").trim();
  if (!q || pending) return;
  if (q.length > 4000) {
    ai.msgs.push({
      who: "a",
      html: "Please keep your question under 4,000 characters.",
      error: true,
    });
    renderAIMsgs();
    return;
  }
  ai.open = true;
  const panel = document.getElementById("aiPanel");
  if (panel) panel.hidden = false;
  document.getElementById("aiFab")?.setAttribute("aria-expanded", "true");
  const history = ai.msgs
    .filter((m) => !m.error && !m.greeting)
    .slice(-12)
    .map((m) => ({
      role: m.who === "u" ? "user" : "assistant",
      content: m.html.slice(0, 6000),
    }));
  ai.msgs.push({ who: "u", html: q });
  pending = true;
  renderAIMsgs();
  try {
    const result = await assistantRequest("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: q,
        history,
        context: buildAssistantContext(),
      }),
    });
    ai.msgs.push({
      who: "a",
      html: result.reply,
      sources: result.sources,
      warnings: result.warnings,
    });
  } catch (error) {
    ai.msgs.push({ who: "a", html: error.message, error: true });
  } finally {
    pending = false;
    renderAIMsgs();
  }
}

function paintDocuments(message = "") {
  const list = document.getElementById("aiDocs");
  if (!list) return;
  list.innerHTML =
    `<p role="status">${esc(message || `${indexedDocuments.length} document(s) available for retrieval`)}</p>` +
    indexedDocuments
      .map(
        (d) =>
          `<div class="ai-document"><span>${esc(d.name)}<small>${d.pages} text page(s)</small></span><button type="button" data-remove-document="${esc(d.id)}" aria-label="Remove ${esc(d.name)}" ${uploading ? "disabled" : ""}>Remove</button></div>`,
      )
      .join("");
  const button = document.getElementById("aiUpload");
  if (button) button.disabled = uploading;
}

async function refreshDocuments() {
  try {
    indexedDocuments = await assistantRequest("/documents");
    paintDocuments();
  } catch (error) {
    paintDocuments(error.message);
  }
}

async function uploadDocument() {
  const input = document.getElementById("aiDocument");
  const file = input?.files?.[0];
  if (!file || uploading) return;
  if (file.size > 10 * 1024 * 1024) {
    paintDocuments("Choose a document under 10 MB.");
    return;
  }
  uploading = true;
  paintDocuments("Extracting text and indexing with Azure…");
  try {
    const form = new FormData();
    form.append("file", file);
    await assistantRequest("/documents", { method: "POST", body: form });
    input.value = "";
    indexedDocuments = await assistantRequest("/documents");
    paintDocuments("Document indexed. You can now ask Nabd about it.");
  } catch (error) {
    paintDocuments(error.message);
  } finally {
    uploading = false;
    document.getElementById("aiUpload").disabled = false;
  }
}

export function mountAI() {
  const root = document.getElementById("aiRoot");
  if (!root || root.dataset.mounted) return;
  root.dataset.mounted = "1";
  root.innerHTML = `<button class="ai-fab" id="aiFab" type="button" aria-haspopup="dialog" aria-expanded="false">✦ Ask Nabd</button>
 <section class="ai-panel" id="aiPanel" hidden role="dialog" aria-label="Nabd readiness assistant"><header class="ai-head"><div><b>Nabd <span class="ai-ar">نبض</span></b><small>Readiness intelligence · programme data & documents</small></div><div class="ai-window-controls"><button type="button" class="ghost" id="aiExpand" aria-label="Expand chat window" aria-pressed="false">Expand</button><button type="button" class="ghost ai-close" id="aiClose" data-ai-close aria-label="Close Nabd">✕</button></div></header>
 <details class="ai-reference"><summary>Reference documents</summary><p>Upload PDF, TXT, or Markdown (10 MB max). Text is sent to Azure for indexing and answers. Uploading does not validate compliance.</p><input id="aiDocument" type="file" accept=".pdf,.txt,.md" aria-label="Reference document"/><button id="aiUpload" type="button">Index document</button><div id="aiDocs"></div></details>
 <div class="ai-msgs" id="aiMsgs" aria-live="polite" aria-relevant="additions text"></div><div class="ai-chips">${AI_CHIPS.map((q) => `<button class="ai-chipq" type="button" data-aiq="${esc(q)}">${esc(q)}</button>`).join("")}</div><form id="aiForm" class="ai-form"><input id="aiInput" type="text" maxlength="4000" autocomplete="off" aria-label="Question" placeholder="Ask Nabd about readiness or your documents…"/><button class="primary" type="submit">Ask</button></form></section>`;
  document.getElementById("aiForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (pending) return;
    const input = document.getElementById("aiInput");
    const question = input.value.trim();
    if (!question) return;
    input.value = "";
    void aiAsk(question);
  });
  document.getElementById("aiExpand").addEventListener("click", (event) => {
    const panel = document.getElementById("aiPanel");
    const expanded = panel.classList.toggle("ai-expanded");
    event.currentTarget.setAttribute("aria-pressed", String(expanded));
    event.currentTarget.setAttribute(
      "aria-label",
      expanded ? "Restore chat window" : "Expand chat window",
    );
    event.currentTarget.textContent = expanded ? "Restore" : "Expand";
  });
  document
    .getElementById("aiUpload")
    .addEventListener("click", () => void uploadDocument());
  document
    .querySelector(".ai-reference")
    .addEventListener("toggle", (event) => {
      if (event.target.open) void refreshDocuments();
    });
  document.getElementById("aiDocs").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-remove-document]");
    if (!button || uploading) return;
    if (!window.confirm("Remove this document from the local assistant index?"))
      return;
    button.disabled = true;
    try {
      await assistantRequest(
        "/documents/" + encodeURIComponent(button.dataset.removeDocument),
        { method: "DELETE" },
      );
      await refreshDocuments();
    } catch (error) {
      paintDocuments(error.message);
      button.disabled = false;
    }
  });
}
