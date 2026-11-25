"use client";

import { useRef, useState } from "react";
import StatusPill from "@/components/atoms/StatusPill";
import { readDocument } from "@/lib/intake/readDocument.mjs";
import { addFromExtraction } from "@/lib/watch/actions";
import { FAMILY_CHOICES, extractRequirements } from "@/lib/watch/extract.mjs";

const EXAMPLE =
  "FIFA circular to host stadiums. The players' tunnel must be at least 6 m wide. The press conference room must be at least 400 m². Back-up power must run for at least 6 hours. Each stadium must provide at least 3 quiet rooms of 15 m² for players and officials. Team dressing rooms must be at least 80 m².";
const MAX_UPLOAD = 10 * 1024 * 1024;
const STEPS = ["Reading the text", "Finding the requirement statements", "Matching them to the register"];

const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, reduced() ? 0 : ms));
const KIND = {
  amendment: ["warn", "Change to a requirement"],
  new: ["info", "New requirement"],
  unchanged: ["mute", "Already in force"],
};
const TONE = { high: "good", medium: "warn" };

function Found({ result, onAdd, onClear }) {
  const [picked, setPicked] = useState(() => new Set(result.items.filter((i) => i.kind !== "unchanged").map((i) => i.key)));
  const [families, setFamilies] = useState({});
  const addable = result.items.filter((i) => i.kind !== "unchanged");
  const chosen = addable.filter((i) => picked.has(i.key));
  const toggle = (key) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  return (
    <div className="rw-found" aria-live="polite">
      <h4>
        {result.items.length
          ? `Found ${result.items.length} requirement${result.items.length === 1 ? "" : "s"} in ${result.sourceName}`
          : `No requirement found in ${result.sourceName}`}
      </h4>
      {result.items.length === 0 && (
        <p className="muted small m0">
          {result.readable
            ? "The text has no statement that sets a figure or says what a stadium must provide. Try a sentence such as \u201cThe players' tunnel must be at least 6 m wide.\u201d"
            : "No text could be read from this file, so nothing was found. Use a PDF with selectable text, or paste the text instead."}
        </p>
      )}
      <ul className="rw-found-list">
        {result.items.map((i) => {
          const [tone, label] = KIND[i.kind];
          const can = i.kind !== "unchanged";
          return (
            <li key={i.key} className="rw-found-item">
              <input type="checkbox" checked={can && picked.has(i.key)} disabled={!can} onChange={() => toggle(i.key)} aria-label={`Add ${i.title}`} />
              <div className="rw-found-body">
                <div className="rw-found-head">
                  <div className="rw-found-titleline">
                    <b>{i.title}</b>
                    {i.requirementId && <span className="mono small">{i.requirementId}</span>}
                  </div>
                  <div className="rw-found-tags">
                    <StatusPill tone={tone}>{label}</StatusPill>
                    <StatusPill tone={TONE[i.confidence]}>{i.confidence} confidence</StatusPill>
                  </div>
                </div>
                <div className="small rw-found-detail">
                  {i.kind === "amendment" && (
                    <>
                      {i.oldCrit} → <b>{i.newCrit}</b>
                      {i.shift && i.shift.direction !== "changed" && <span className="muted"> ({i.shift.direction}{i.shift.percent ? `, ${i.shift.percent}%` : ""})</span>}
                    </>
                  )}
                  {i.kind === "unchanged" && (
                    <>
                      <b>{i.newCrit}</b> is already the requirement in force, so there is nothing to change.
                    </>
                  )}
                  {i.kind === "new" && (
                    <span className="rw-new-line">
                      <b>{i.newCrit}</b>
                      <label className="rw-inline">
                        in chapter
                        <select
                          value={families[i.key] || i.familyId}
                          onChange={(e) => setFamilies((f) => ({ ...f, [i.key]: e.target.value }))}
                          aria-label={`Chapter for ${i.title}`}
                        >
                          {FAMILY_CHOICES.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {i.alsoStates && <span className="muted"> · also states {i.alsoStates}</span>}
                    </span>
                  )}
                </div>
                <div className="muted fine rw-found-quote">
                  “{i.quote}” · page {i.page}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="rw-found-actions">
        {addable.length > 0 && (
          <button type="button" className="primary" disabled={!chosen.length} onClick={() => onAdd(chosen.map((i) => (i.kind === "new" ? { ...i, familyId: families[i.key] || i.familyId } : i)))}>
            {chosen.length ? `Add ${chosen.length} to the watch` : "Choose what to add"}
          </button>
        )}
        <button type="button" className="ghost" onClick={onClear}>
          Clear
        </button>
      </div>
      <details className="rw-more">
        <summary className="clickable small">How the agent read this</summary>
        <ol className="pf-steps">
          {result.steps.map((s, k) => (
            <li key={k} className={s.ok ? "ok" : "flag"}>
              <b>{s.label}</b>
              <span>{s.detail}</span>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

/**
 * Add a requirement change: type or paste text, or drop a document. The extraction agent reads it, finds the
 * requirements in it, and shows each one before anything is added to the watch.
 */
export default function AddChangePanel() {
  const [mode, setMode] = useState("text");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [stage, setStage] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [added, setAdded] = useState(null);
  const [over, setOver] = useState(false);
  const input = useRef(null);
  const busy = stage != null;

  const run = async (source) => {
    setError(null);
    setAdded(null);
    setResult(null);
    setStage(0);
    await wait(450);
    setStage(1);
    await wait(550);
    setStage(2);
    await wait(500);
    const found = extractRequirements(source);
    setStage(null);
    setResult({ ...found, sourceName: source.name, sourceKind: source.kind });
  };

  const findInText = () => run({ name: "your text", kind: "text", pages: [{ n: 1, text }], readable: true });
  const findInFile = async (files) => {
    const file = files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD) return setError("That file is larger than 10 MB.");
    if (!/\.(pdf|txt|md)$/i.test(file.name)) return setError("Only PDF, TXT or Markdown files.");
    setFileName(file.name);
    setError(null);
    setStage(0);
    const read = await readDocument(file);
    await run({ name: file.name, kind: "document", pages: read.pages, readable: read.readable });
  };
  const add = (items) => {
    const { shown, skipped } = addFromExtraction(items, { name: result.sourceName, kind: result.sourceKind });
    setAdded({ count: shown.length, skipped });
    setResult(null);
  };
  const clear = () => {
    setResult(null);
    setAdded(null);
    setError(null);
    setFileName("");
    setText("");
  };

  return (
    <section className="block rw-add" aria-labelledby="rw-add-title">
      <div className="rw-add-head">
        <div>
          <span className="eyebrow">Requirement extraction agent</span>
          <h3 id="rw-add-title">Add a requirement change</h3>
          <p className="muted small m0">Type or paste a requirement, or drop a FIFA circular or amendment. The agent finds the requirements in it and shows what each would do.</p>
        </div>
        <div className="rw-seg" role="tablist" aria-label="How to add">
          <button type="button" role="tab" aria-selected={mode === "text"} className={mode === "text" ? "on" : undefined} onClick={() => setMode("text")}>
            Type or paste
          </button>
          <button type="button" role="tab" aria-selected={mode === "document"} className={mode === "document" ? "on" : undefined} onClick={() => setMode("document")}>
            Drop a document
          </button>
        </div>
      </div>

      {mode === "text" ? (
        <div className="rw-add-body">
          <label className="f">
            Requirement text
            <textarea
              rows={4}
              value={text}
              disabled={busy}
              placeholder="For example: The players' tunnel must be at least 6 m wide. Each stadium must provide at least 3 quiet rooms of 15 m²."
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <div className="rw-add-actions">
            <button type="button" className="primary" disabled={busy || !text.trim()} onClick={findInText}>
              {busy ? "Reading…" : "Find requirements"}
            </button>
            <button type="button" className="linkish small" disabled={busy} onClick={() => setText(EXAMPLE)}>
              Use an example
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`ev-drop rw-drop${over ? " over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            if (!busy) findInFile(e.dataTransfer.files);
          }}
        >
          <div>
            <b>{fileName && busy ? fileName : "Drop a FIFA circular or amendment here"}</b>
            <span className="muted small">PDF, TXT or Markdown, up to 10 MB. The agent reads it and lists the requirements it contains.</span>
          </div>
          <button type="button" className="primary" disabled={busy} onClick={() => input.current?.click()}>
            Choose a file
          </button>
          <input
            ref={input}
            type="file"
            accept=".pdf,.txt,.md"
            hidden
            aria-label="Document with requirements"
            onChange={(e) => {
              findInFile(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {busy && (
        <div className="rw-add-progress" aria-live="polite">
          <span className="small ev-working">{STEPS[Math.min(stage, STEPS.length - 1)]}…</span>
          <span className="ev-bar" aria-hidden="true">
            <i style={{ width: `${Math.round(((stage + 1) / STEPS.length) * 100)}%` }} />
          </span>
        </div>
      )}
      {error && (
        <p className="small m0" role="alert">
          <StatusPill tone="bad">Not read</StatusPill> {error}
        </p>
      )}
      {added && (
        <div className="ev-banner good" role="status">
          <div>
            <b>{added.count ? `Added ${added.count} to the watch.` : "Nothing new to add."}</b>{" "}
            {added.count ? "Press View impact on a card below to see what it would do." : ""}
            {added.skipped ? ` ${added.skipped} ${added.skipped === 1 ? "was" : "were"} already in the watch.` : ""}
          </div>
        </div>
      )}
      {result && <Found result={result} onAdd={add} onClear={clear} />}
    </section>
  );
}
