"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import PageHead from "@/components/molecules/PageHead";
import AlertsPanel from "@/components/organisms/AlertsPanel";
import EvidenceDrop from "@/components/organisms/EvidenceDrop";
import EvidenceOnFile from "@/components/organisms/EvidenceOnFile";
import EvidenceToConfirm from "@/components/organisms/EvidenceToConfirm";
import ProgressChecks from "@/components/organisms/ProgressChecks";
import PageTemplate from "@/components/templates/PageTemplate";
import { evidenceCounts } from "@/lib/store/evidence";
import { ensureIntake, intake, refreshIntake } from "@/lib/store/intake";

const TABS = ["confirm", "onfile", "alerts", "checks"];

function Done({ result, onClose, go }) {
  if (!result) return null;
  if (result.failed)
    return (
      <div className="ev-banner bad" role="alert">
        <div>
          <b>{result.name} was not filed.</b> {result.error}
        </div>
        <button type="button" className="linkish" onClick={onClose}>
          Dismiss
        </button>
      </div>
    );
  return (
    <div className="ev-banner good" role="status">
      <div>
        {result.kind === "evidence" ? (
          <>
            <b>Recorded {result.name}.</b>{" "}
            {result.registered.length
              ? `Evidence added to ${result.registered.length} requirement${result.registered.length === 1 ? "" : "s"} at ${result.stadium}; they are now in the review queue.`
              : `Kept on file for ${result.stadium}; no requirement was recorded.`}
            {result.alerts > 0 && ` ${result.alerts} alert${result.alerts === 1 ? "" : "s"} sent to ${result.owners.join(" and ")}.`}
          </>
        ) : (
          <>
            <b>Filed {result.name}.</b> It is now the current {result.kind === "progress-report" ? "progress report" : "plan"} for {result.stadium}.
            {result.checkStarted ? " The verification agent is checking it now." : " The check runs once a progress report and its plans are on file."}
          </>
        )}
      </div>
      <div className="ev-banner-links">
        {result.kind === "evidence" && result.registered.length > 0 && <Link href="/review">Open the review queue →</Link>}
        {result.stadiumId && <Link href={`/facilities/${result.stadiumId}`}>Open {result.stadium} →</Link>}
        {result.alerts > 0 && (
          <button type="button" className="linkish" onClick={() => go("alerts")}>
            See the alerts →
          </button>
        )}
        <button type="button" className="linkish" onClick={onClose}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

function Evidence() {
  useEffect(ensureIntake, []);
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [done, setDone] = useState(null);
  const c = evidenceCounts();
  const asked = params.get("tab");
  const stadium = params.get("stadium");
  const any = c.toConfirm + c.onFile + c.alerts + c.checks + intake.uploads.length > 0;
  const showChecks = c.checks > 0 || c.checkable > 0 || asked === "checks";
  const fallback = c.toConfirm > 0 ? "confirm" : c.onFile > 0 ? "onfile" : "confirm";
  const tab = TABS.includes(asked) && (asked !== "checks" || showChecks) ? asked : fallback;
  const go = (t, extra = "") => router.replace(`${path}?tab=${t}${extra}`, { scroll: false });
  const onDone = (result) => {
    setDone(result);
    if (result.failed) return;
    if (result.checkStarted) go("checks", `&stadium=${encodeURIComponent(result.stadiumId)}`);
    else if (c.toConfirm <= 1) go("onfile");
  };
  const tabs = [
    ["confirm", "To confirm", c.toConfirm],
    ["onfile", "On file", c.onFile],
    ["alerts", "Alerts", c.alerts],
    ...(showChecks ? [["checks", "Progress checks", c.checks]] : []),
  ];
  return (
    <>
      <PageHead
        chip="Evidence · contractor documents"
        title="Evidence"
        wideLead
        lead="Add a contractor's document. The agent reads it, checks it against the FIFA requirements in the register or against the plans, and shows what would change. Nothing is recorded until you confirm."
      />
      {intake.error && (
        <div className="ev-banner bad" role="alert">
          <div>
            <b>{intake.error}</b>
          </div>
          <button type="button" className="linkish" onClick={refreshIntake}>
            Try again
          </button>
        </div>
      )}
      <EvidenceDrop />
      <Done result={done} onClose={() => setDone(null)} go={go} />
      {!any && intake.loaded && (
        <div className="ev-how">
          <h3>What happens next</h3>
          <ul>
            <li>The agent reads each document and works out which stadium and which requirements it covers.</li>
            <li>It checks every figure against the register and the plans, and flags gaps, inconsistencies and claims the evidence does not support.</li>
            <li>You see what would change and confirm. Confirming records the evidence and alerts the owner of each gap.</li>
          </ul>
        </div>
      )}
      {any && (
        <>
          <div className="ev-tabs" role="tablist" aria-label="Evidence">
            {tabs.map(([id, label, count]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : undefined} onClick={() => go(id)}>
                {label}
                <span className="ev-count">{count}</span>
              </button>
            ))}
          </div>
          <div role="tabpanel" className="ev-panel">
            {tab === "confirm" && <EvidenceToConfirm onDone={onDone} />}
            {tab === "onfile" && <EvidenceOnFile />}
            {tab === "alerts" && <AlertsPanel />}
            {tab === "checks" && <ProgressChecks selected={stadium} onSelect={(id) => go("checks", `&stadium=${encodeURIComponent(id)}`)} />}
          </div>
        </>
      )}
      {!intake.loaded && !intake.error && <p className="muted">Loading…</p>}
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
