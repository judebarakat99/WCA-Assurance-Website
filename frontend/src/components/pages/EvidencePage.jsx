"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import StatusPill from "@/components/atoms/StatusPill";
import PageHead from "@/components/molecules/PageHead";
import AgentRun from "@/components/organisms/AgentRun";
import EvidenceAlerts from "@/components/organisms/EvidenceAlerts";
import EvidenceInbox, { DropZone, Uploads } from "@/components/organisms/EvidenceInbox";
import IntakeLibrary from "@/components/organisms/IntakeLibrary";
import ProgressFinding from "@/components/organisms/ProgressFinding";
import PageTemplate from "@/components/templates/PageTemplate";
import { openAlerts } from "@/lib/store/alerts";
import {
  CHECK_STATUS,
  checkableStadiums,
  ensureIntake,
  filedDocuments,
  intake,
  proposedDocuments,
  runAllChecks,
  runCheck,
  uploadFiles,
} from "@/lib/store/intake";

function CheckCard({ stadium, selected, onOpen }) {
  const check = intake.checks[stadium.id];
  const running = !!intake.running[stadium.id];
  const run = intake.runs[stadium.id];
  const error = intake.errors[stadium.id];
  const s = check && CHECK_STATUS[check.status];
  return (
    <div className={`block pc-card ${selected ? "sel" : ""} ${run ? "working" : ""}`.trim()}>
      <div className="pc-top">
        <b>{stadium.name}</b>
        {s && <StatusPill tone={s.tone}>{s.label}</StatusPill>}
      </div>
      <span className="muted small">{stadium.city}</span>
      {run ? (
        <div className="pc-working">
          <span className="small intake-working">
            {run.steps.length ? run.steps[Math.min(run.shown, run.steps.length - 1)].label : "Reading the filed documents"}…
          </span>
          <div className="agent-bar" aria-hidden="true">
            <i style={{ width: `${run.steps.length ? Math.round((100 * run.shown) / run.steps.length) : 6}%` }} />
          </div>
        </div>
      ) : check ? (
        <div className="pc-figs">
          <span>
            <b>{check.claimed}%</b> reported
          </span>
          <span>
            <b>{check.recalculated}%</b> recalculated
          </span>
        </div>
      ) : (
        <p className="muted small">Not checked yet.</p>
      )}
      {check?.stale && <StatusPill tone="warn">New evidence since last check</StatusPill>}
      {check?.decision && (
        <span className="muted small">Finding {check.decision} by reviewer</span>
      )}
      {error && (
        <p className="small" role="alert">
          {error}
        </p>
      )}
      <div className="pc-actions">
        <button
          type="button"
          className={check ? "ghost" : "primary"}
          disabled={running}
          onClick={() => {
            onOpen(stadium.id);
            runCheck(stadium.id);
          }}
        >
          {running ? "Checking…" : check ? "Re-run check" : "Run check"}
        </button>
        {check && !run && (
          <button type="button" className="linkish" onClick={() => onOpen(stadium.id)}>
            View finding →
          </button>
        )}
      </div>
    </div>
  );
}

function Verification() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const selected = params.get("stadium");
  const stadiums = checkableStadiums();
  const anyRunning = Object.keys(intake.running).length > 0;
  const open = (id) => {
    router.replace(`${path}?tab=onfile&stadium=${encodeURIComponent(id)}`, { scroll: false });
    setTimeout(() => document.getElementById("finding")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  const check = selected && intake.checks[selected];
  const live = selected && intake.runs[selected] && stadiums.find((s) => s.id === selected);
  return (
    <section className="comp-block" aria-labelledby="intake-verify">
      <div className="comp-block-head">
        <div>
          <span className="eyebrow">Progress claims</span>
          <h2 id="intake-verify">Claimed against recalculated</h2>
          <p>
            The agent reads each stadium&apos;s progress report and detailed plans and checks every figure against the
            page it came from. The arithmetic is done in code: planned progress builds up evenly between each
            activity&apos;s dates, and activities and packages are weighted by budget.
          </p>
        </div>
        {stadiums.length > 1 && (
          <button type="button" className="primary" disabled={anyRunning} onClick={() => runAllChecks(open)}>
            {anyRunning ? "Checking…" : `Run all ${stadiums.length}`}
          </button>
        )}
      </div>
      {!stadiums.length && <p className="muted small">Confirm a progress report to check a stadium&apos;s claim.</p>}
      <div className="pc-grid">
        {stadiums.map((s) => (
          <CheckCard key={s.id} stadium={s} selected={s.id === selected} onOpen={open} />
        ))}
      </div>
      {live ? <AgentRun stadium={live} /> : check && <ProgressFinding key={check.checked_at} check={check} />}
    </section>
  );
}

const TABS = [
  ["confirm", "To confirm"],
  ["onfile", "On file"],
  ["alerts", "Alerts"],
];

function Evidence() {
  useEffect(ensureIntake, []);
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const tab = params.get("tab") || (params.get("stadium") ? "onfile" : "confirm");
  const go = (t) => router.replace(t === "confirm" ? path : `${path}?tab=${t}`, { scroll: false });
  const counts = { confirm: proposedDocuments().length, onfile: filedDocuments().length, alerts: openAlerts().length };
  return (
    <>
      <PageHead
        chip="Evidence · contractor documents"
        title="Evidence"
        wideLead
        lead="Add a contractor's document. The agent reads it, checks it against the FIFA requirements in the register or against the plans, and shows what would change. Nothing is recorded until you confirm."
      />
      <DropZone
        onFiles={(files) => {
          if (tab !== "confirm") go("confirm");
          void uploadFiles(files);
        }}
      />
      <Uploads />
      <div className="ev-tabs" role="tablist" aria-label="Evidence">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : undefined} onClick={() => go(id)}>
            {label} <em>{counts[id]}</em>
          </button>
        ))}
      </div>
      {intake.loaded && tab === "confirm" && <EvidenceInbox />}
      {intake.loaded && tab === "onfile" &&
        (filedDocuments().length ? (
          <>
            <Verification />
            <IntakeLibrary />
          </>
        ) : (
          <p className="muted small">Nothing on file yet. Documents you confirm appear here.</p>
        ))}
      {tab === "alerts" && <EvidenceAlerts />}
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
