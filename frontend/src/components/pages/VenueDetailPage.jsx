"use client";

import { useEffect } from "react";
import Legend from "@/components/atoms/Legend";
import Ring from "@/components/atoms/Ring";
import SegmentBar from "@/components/atoms/SegmentBar";
import StatusPill from "@/components/atoms/StatusPill";
import Breadcrumbs from "@/components/molecules/Breadcrumbs";
import GateTrack from "@/components/molecules/GateTrack";
import PageHead from "@/components/molecules/PageHead";
import Section from "@/components/molecules/Section";
import AuditTimeline from "@/components/organisms/AuditTimeline";
import DecisionCard from "@/components/organisms/DecisionCard";
import EvidenceTable from "@/components/organisms/EvidenceTable";
import GateCard from "@/components/organisms/GateCard";
import IssueCard from "@/components/organisms/IssueCard";
import ObligationTable from "@/components/organisms/ObligationTable";
import PageTemplate from "@/components/templates/PageTemplate";
import Link from "next/link";
import { DECISIONS, fmtN, fmtD, pct, dd, venueMeta } from "@/lib/domain/data";
import { scores, oblsOf, venueState, gateEval, isProven } from "@/lib/domain/scoring";
import { forecasts, projection } from "@/lib/domain/forecast";
import { goView } from "@/lib/store/state";
import { openDossier, openRegister } from "@/lib/navigation";
import { stateParts, toneOf } from "@/lib/ui/tones";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const gapTone = (gap) => (gap >= 15 ? "bad" : gap >= 5 ? "warn" : "good");

function ReadinessPanel({ meta, list, sc, openIssues }) {
  const gap = pct(sc.declared - sc.assured);
  const proven = list.filter(isProven).length;
  const p = projection(meta.id);
  const parts = stateParts(list);
  return (
    <div className="panel">
      <div className="eyebrow">Readiness</div>
      <div className="vbody">
        <Ring
          parts={[
            { n: sc.assured, c: "var(--brand-deep)" },
            {
              n: Math.max(sc.declared - sc.assured, 0),
              c: "color-mix(in srgb,var(--warn) 55%,var(--surface))",
            },
            { n: Math.max(1 - Math.max(sc.declared, sc.assured), 0), c: "var(--sunk)" },
          ]}
          value={`${pct(sc.assured)}%`}
          label="assured"
        />
        <div className="vside">
          <div className="vline">
            <span>Declared by owners</span>
            <b>{pct(sc.declared)}%</b>
          </div>
          <div className="vline">
            <span>Assurance gap</span>
            <StatusPill tone={gapTone(gap)}>{gap} pts</StatusPill>
          </div>
          <div className="vline">
            <span>Obligations proven</span>
            <b>
              {proven}/{list.length}
            </b>
          </div>
          <div className="vline">
            <span>Forecast</span>
            <StatusPill tone={toneOf(p.cls)}>{p.status}</StatusPill>
          </div>
          <div className="vline">
            <span>Open issues</span>
            <StatusPill tone={openIssues.length ? "bad" : "mute"}>{openIssues.length}</StatusPill>
          </div>
        </div>
      </div>
      <SegmentBar parts={parts} />
      <Legend parts={parts} />
      <div className="flex mt">
        <button type="button" className="primary" onClick={() => openDossier(meta.id)}>
          Open inspection dossier
        </button>
        <button type="button" className="linkish" onClick={() => openRegister(meta.id)}>
          Open in full register
        </button>
      </div>
    </div>
  );
}

function ForecastPanel({ venue, fc, recovery }) {
  if (!fc)
    return (
      <div className="panel">
        <div className="eyebrow">Gate &amp; forecast</div>
        <h3>All gates passed</h3>
        <GateTrack index={venue.gateIdx} />
        <div className="okbig">
          <i>✓</i>
          <span>All gates passed</span>
        </div>
      </div>
    );
  const onTimeTone = toneOf(fc.cls);
  return (
    <div className="panel">
      <div className="eyebrow">Gate &amp; forecast</div>
      <h3>
        {fc.gate.id} {fc.gate.name} · due {fmtD(fc.gateDate)}
      </h3>
      <GateTrack index={venue.gateIdx} />
      <div className="mini-grid four mt">
        <div className={`mini ${onTimeTone}`}>
          <b>{pct(fc.prob)}%</b>
          <span>chance on time</span>
        </div>
        <div className="mini">
          <b>{fmtD(fc.d50)}</b>
          <span>P50</span>
        </div>
        <div className="mini">
          <b>{fmtD(fc.d60)}</b>
          <span>P60</span>
        </div>
        <div className={`mini ${fc.late80 > 0 ? "bad" : "good"}`}>
          <b>{fmtD(fc.d80)}</b>
          <span>P80 {fc.late80 > 0 ? `${dd(fc.late80)} late` : "inside milestone"}</span>
        </div>
      </div>
      <p className="muted small note">
        PMC deterministic finish {fmtD(fc.pmc.finish)} ({fc.pmc.pct}% · {fc.pmc.note}). The evidence-based
        forecast runs 1,000 simulations from what evidence has proven, not reported percent complete.
        {recovery && " A recovery team is deployed at this venue."}
      </p>
    </div>
  );
}

function VenueDetail({ S, venueId }) {
  const meta = venueMeta(venueId);
  const venue = venueState(venueId);
  const list = oblsOf(venueId);
  const sc = scores(list);
  const fc = forecasts().find((x) => x.id === venueId);
  const inVenue = (i) => list.some((o) => o.id === i.obl);
  const openIssues = S.issues.filter((i) => i.status === "Open" && inVenue(i));
  const closedIssues = S.issues.filter((i) => i.status !== "Open" && inVenue(i));
  const decisions = DECISIONS.filter((d) => d.venue === venueId);
  const audit = S.audit
    .filter((a) => a.obl && String(a.obl).startsWith(`${venueId}-`))
    .slice(-20)
    .reverse();
  const evidence = list
    .flatMap((o) => o.evidence.map((x) => ({ o, x })))
    .sort((a, b) => (a.x.date < b.x.date ? 1 : a.x.date > b.x.date ? -1 : 0));
  const lead = [
    meta.role,
    meta.capacity && `planned capacity about ${fmtN(meta.capacity)}`,
    "everything the programme knows about this venue, backed by validated evidence.",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <>
      <Breadcrumbs label={meta.name} />
      <PageHead chip={`Venue detail · ${meta.city} · ${meta.type}`} title={meta.name} lead={lead} />
      <div className="grid cols vd-top">
        <ReadinessPanel meta={meta} list={list} sc={sc} openIssues={openIssues} />
        <ForecastPanel venue={venue} fc={fc} recovery={S.scn.recovery.includes(venueId)} />
      </div>
      <Section eyebrow="Gate rules" title="Gate check & blockers">
        <GateCard meta={meta} venue={venue} evaluation={gateEval(venueId)} />
      </Section>
      <Section eyebrow="Obligations" title={`${list.length} obligations at this venue`}>
        <ObligationTable obligations={list} />
      </Section>
      <Section eyebrow="Evidence" title={plural(evidence.length, "evidence item")}>
        {evidence.length ? (
          <EvidenceTable rows={evidence} />
        ) : (
          <div className="panel">
            <p className="muted m0">No evidence submitted yet for this venue.</p>
          </div>
        )}
      </Section>
      <Section eyebrow="Corrective actions" title={plural(openIssues.length, "open issue")}>
        {openIssues.length ? (
          <div className="grid issues">
            {openIssues.map((i) => (
              <IssueCard key={i.id} issue={i} S={S} />
            ))}
          </div>
        ) : (
          <div className="panel">
            <div className="okbig">
              <i>✓</i>
              <span>No open issues at this venue</span>
            </div>
          </div>
        )}
        {closedIssues.length > 0 && (
          <details className="mt">
            <summary className="muted clickable">Resolved issues · {closedIssues.length}</summary>
            <div className="grid issues mt">
              {closedIssues.map((i) => (
                <IssueCard key={i.id} issue={i} S={S} />
              ))}
            </div>
          </details>
        )}
      </Section>
      <Section eyebrow="Decisions" title="Related executive decisions">
        {decisions.length ? (
          <div className="grid decs">
            {decisions.map((d) => (
              <DecisionCard key={d.id} decision={d} S={S} />
            ))}
          </div>
        ) : (
          <div className="panel">
            <p className="muted m0">
              No executive decisions raised for this venue.{" "}
              <Link href="/decisions-actions">Open Decisions &amp; Actions</Link>.
            </p>
          </div>
        )}
      </Section>
      <Section eyebrow="Audit trail" title="Activity at this venue">
        <div className="panel">
          <AuditTimeline entries={audit} />
        </div>
      </Section>
    </>
  );
}

// Unknown ids are excluded at build time (dynamicParams = false); guard anyway.
function MissingVenue() {
  useEffect(() => goView("tower"), []);
  return null;
}

export default function VenueDetailPage({ venueId }) {
  const meta = venueMeta(venueId);
  return (
    <PageTemplate label={meta ? meta.name : "Venue"}>
      {(p) => (meta ? <VenueDetail S={p.S} venueId={venueId} /> : <MissingVenue />)}
    </PageTemplate>
  );
}
