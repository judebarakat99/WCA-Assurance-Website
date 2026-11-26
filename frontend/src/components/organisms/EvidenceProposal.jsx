"use client";

import StatusPill from "@/components/atoms/StatusPill";
import EvidenceAnalysis from "@/components/organisms/EvidenceAnalysis";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";
import { ownerFor } from "@/lib/domain/mitigation.mjs";
import { currentRequirement } from "@/lib/domain/requirementVersions.mjs";
import { describeEffect, reanalyse } from "@/lib/store/evidence";
import { KIND_LABEL, intake } from "@/lib/store/intake";

const EXPOSURE = { below: ["bad", "High exposure"], meets: ["good", "Low exposure"] };
const exposureOf = (verdict) => EXPOSURE[verdict] || ["warn", "Medium exposure"];
const dueFor = (stadium) => (stadium ? `30 Jun ${stadium.completionYear}` : "To be set by reviewer");

/** The filing a proposal would be confirmed with: what the agent identified. */
export const filingOf = (doc) => ({
  kind: doc.kind,
  stadium_id: doc.stadium_id,
  element: doc.element,
  as_of: doc.as_of,
  revision: doc.revision,
});

function Findings({ doc, stadium }) {
  const matches = doc.analysis?.matches || [];
  const alerted = new Set((doc.analysis?.alerts || []).map((a) => a.requirement_id));
  if (!matches.length)
    return (
      <p className="muted small">
        No requirement finding was raised because the document did not match a registered requirement.
      </p>
    );
  return (
    <ul className="ev-findings">
      {matches.map((m) => {
        const requirement = currentRequirement(m.requirement_id);
        const [tone, exposure] = exposureOf(m.verdict);
        const owner = stadium && requirement ? ownerFor(stadium.id, requirement) : "Stadium delivery team";
        return (
          <li key={m.requirement_id} className="ev-finding">
            <StatusPill tone={tone}>{exposure}</StatusPill>
            <div>
              <div className="ev-finding-main">
                <span className="mono small">{m.requirement_id}</span>
                <b>{m.title}</b>
                <span className="muted small">
                  {m.family_id} · {m.family}
                </span>
              </div>
              <div className="ev-finding-meta">
                <span>Owner: {owner}</span>
                <span>Due: {dueFor(stadium)}</span>
                {alerted.has(m.requirement_id) && <span className="ev-alert">Owner alerted</span>}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Extracted({ pages }) {
  if (!pages?.length) return null;
  return (
    <details className="ev-extract">
      <summary className="clickable small">Extracted text</summary>
      <pre className="ev-extracted">
        {pages
          .map((p) => p.text)
          .join("\n\n")
          .slice(0, 4000)}
      </pre>
    </details>
  );
}

/**
 * One document the agent has read, before it is confirmed: the stadium and requirements it affects, the findings
 * and owners, what the agent found and what confirming would change.
 */
export default function EvidenceProposal({ doc }) {
  const stadium = FACILITY_REGISTER.stadiums.find((s) => s.id === doc.stadium_id) || null;
  const evidence = doc.kind === "evidence";
  const matches = doc.analysis?.matches || [];
  const effect = describeEffect(doc, filingOf(doc));
  const busy = !!intake.busy[doc.document_id];
  return (
    <article className="ev-proposal" aria-label={doc.name}>
      <div className="ev-queue-file">
        <b>{doc.name}</b>
        <StatusPill tone={effect.ready ? "good" : "warn"}>
          {effect.ready ? "Ready to confirm" : "Needs your input"}
        </StatusPill>
      </div>
      <div className="ev-analysis-grid">
        <div>
          <span className="muted small">Affected stadium</span>
          <b>{stadium?.name || "No registered stadium identified"}</b>
          {stadium ? (
            <span className="muted small">
              {FACILITY_REGISTER.hostCities.find((c) => c.id === stadium.cityId)?.name}
            </span>
          ) : (
            <label className="f">
              <span className="muted small">Choose the stadium</span>
              <select
                value=""
                disabled={busy}
                onChange={(e) => e.target.value && reanalyse(doc.document_id, e.target.value)}
              >
                <option value="">Choose…</option>
                {FACILITY_REGISTER.stadiums.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div>
          <span className="muted small">{evidence ? "Affected requirements" : "Document"}</span>
          {evidence ? (
            <>
              <b>{matches.length} found in the register</b>
              <span className="muted small">
                {[...new Set(matches.map((m) => `${m.family_id} · ${m.family}`))].join(" · ") ||
                  "No requirement matched"}
              </span>
            </>
          ) : (
            <>
              <b>{KIND_LABEL[doc.kind] || "Document"}</b>
              <span className="muted small">
                {[doc.revision && `Revision ${doc.revision}`, doc.as_of].filter(Boolean).join(" · ") ||
                  "No date or revision found"}
              </span>
            </>
          )}
        </div>
      </div>
      {evidence && (
        <>
          <div className="ev-analysis-block">
            <h3>Requirement findings and owner alerts</h3>
            <Findings doc={doc} stadium={stadium} />
          </div>
          <div className="ev-analysis-block">
            <h3>What the agent found</h3>
            <EvidenceAnalysis doc={doc} />
          </div>
        </>
      )}
      <div className="ev-impact">
        <h3>If you confirm</h3>
        <ul className="ev-effect-lines">
          {effect.lines.map((line, i) => (
            <li key={i} className={[line.tone, line.indent && "indent"].filter(Boolean).join(" ") || undefined}>
              {line.text}
            </li>
          ))}
        </ul>
      </div>
      <Extracted pages={doc.text_pages} />
    </article>
  );
}
