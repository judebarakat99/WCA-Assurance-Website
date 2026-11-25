"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import StatusPill from "@/components/atoms/StatusPill";
import PageHead from "@/components/molecules/PageHead";
import EvidenceDrop from "@/components/organisms/EvidenceDrop";
import EvidenceAnalysis from "@/components/organisms/EvidenceAnalysis";
import PageTemplate from "@/components/templates/PageTemplate";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";
import { analyseDocument } from "@/lib/intake/evidenceAgent.mjs";
import { describeEffect } from "@/lib/store/evidence";
import { getAssessments } from "@/lib/store/assessments";
import { ensureIntake } from "@/lib/store/intake";
import { setDemoEvidence } from "@/lib/store/demoEvidence";
import { currentRequirement } from "@/lib/domain/requirementVersions.mjs";
import { ownerOf } from "@/lib/register/data.mjs";

const PIPELINE = ["Received", "Classified", "Matched to requirements", "Validated"];

const STYLES = `
.ev-steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; list-style: none; margin: 0 0 20px; padding: 0; }
.ev-step { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--line, #dfe2ee); border-radius: 12px; background: var(--card, #fff); opacity: .65; color: inherit; text-decoration: none; }
.ev-step a { display: flex; align-items: center; gap: 10px; width: 100%; color: inherit; text-decoration: none; }
.ev-step.now { opacity: 1; border-color: var(--accent, #2d3166); box-shadow: 0 0 0 2px rgba(45, 49, 102, .12); }
.ev-step.done { opacity: 1; }
.ev-step-n { width: 26px; height: 26px; flex: none; display: grid; place-items: center; border-radius: 50%; background: var(--chip, #e8eaf6); font-size: 12px; font-weight: 700; }
.ev-step.now .ev-step-n { background: var(--accent, #2d3166); color: #fff; }
.ev-step.done .ev-step-n { background: #dff3e4; color: #1f6b34; }
.ev-step-t { display: flex; flex-direction: column; line-height: 1.25; }
.ev-step-t small { color: var(--muted, #6b7088); font-size: 12px; }
.ev-agent { margin-top: 20px; padding: 18px; border: 1px solid var(--line, #dfe2ee); border-radius: 12px; background: var(--card, #fff); }
.ev-agent h2 { margin: 0 0 12px; font-size: 18px; }
.ev-agent ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 9px; }
.ev-agent li { display: flex; align-items: center; gap: 9px; color: var(--muted, #6b7088); }
.ev-agent li.done { color: inherit; }
.ev-agent li.done::before { content: "✓"; color: var(--good, #1f6b34); font-weight: 700; }
.ev-agent li:not(.done)::before { content: "…"; width: 1em; text-align: center; color: var(--accent, #2d3166); font-weight: 700; }
.ev-extracted { margin: 16px 0; padding: 14px; border: 1px solid var(--line, #dfe2ee); border-radius: 10px; background: var(--sunk, #f5f6f8); white-space: pre-wrap; font: 13px/1.55 var(--f-mono, ui-monospace, monospace); max-height: 260px; overflow: auto; }
.ev-analysis-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 16px 0; }
.ev-analysis-grid > div, .ev-analysis-block, .ev-impact { display: grid; gap: 4px; padding: 13px; border: 1px solid var(--line, #dfe2ee); border-radius: 10px; }
.ev-analysis-block h3, .ev-impact h3 { margin: 0 0 8px; font-size: 15px; }
.ev-requirements { display: grid; gap: 8px; list-style: none; margin: 0; padding: 0; }
.ev-requirements li { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: baseline; gap: 8px; }
.ev-impact { margin-top: 12px; background: color-mix(in srgb, var(--accent-soft, #e8eaf6) 55%, transparent); }
.ev-impact p { margin: 0; }
.ev-confirm { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 16px; }
.ev-new { color: var(--gold, #9a6f17); font-weight: 700; }
.ev-confirmed-title { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.ev-queue { display: grid; gap: 12px; list-style: none; margin: 0; padding: 0; }
.ev-queue-item { display: grid; gap: 10px; padding: 13px; border: 1px solid var(--line, #dfe2ee); border-radius: 10px; }
.ev-queue-file { display: flex; justify-content: space-between; gap: 12px; }
.ev-pipeline { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; }
.ev-pipeline span { padding: 7px 8px; border-radius: 7px; background: var(--sunk, #f5f6f8); color: var(--muted, #6b7088); font-size: 12px; text-align: center; }
.ev-pipeline span.done { background: var(--good-soft, #dff3e4); color: var(--ink, inherit); }
.ev-pipeline span.now { background: var(--accent-soft, #e8eaf6); color: var(--ink, inherit); font-weight: 700; }
.ev-findings { display: grid; gap: 9px; list-style: none; margin: 0; padding: 0; }
.ev-finding { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 8px 12px; padding: 11px 0; border-top: 1px solid var(--line, #dfe2ee); }
.ev-finding-main, .ev-finding-meta { display: flex; flex-wrap: wrap; align-items: baseline; gap: 7px; }
.ev-finding-meta { grid-column: 2; color: var(--muted, #6b7088); font-size: 12px; }
.ev-alert { color: var(--gold, #9a6f17); font-weight: 700; }
@media (max-width: 720px) { .ev-steps { grid-template-columns: 1fr 1fr; } .ev-analysis-grid { grid-template-columns: 1fr; } .ev-requirements li { grid-template-columns: 1fr; gap: 2px; } .ev-confirm { align-items: flex-start; flex-direction: column; } }
`;

function analyseDemo(file, context, extracted) {
  const result = analyseDocument(
    { name: file?.name || "Evidence document", size: file?.size || 0, pages: [{ n: 1, text: extracted }], readable: Boolean(extracted) },
    getAssessments(),
    new Date(),
    { stadiumId: context.stadiumId || undefined },
  );
  return { ...result, stadium: FACILITY_REGISTER.stadiums.find((item) => item.id === result.stadium_id) || null };
}

const exposureFor = (verdict) => verdict === "below" ? ["bad", "High exposure"] : verdict === "meets" ? ["good", "Low exposure"] : ["warn", "Medium exposure"];
const dueDateFor = (stadium) => stadium ? `30 Jun ${stadium.completionYear}` : "To be set by reviewer";

function Stepper({ current }) {
  const steps = [
    { n: 1, label: "Add", hint: "Drop documents" },
    { n: 2, label: "Agent checks", hint: "Reads and compares" },
    { n: 3, label: "Evidence to confirm", hint: "Review extracted content" },
    { n: 4, label: "Confirmed", hint: "Appears in Review Queue", href: "/review" },
  ];
  return (
    <ol className="ev-steps" aria-label="Evidence workflow">
      {steps.map((step) => {
        const state = step.n < current ? "done" : step.n === current ? "now" : "next";
        const body = (
          <>
            <span className="ev-step-n">{state === "done" ? "✓" : step.n}</span>
            <span className="ev-step-t">
              <b>{step.label}</b>
              <small>{step.hint}</small>
            </span>
          </>
        );
        return (
          <li key={step.n} className={`ev-step ${state}`} aria-current={state === "now" ? "step" : undefined}>
            {step.href ? <Link href={step.href}>{body}</Link> : body}
          </li>
        );
      })}
    </ol>
  );
}

function Evidence() {
  useEffect(ensureIntake, []);
  const timers = useRef([]);
  const [demo, setDemo] = useState({ step: 1, file: null, context: {}, extracted: "", checks: [], queue: [], analysis: null, confirmed: null });

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  const startDemo = async (files, context) => {
    const file = files[0];
    if (!file) return;
    timers.current.forEach((timer) => window.clearTimeout(timer));
    const checkLabels = [
      "Reading the document and extracting its text",
      "Classifying the document",
      "Matching it to FIFA requirements",
      "Validating the findings and owners",
    ];
    const queue = files.map((item) => ({ name: item.name, stage: 0 }));
    setDemo({ step: 2, file, context, extracted: "", checks: [], queue, analysis: null, confirmed: null });
    let extracted = "";
    try {
      extracted = (await file.text()).trim();
    } catch {
      extracted = "";
    }
    if (!extracted) extracted = `Extracted content from ${file.name}.\n\nThe agent found a document ready for reviewer confirmation.`;
    extracted = extracted.slice(0, 4000);
    checkLabels.forEach((_, index) => {
      timers.current.push(
        window.setTimeout(() => setDemo((current) => ({
          ...current,
          checks: checkLabels.slice(0, index + 1),
          queue: current.queue.map((item, itemIndex) => itemIndex === 0 ? { ...item, stage: index + 1 } : item),
        })), 700 * (index + 1)),
      );
    });
    timers.current.push(
      window.setTimeout(() => setDemo((current) => ({ ...current, step: 3, extracted, checks: checkLabels, queue: current.queue.map((item, index) => index === 0 ? { ...item, stage: PIPELINE.length - 1 } : item), analysis: analyseDemo(file, context, extracted) })), 700 * (checkLabels.length + 1)),
    );
  };

  const confirmDemo = () => {
    const confirmed = {
      id: `demo-${Date.now()}`,
      name: demo.file?.name || "New evidence",
      stadium: demo.analysis?.stadium_id || demo.context.stadiumId || "Stadium identified by agent",
      purpose: demo.context.purpose || "Evidence purpose identified by agent",
      extracted: demo.extracted,
      createdAt: new Date().toISOString(),
    };
    setDemo((current) => ({ ...current, step: 4, confirmed }));
    setDemoEvidence(confirmed);
  };

  return (
    <>
      <style>{STYLES}</style>
      <PageHead
        chip="Evidence · contractor documents"
        title="Evidence"
        wideLead
        lead="Add a contractor's document. The agent reads it, checks it against the FIFA requirements or plans, and shows the extracted content before you confirm it."
      />
      <Stepper current={demo.step} />

      {demo.step === 1 && <EvidenceDrop onFilesAdded={startDemo} />}

      {demo.step === 2 && (
        <section className="ev-agent" aria-live="polite" aria-labelledby="ev-agent-title">
          <h2 id="ev-agent-title">Evidence intake</h2>
          <p className="ev-section-sub">Incoming reports, plans, audit documents and evidence move through a visible pipeline before anything is confirmed.</p>
          <ol className="ev-queue">
            {demo.queue.map((item) => (
              <li key={item.name} className="ev-queue-item">
                <div className="ev-queue-file"><b>{item.name}</b><StatusPill tone={item.stage === PIPELINE.length - 1 ? "good" : "warn"}>{PIPELINE[item.stage]}</StatusPill></div>
                <div className="ev-pipeline" aria-label={`Pipeline for ${item.name}`}>
                  {PIPELINE.map((stage, index) => <span key={stage} className={index < item.stage ? "done" : index === item.stage ? "now" : undefined}>{stage}</span>)}
                </div>
              </li>
            ))}
          </ol>
          <h2>Agent checks</h2>
          <p className="ev-section-sub">The agent is reading the document and preparing the evidence for your confirmation.</p>
          <ul>
            {["Reading the document and extracting its text", "Identifying the stadium and evidence type", "Comparing the evidence with the FIFA requirement register", "Preparing the proposed review-queue change"].map((label, index) => (
              <li key={label} className={demo.checks.length > index ? "done" : undefined}>{label}</li>
            ))}
          </ul>
        </section>
      )}

      {demo.step === 3 && (
        <section className="ev-agent" aria-labelledby="ev-confirm-title">
          <h2 id="ev-confirm-title">Evidence to confirm</h2>
          <p className="ev-section-sub">The agent found the following affected stadium, requirements and readiness effect. Confirming adds it to the top of Review Queue for this session.</p>
          {demo.analysis && (
            <>
              <div className="ev-analysis-grid">
                <div>
                  <span className="muted small">Affected stadium</span>
                  <b>{demo.analysis.stadium?.name || "No registered stadium identified"}</b>
                  <span className="muted small">{demo.analysis.stadium?.cityId || "Needs reviewer confirmation"}</span>
                </div>
                <div>
                  <span className="muted small">Affected requirements</span>
                  <b>{demo.analysis.analysis.matches.length} found in the register</b>
                  <span className="muted small">{[...new Set(demo.analysis.analysis.matches.map((match) => `${match.family_id} · ${match.family}`))].join(" · ") || "No requirement matched"}</span>
                </div>
              </div>
              <div className="ev-analysis-block">
                <h3>Requirement findings and owner alerts</h3>
                {demo.analysis.analysis.matches.length ? (
                  <ul className="ev-findings">
                    {demo.analysis.analysis.matches.map((match) => {
                      const requirement = currentRequirement(match.requirement_id);
                      const [tone, exposure] = exposureFor(match.verdict);
                      const owner = demo.analysis.stadium && requirement ? ownerOf(demo.analysis.stadium.id, requirement) : "Stadium delivery team";
                      return (
                        <li key={match.requirement_id} className="ev-finding">
                          <StatusPill tone={tone}>{exposure}</StatusPill>
                          <div>
                            <div className="ev-finding-main"><span className="mono small">{match.requirement_id}</span><b>{match.title}</b><span className="muted small">{match.family_id} · {match.family}</span></div>
                            <div className="ev-finding-meta"><span>Owner: {owner}</span><span>Due: {dueDateFor(demo.analysis.stadium)}</span><span className="ev-alert">Owner alerted</span></div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="muted small">No requirement finding was raised because the document did not match a registered requirement.</p>
                )}
              </div>
              <div className="ev-analysis-block">
                <h3>What the agent found</h3>
                <EvidenceAnalysis doc={{ analysis: demo.analysis.analysis }} />
              </div>
              <div className="ev-impact">
                <h3>If you confirm</h3>
                <ul className="ev-effect-lines">
                  {(demo.analysis.stadium_id
                    ? describeEffect({ analysis: demo.analysis.analysis }, { kind: "evidence", stadium_id: demo.analysis.stadium_id }).lines
                    : [{ text: "The agent could not identify a registered stadium. Choose the stadium before confirming." }]
                  ).map((line, index) => <li key={index} className={line.tone || ""}>{line.text}</li>)}
                </ul>
              </div>
            </>
          )}
          <div className="ev-confirm">
            <span className="muted small">Nothing is saved until you confirm.</span>
            <button type="button" className="primary" onClick={confirmDemo}>Confirm evidence</button>
          </div>
        </section>
      )}

      {demo.step === 4 && (
        <section className="ev-agent" aria-live="polite">
          <h2 className="ev-confirmed-title">Evidence confirmed <span className="ev-new">★ New</span></h2>
          <p>{demo.confirmed?.name} is confirmed and has been added to the top of the Review Queue.</p>
          <Link className="primary" href="/review">Open Review Queue</Link>
        </section>
      )}
    </>
  );
}

export default function EvidencePage() {
  return (
    <PageTemplate label="Evidence">
      {() => (
        <Suspense>
          <Evidence />
        </Suspense>
      )}
    </PageTemplate>
  );
}
