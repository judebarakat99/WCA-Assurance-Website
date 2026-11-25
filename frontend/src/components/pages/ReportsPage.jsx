"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PageHead from "@/components/molecules/PageHead";
import ReportPreview from "@/components/organisms/ReportPreview";
import PageTemplate from "@/components/templates/PageTemplate";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";
import { PILLARS } from "@/lib/domain/cityAssurance.mjs";
import { REPORT_KINDS, buildReport } from "@/lib/domain/report.mjs";
import { FORMATS, exportReport } from "@/lib/export";
import { getAssessments, hasSampleAssessments } from "@/lib/store/assessments";
import { ensureIntake, intake } from "@/lib/store/intake";
import { toast } from "@/lib/ui/toast";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function Choice({ selected, onClick, title, hint, tag }) {
  return (
    <button type="button" className={`rpt-choice ${selected ? "on" : ""}`.trim()} aria-pressed={selected} onClick={onClick}>
      {tag && <span className="rpt-tag">{tag}</span>}
      <b>{title}</b>
      <span>{hint}</span>
    </button>
  );
}

function Scope({ kind, scope, setScope }) {
  const set = (k) => (e) => setScope({ ...scope, [k]: e.target.value || null });
  if (kind === "city")
    return (
      <label className="f rpt-scope">
        Host city
        <select value={scope.cityId || ""} onChange={set("cityId")}>
          <option value="">Choose a city…</option>
          {FACILITY_REGISTER.hostCities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
    );
  if (kind === "stadium")
    return (
      <label className="f rpt-scope">
        Stadium
        <select value={scope.stadiumId || ""} onChange={set("stadiumId")}>
          <option value="">Choose a stadium…</option>
          {FACILITY_REGISTER.stadiums.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
    );
  if (kind === "contractor" || kind === "executive") return null;
  return (
    <label className="f rpt-scope">
      {kind === "area" ? "Chapter" : "Limit to one chapter (optional)"}
      <select value={scope.area || ""} onChange={set("area")}>
        <option value="">{kind === "area" ? "Choose a chapter…" : "No limit"}</option>
        {PILLARS.filter((p) => p.id).map((p) => (
          <option key={p.id} value={p.id}>
            {p.number} {p.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Reports() {
  useEffect(ensureIntake, []);
  const [format, setFormat] = useState(null);
  const [kind, setKind] = useState(null);
  const [scope, setScope] = useState({});
  const [busy, setBusy] = useState(false);
  const model = kind
    ? buildReport(kind, scope, {
        records: getAssessments(),
        checks: intake.checks,
        documents: intake.documents,
        sample: hasSampleAssessments(),
        date: today(),
      })
    : null;
  const ready = format && model;
  const pick = (k) => {
    setKind(k);
    setScope({});
  };
  const missing = !format ? "a format" : !kind ? "what the report is for" : !model ? "the scope above" : null;

  async function run() {
    setBusy(true);
    try {
      const name = await exportReport(model, format);
      toast(`Downloaded ${name}`);
    } catch (error) {
      toast(`Export failed: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  const groups = [
    ["compliance", "Compliance reports"],
    ["oversight", "Oversight and leadership"],
  ];
  return (
    <>
      <PageHead
        chip="Reports · export"
        title="Reports"
        wideLead
        lead="Create a compliance report for the programme, a host city, a stadium or a chapter of the FIFA stadium book, or an oversight report on contractor reporting, or an executive report for leadership. Choose a format and what the report is for; a preview appears below, and Export is enabled once both are chosen."
      />
      {!hasSampleAssessments() && !Object.values(getAssessments()).some((a) => a.review) && (
        <p className="block intake-alert small">
          No reviewed assessments are recorded yet, so reports will be mostly empty. For a demonstration, use{" "}
          <Link href="/">Load sample data on the map</Link> first.
        </p>
      )}
      <h3 className="rpt-h">Format</h3>
      <div className="rpt-grid three">
        {Object.entries(FORMATS).map(([id, f]) => (
          <Choice key={id} selected={format === id} onClick={() => setFormat(id)} title={f.label} hint={f.hint} tag={f.ext.toUpperCase()} />
        ))}
      </div>
      <h3 className="rpt-h">Report for</h3>
      {groups.map(([g, label]) => (
        <div key={g}>
          <span className="rpt-group">{label}</span>
          <div className="rpt-grid">
            {Object.entries(REPORT_KINDS)
              .filter(([, k]) => k.group === g)
              .map(([id, k]) => (
                <Choice key={id} selected={kind === id} onClick={() => pick(id)} title={k.label} hint={k.hint} />
              ))}
          </div>
        </div>
      ))}
      {kind && <Scope kind={kind} scope={scope} setScope={setScope} />}
      <div className="rpt-bar" role="region" aria-label="Export">
        <div>
          {ready ? (
            <>
              <b>{model.title}</b>
              <span className="muted small">
                {FORMATS[format].label} · {model.subtitle} · {model.dateLabel}
              </span>
            </>
          ) : (
            <span className="muted">Choose {missing} to enable export.</span>
          )}
        </div>
        <button type="button" className="primary" disabled={!ready || busy} onClick={run}>
          {busy ? "Preparing…" : ready ? `Export ${FORMATS[format].label}` : "Export"}
        </button>
      </div>
      {model && (
        <section className="rpt-preview" aria-labelledby="rpt-preview">
          <h3 className="rpt-h" id="rpt-preview">
            Preview
          </h3>
          <p className="muted small">
            The contents of the report. Long tables show their first rows here and in Word and PDF; page breaks in the file can
            differ.
          </p>
          <ReportPreview model={model} />
        </section>
      )}
    </>
  );
}

export default function ReportsPage() {
  return <PageTemplate label="Reports">{() => <Reports />}</PageTemplate>;
}
