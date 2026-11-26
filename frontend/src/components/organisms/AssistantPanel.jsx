"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import AssistantSource from "@/components/molecules/AssistantSource";
import { QUICK_QUESTIONS, aiAsk, setAssistantOpen } from "@/lib/assistant/chat";
import { ai } from "@/lib/store/state";
import { useProgramme } from "@/lib/store/useProgramme";

function Message({ m }) {
  return (
    <div className={`ai-msg ${m.who}`} role={m.error ? "alert" : undefined}>
      <div className={`ai-answer${m.streaming ? " streaming" : ""}`}>{m.text}</div>
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

// Documents come in through the Evidence page; Nabd can list them and what they recorded.
function DocumentsNote() {
  return (
    <p className="ai-reference">
      Nabd can also answer from documents filed on the <Link href="/evidence">Evidence page</Link>.
    </p>
  );
}

/** Nabd: floating button and chat panel, available on every page. */
export default function AssistantPanel() {
  useProgramme(); // re-render when the conversation changes
  const [expanded, setExpanded] = useState(false);
  const [question, setQuestion] = useState("");
  const inputRef = useRef(null);
  const msgsRef = useRef(null);
  const { open, msgs } = ai;
  // Busy while Nabd works out an answer and while the answer is still appearing.
  const pending = ai.pending || msgs.some((m) => m.streaming);
  const shown = msgs.at(-1)?.text.length || 0;

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
  }, [msgs.length, pending, shown]);

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
        aria-label="Nabd compliance assistant"
      >
        <header className="ai-head">
          <div>
            <b>
              Nabd <span className="ai-ar">نبض</span>
            </b>
            <small>Compliance data &amp; documents</small>
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
        <DocumentsNote />
        <div className="ai-msgs" id="aiMsgs" ref={msgsRef} aria-live="polite" aria-relevant="additions text">
          {msgs.map((m, k) => (
            <Message key={k} m={m} />
          ))}
          {ai.pending && (
            <div className="ai-msg a" role="status">
              Nabd is checking compliance data and documents…
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
            placeholder="Ask Nabd about compliance or your documents…"
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
