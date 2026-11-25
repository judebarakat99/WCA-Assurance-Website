"use client";

import { useEffect, useRef } from "react";
import StatusPill from "@/components/atoms/StatusPill";
import AddChangePanel from "@/components/organisms/AddChangePanel";
import ChangeAssessment from "@/components/organisms/ChangeAssessment";
import { STATE, watchItems, watchSummary } from "@/lib/watch/actions";

const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function Tile({ value, label, sub, tone = "" }) {
  return (
    <div className={`mini ${tone}`.trim()}>
      <b>{value}</b>
      <span>
        {label}
        {sub && (
          <>
            <br />
            {sub}
          </>
        )}
      </span>
    </div>
  );
}

function Item({ item, selected, onOpen }) {
  const { scenario, assessment: a } = item;
  const state = STATE[item.state];
  const from = item.source ? (item.source.type === "document" ? item.source.name : "Your text") : null;
  return (
    <div className={`rw-item${selected ? " sel" : ""}`}>
      <div className="rw-item-main">
        <div className="rw-item-head">
          <b>{scenario.title}</b>
          <StatusPill tone={state.tone}>{state.label}</StatusPill>
          {item.kind === "new" ? <StatusPill tone="info">New requirement</StatusPill> : item.state !== "applied" && <StatusPill tone="mute">Proposed amendment</StatusPill>}
          {from && <StatusPill tone="mute">From {from}</StatusPill>}
        </div>
        {a ? (
          <>
            <div className="small">
              {item.kind === "new" ? (
                <>
                  New requirement: <b>{a.crit}</b> <span className="muted">· Chapter {a.family.id} {a.family.name}</span>
                </>
              ) : (
                <>
                  <span className="mono">{a.before.id}</span> {a.before.title}: {a.oldCrit} → <b>{a.crit}</b>
                  {a.shift.direction !== "changed" && <span className="muted"> ({a.shift.direction}{a.shift.percent ? `, ${a.shift.percent}%` : ""})</span>}
                </>
              )}
            </div>
            <div className="rw-figs small">
              {item.kind === "new" ? (
                <>
                  <span>
                    <b>{a.rows.length}</b> stadiums
                  </span>
                  <span className={a.actionable.length ? "bad" : "good"}>
                    <b>{a.actionable.length}</b> to start assessing soon
                  </span>
                </>
              ) : (
                <>
                  <span className={a.counts.reopened ? "bad" : "good"}>
                    <b>{a.counts.reopened}</b> would reopen
                  </span>
                  <span className={a.counts.failsInReview ? "bad" : "good"}>
                    <b>{a.counts.failsInReview}</b> fail in review
                  </span>
                  <span>
                    <b>{a.counts.notAssessed}</b> not assessed
                  </span>
                </>
              )}
              <span>
                <b>{a.owners.length}</b> owner{a.owners.length === 1 ? "" : "s"} to act
              </span>
            </div>
          </>
        ) : (
          <div className="small">
            {item.kind === "new" ? (
              <>
                <span className="mono">{scenario.newRequirement.id}</span> · added to the register.
              </>
            ) : (
              <>
                <span className="mono">{scenario.requirementId}</span> · applied to the register as version {item.applied.version}.
              </>
            )}
          </div>
        )}
        <div className="muted fine">{item.custom ? "Added" : "Detected"} {item.detectedText}</div>
      </div>
      <button
        type="button"
        className={selected ? "ghost" : "primary"}
        aria-expanded={selected}
        aria-controls={`rw-detail-${scenario.id}`}
        onClick={() => onOpen(selected ? null : scenario.id)}
      >
        {selected ? "Close" : item.state === "applied" ? "View" : "View impact"}
      </button>
    </div>
  );
}

/**
 * Requirement watch: the extraction agent reads a requirement a person types or a document they drop, and each change
 * found is assessed against the register before anyone is notified or the register changes. Empty until something is added.
 */
export default function RequirementWatch({ selected, onSelect }) {
  const items = watchItems();
  const sum = watchSummary(items);
  const detail = useRef(null);
  // When a change is opened, bring it into view: its assessment opens right under its card.
  useEffect(() => {
    if (!selected || !detail.current) return;
    (detail.current.parentElement || detail.current).scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
    detail.current.focus({ preventScroll: true });
  }, [selected]);
  return (
    <div className="rw">
      <AddChangePanel />
      {items.length > 0 && (
        <>
          <div className="mini-grid four rw-tiles">
            <Tile value={sum.proposed} label="Proposed changes" sub={sum.applied ? `${sum.applied} applied` : "none applied yet"} tone={sum.proposed ? "warn" : "good"} />
            <Tile value={sum.reopen} label="Compliant items that would reopen" sub={`${sum.fails} more would fail in review`} tone={sum.reopen ? "bad" : "good"} />
            <Tile value={sum.stadiums} label="Stadiums to act on" sub="across all proposed changes" tone={sum.stadiums ? "warn" : "good"} />
            <Tile value={sum.owners} label="Owners still to notify" sub="for changes not yet notified" tone={sum.owners ? "warn" : "good"} />
          </div>
          <ol className="rw-list">
            {items.map((item) => {
              const open = item.scenario.id === selected;
              return (
                <li key={item.scenario.id}>
                  <Item item={item} selected={open} onOpen={onSelect} />
                  {open && (
                    <div id={`rw-detail-${item.scenario.id}`} ref={detail} tabIndex={-1} className="rw-detail-wrap">
                      <ChangeAssessment item={item} />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
