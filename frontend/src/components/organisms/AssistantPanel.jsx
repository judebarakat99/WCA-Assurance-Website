"use client";

import { useEffect, useRef, useState } from "react";
import AssistantSource from "@/components/molecules/AssistantSource";
import { assistantRequest } from "@/lib/assistant/api";
import { QUICK_QUESTIONS, aiAsk, setAssistantOpen } from "@/lib/assistant/chat";
import { ai } from "@/lib/store/state";
import { useProgramme } from "@/lib/store/useProgramme";

const MAX_UPLOAD = 10 * 1024 * 1024;

function Message({ m }) {
  return (
    <div className={`ai-msg ${m.who}`} role={m.error ? "alert" : undefined}>
      <div className="ai-answer">{m.text}</div>
      {m.sources?.length > 0 && (
        <div className="ai-sources">
          <p className="ai-sources-label">Supporting sources</p>
          {m.sources.map((s, k) => (
            <AssistantSource key={`${s.id || s.title}-${k}`} source={s} />
          ))}
        </div>
      )}
      {(m.warnings || []).map((w) => (
        <p key={w} className="ai-warning">
          {w}
        </p>
      ))}
    </div>
  );
}

// Reference documents indexed by the backend for retrieval.
function ReferenceDocuments() {
  const input = useRef(null);
  const [docs, setDocs] = useState([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh(message = "") {
    try {
      const list = await assistantRequest("/documents");
      setDocs(list);
      setStatus(message || `${list.length} document(s) available for retrieval`);
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function upload() {
    const file = input.current?.files?.[0];
    if (!file || busy) return;
    if (file.size > MAX_UPLOAD) return setStatus("Choose a document under 10 MB.");
    setBusy(true);
    setStatus("Extracting text and indexing with Azure…");
    try {
      const form = new FormData();
      form.append("file", file);
      await assistantRequest("/documents", { method: "POST", body: form });
      input.current.value = "";
      await refresh("Document indexed. You can now ask Nabd about it.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (busy || !window.confirm("Remove this document from the local assistant index?")) return;
    setBusy(true);
    try {
      await assistantRequest(`/documents/${encodeURIComponent(id)}`, { method: "DELETE" });
      await refresh();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="ai-reference" onToggle={(e) => e.currentTarget.open && refresh()}>
      <summary>Reference documents</summary>
      <p>
        Upload PDF, TXT, or Markdown (10 MB max). Text is sent to Azure for indexing and answers. Uploading does not
        validate compliance.
      </p>
      <input ref={input} id="aiDocument" type="file" accept=".pdf,.txt,.md" aria-label="Reference document" />
      <button id="aiUpload" type="button" disabled={busy} onClick={upload}>
        Index document
      </button>
      <div id="aiDocs">
        {status && <p role="status">{status}</p>}
        {docs.map((d) => (
          <div key={d.id} className="ai-document">
            <span>
              {d.name}
              <small>{d.pages} text page(s)</small>
            </span>
            <button type="button" aria-label={`Remove ${d.name}`} disabled={busy} onClick={() => remove(d.id)}>
              Remove
            </button>
          </div>
        ))}
      </div>
    </details>
  );
}

/** Nabd: floating button and chat panel, available on every page. */
export default function AssistantPanel() {
  useProgramme(); // re-render when the conversation changes
  const [expanded, setExpanded] = useState(false);
  const [question, setQuestion] = useState("");
  const inputRef = useRef(null);
  const msgsRef = useRef(null);
  const { open, msgs, pending } = ai;

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
  }, [msgs.length, pending]);

  function submit(e) {
    e.preventDefault();
    const q = question.trim();
    if (!q || pending) return;
    setQuestion("");
    void aiAsk(q);
  }

  return (
    <div id="aiRoot">
      <button
        className="ai-fab"
        id="aiFab"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setAssistantOpen(!open)}
      >
        ✦ Ask Nabd
      </button>
      <section
        className={`ai-panel ${expanded ? "ai-expanded" : ""}`.trim()}
        id="aiPanel"
        hidden={!open}
        role="dialog"
        aria-label="Nabd readiness assistant"
      >
        <header className="ai-head">
          <div>
            <b>
              Nabd <span className="ai-ar">نبض</span>
            </b>
            <small>Readiness intelligence · programme data &amp; documents</small>
          </div>
          <div className="ai-window-controls">
            <button
              type="button"
              className="ghost"
              id="aiExpand"
              aria-pressed={expanded}
              aria-label={expanded ? "Restore chat window" : "Expand chat window"}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Restore" : "Expand"}
            </button>
            <button
              type="button"
              className="ghost ai-close"
              id="aiClose"
              aria-label="Close Nabd"
              onClick={() => setAssistantOpen(false)}
            >
              ✕
            </button>
          </div>
        </header>
        <ReferenceDocuments />
        <div className="ai-msgs" id="aiMsgs" ref={msgsRef} aria-live="polite" aria-relevant="additions text">
          {msgs.map((m, k) => (
            <Message key={k} m={m} />
          ))}
          {pending && (
            <div className="ai-msg a" role="status">
              Nabd is checking programme data and documents…
            </div>
          )}
        </div>
        <div className="ai-chips">
          {QUICK_QUESTIONS.map((q) => (
            <button key={q} className="ai-chipq" type="button" disabled={pending} onClick={() => aiAsk(q)}>
              {q}
            </button>
          ))}
        </div>
        <form id="aiForm" className="ai-form" aria-busy={pending} onSubmit={submit}>
          <input
            ref={inputRef}
            id="aiInput"
            type="text"
            maxLength={4000}
            autoComplete="off"
            aria-label="Question"
            placeholder="Ask Nabd about readiness or your documents…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button className="primary" type="submit" disabled={pending}>
            Ask
          </button>
        </form>
      </section>
    </div>
  );
}
