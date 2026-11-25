"use client";

import { useEffect, useMemo, useState } from "react";
import PageHead from "@/components/molecules/PageHead";
import ReportPreview from "@/components/organisms/ReportPreview";
import PageTemplate from "@/components/templates/PageTemplate";
import { loadReportData } from "@/lib/reports/data.js";
import { downloadReport } from "@/lib/reports/export.js";
import { FORMATS, SCOPES, SCOPE_GROUPS, buildReport, isComplete, narrowFor, targetsFor } from "@/lib/reports/model.mjs";
import { ensureIntake, filedDocuments } from "@/lib/store/intake";
import { getVersion } from "@/lib/store/state";

const list = (items) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items.at(-1)}` : items[0] || "");

function Choice({ checked, onClick, title, hint, badge }) {
  return (
    <button type="button" role="radio" aria-checked={checked} className={`rp-choice${checked ? " on" : ""}`} onClick={onClick}>
      {badge && <span className="rp-badge">{badge}</span>}
      <b>{title}</b>
      <span className="muted small">{hint}</span>
    </button>
  );
}

function Reports() {
  useEffect(ensureIntake, []);
  const [format, setFormat] = useState(null);
  const [scope, setScope] = useState(null);
  const [target, setTarget] = useState("");
  const [narrow, setNarrow] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);

  const version = getVersion();
  const documents = filedDocuments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data = useMemo(() => loadReportData({ documents }), [version]);

  const scopeInfo = SCOPES.find((s) => s.id === scope);
  const narrowInfo = scope ? narrowFor(scope, data) : null;
  const config = { scope, target: target || null, narrow: narrow && narrowInfo ? { kind: narrowInfo.kind, id: narrow } : null };
  const ready = !!format && isComplete(config);
  const report = useMemo(
    () => (ready ? buildReport(config, data) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, format, scope, target, narrow, data],
  );
  const formatInfo = FORMATS.find((f) => f.id === format);

  const missing = [];
  if (!format) missing.push("a format");
  if (!scope) missing.push("what the report is for");
  else if (scopeInfo.targetLabel && !target) missing.push(`a ${scopeInfo.targetLabel.toLowerCase()}`);

  const pick = (setter) => (value) => {
    setter(value);
    setSaved(null);
    setError(null);
  };
  const exportNow = async () => {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      setSaved(await downloadReport(report, format));
    } catch (e) {
      setError(e?.message || "The file could not be created.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead
        chip="Reports · export"
        title="Reports"
        wideLead
        lead="Create a compliance report for the programme, a host city, a stadium, a chapter of the FIFA stadium book or an owner, or an oversight report on contractor reporting, or one executive report for leadership. Choose a format and what the report is for; a preview appears and Export is enabled once both are chosen."
      />

      <section className="rp-block" aria-labelledby="rp-format">
        <h2 id="rp-format">Format</h2>
        <div className="rp-choices" role="radiogroup" aria-labelledby="rp-format">
          {FORMATS.map((f) => (
            <Choice key={f.id} checked={format === f.id} onClick={() => pick(setFormat)(f.id)} title={f.label} hint={f.hint} badge={f.ext.toUpperCase()} />
          ))}
        </div>
      </section>

      <section className="rp-block" aria-labelledby="rp-scope">
        <h2 id="rp-scope">Report for</h2>
        <div role="radiogroup" aria-labelledby="rp-scope" className="rp-groups">
          {SCOPE_GROUPS.map((g) => (
            <div key={g.id} className="rp-group">
              <h3 className="rp-group-title">{g.label}</h3>
              <div className="rp-choices five">
                {SCOPES.filter((s) => (s.group || "compliance") === g.id).map((s) => (
                  <Choice
                    key={s.id}
                    checked={scope === s.id}
                    onClick={() => {
                      pick(setScope)(s.id);
                      setTarget("");
                      setNarrow("");
                    }}
                    title={s.label}
                    hint={s.hint}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        {scope && (scopeInfo.targetLabel || narrowInfo) && (
          <div className="rp-selects">
            {scopeInfo.targetLabel && (
              <label className="f">
                {scopeInfo.targetLabel}
                <select value={target} onChange={(e) => pick(setTarget)(e.target.value)}>
                  <option value="">Choose…</option>
                  {targetsFor(scope, data).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {narrowInfo && (
              <label className="f">
                {narrowInfo.label} (optional)
                <select value={narrow} onChange={(e) => pick(setNarrow)(e.target.value)}>
                  <option value="">No limit</option>
                  {narrowInfo.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}
      </section>

      <div className="rp-bar" role="group" aria-label="Export">
        <div>
          {ready ? (
            <>
              <b>{report.title}</b>
              <span className="muted small">
                {formatInfo.label} · {report.scopeLine} · {report.generatedText}
              </span>
            </>
          ) : (
            <span className="muted">Choose {list(missing)} to enable export.</span>
          )}
          {saved && (
            <span className="small rp-saved" role="status">
              Saved as {saved}
            </span>
          )}
          {error && (
            <span className="small rp-error" role="alert">
              {error}
            </span>
          )}
        </div>
        <button type="button" className="primary ev-cta" disabled={!ready || busy} onClick={exportNow}>
          {busy ? "Preparing…" : ready ? `Export ${formatInfo.label}` : "Export"}
        </button>
      </div>

      {ready && (
        <section className="rp-block" aria-labelledby="rp-preview">
          <h2 id="rp-preview">Preview</h2>
          <p className="muted small">
            {format === "xlsx" ? "The sheets in the workbook. Long tables show their first rows here and all rows in the file." : "The contents of the document. Long tables show their first rows here; page breaks in the file can differ."}
          </p>
          <ReportPreview report={report} format={format} />
        </section>
      )}
    </>
  );
}

export default function ReportsPage() {
  return (
    <PageTemplate label="Reports">
      {() => <Reports />}
    </PageTemplate>
  );
}
