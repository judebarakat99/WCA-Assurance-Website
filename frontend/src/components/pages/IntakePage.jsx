"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import StatusPill from "@/components/atoms/StatusPill";
import PageHead from "@/components/molecules/PageHead";
import AgentRun from "@/components/organisms/AgentRun";
import AlertsPanel from "@/components/organisms/AlertsPanel";
import IntakeIncoming from "@/components/organisms/IntakeIncoming";
import IntakeLibrary from "@/components/organisms/IntakeLibrary";
import ProgressFinding from "@/components/organisms/ProgressFinding";
import PageTemplate from "@/components/templates/PageTemplate";
import {
  CHECK_STATUS,
  checkableStadiums,
  ensureIntake,
  intake,
  refreshIntake,
  runAllChecks,
  runCheck,
  seedIntake,
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
    router.replace(`${path}?stadium=${encodeURIComponent(id)}`, { scroll: false });
    setTimeout(() => document.getElementById("finding")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  const check = selected && intake.checks[selected];
  const live = selected && intake.runs[selected] && stadiums.find((s) => s.id === selected);
  return (
    <section className="comp-block" aria-labelledby="intake-verify">
      <div className="comp-block-head">
        <div>
          <span className="eyebrow">2 · Verification</span>
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
      {!stadiums.length && <p className="muted small">File a progress report to check a stadium.</p>}
      <div className="pc-grid">
        {stadiums.map((s) => (
          <CheckCard key={s.id} stadium={s} selected={s.id === selected} onOpen={open} />
        ))}
      </div>
      {live ? <AgentRun stadium={live} /> : check && <ProgressFinding key={check.checked_at} check={check} />}
    </section>
  );
}

function Intake({ title = "Document intake" }) {
  useEffect(ensureIntake, []);
  const empty = intake.loaded && !intake.documents.length;
  return (
    <>
      <PageHead
        chip="Intake · contractor documents"
        title={title}
        wideLead
        lead="Contractors' progress reports claim how far each stadium has come; their detailed plans show the work behind the claim. The agent sorts what comes in, recalculates progress from the plans and flags claims the evidence does not support. Evidence documents are checked against the FIFA requirements in the register, and the owner of every gap is alerted. A person files every document and decides on every finding."
      />
      {/* {intake.mode === "offline" && intake.loaded && (
        <div className="block intake-alert intake-offline" role="status">
          <StatusPill tone="info">Offline demo</StatusPill>
          <span className="muted small">
            The backend isn&apos;t running, so the sample documents in <span className="mono">data/progress</span> are
            read from bundled readings of them instead of by the model, and only those files can be added. Filing,
            checks and decisions work the same way and are kept in this browser.
          </span>
        </div>
      )} */}
      {intake.error && (
        <div className="block intake-alert" role="alert">
          <b>{intake.error}</b>{" "}
          <button type="button" className="linkish" onClick={refreshIntake}>
            Try again
          </button>
        </div>
      )}
      {empty && (
        <div className="block intake-alert">
          <b>No documents yet.</b>{" "}
          <span className="muted small">
            Load the stadium documents for Aramco and Prince Faisal bin Fahad (filed and checked
            {intake.mode === "online" ? "; about half a minute" : ""}), or drop your own below.
          </span>{" "}
          <button type="button" className="primary" disabled={intake.seeding} onClick={seedIntake}>
            {intake.seeding ? "Loading and checking…" : "Load stadium documents"}
          </button>
        </div>
      )}
      {intake.loaded && (
        <>
          <IntakeIncoming />
          <Verification />
          <IntakeLibrary />
          <AlertsPanel />
        </>
      )}
      {!intake.loaded && !intake.error && <p className="muted">Loading…</p>}
    </>
  );
}

export default function IntakePage({ label = "Document intake", title = "Document intake" }) {
  return (
    <PageTemplate label={label}>
      {() => (
        <Suspense>
          <Intake title={title} />
        </Suspense>
      )}
    </PageTemplate>
  );
}
