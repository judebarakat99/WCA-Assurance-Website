"use client";

import { useEffect, useMemo, useState } from "react";
import PageHead from "@/components/molecules/PageHead";
import ReportExportBar from "@/components/organisms/ReportExportBar";
import ReportOptions from "@/components/organisms/ReportOptions";
import ReportPreview from "@/components/organisms/ReportPreview";
import PageTemplate from "@/components/templates/PageTemplate";
import { loadReportData } from "@/lib/reports/data.js";
import { downloadReport } from "@/lib/reports/export.js";
import { FORMATS, SCOPES, buildReport, isComplete, narrowFor } from "@/lib/reports/model.mjs";
import { ensureIntake, filedDocuments } from "@/lib/store/intake";
import { getVersion } from "@/lib/store/state";

function Reports() {
  useEffect(ensureIntake, []);
  const [choice, setChoice] = useState({ format: null, scope: null, target: "", narrow: "" });
  const [status, setStatus] = useState({ busy: false, saved: null, error: null });
  const { format, scope, target, narrow } = choice;

  // Rebuilt whenever any store changes, so a report always matches the other pages.
  const version = getVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data = useMemo(() => loadReportData({ documents: filedDocuments() }), [version]);

  const scopeInfo = SCOPES.find((s) => s.id === scope);
  const narrowInfo = scope ? narrowFor(scope, data) : null;
  const config = {
    scope,
    target: target || null,
    narrow: narrow && narrowInfo ? { kind: narrowInfo.kind, id: narrow } : null,
  };
  const ready = !!format && isComplete(config);
  const report = useMemo(
    () => (ready ? buildReport(config, data) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, scope, target, narrow, data],
  );
  const formatInfo = FORMATS.find((f) => f.id === format);
  const missing = [];
  if (!format) missing.push("a format");
  if (!scope) missing.push("what the report is for");
  else if (scopeInfo.targetLabel && !target) missing.push(`a ${scopeInfo.targetLabel.toLowerCase()}`);

  const change = (patch) => {
    setChoice((c) => ({ ...c, ...patch }));
    setStatus({ busy: false, saved: null, error: null });
  };
  async function exportNow() {
    setStatus({ busy: true, saved: null, error: null });
    try {
      setStatus({ busy: false, saved: await downloadReport(report, format), error: null });
    } catch (e) {
      setStatus({ busy: false, saved: null, error: e?.message || "The file could not be created." });
    }
  }

  return (
    <>
      <PageHead
        chip="Reports · export"
        title="Reports"
        wideLead
        lead="Create a compliance report for the programme, a host city, a stadium, a chapter of the FIFA stadium book or an owner, or an oversight report on contractor reporting, or one executive report for leadership. Choose a format and what the report is for; a preview appears and Export is enabled once both are chosen."
      />
      <ReportOptions choice={choice} onChange={change} data={data} />
      <ReportExportBar report={report} formatInfo={formatInfo} missing={missing} {...status} onExport={exportNow} />
      {report && (
        <section className="rp-block" aria-labelledby="rp-preview">
          <h2 id="rp-preview">Preview</h2>
          <p className="muted small">
            {format === "xlsx"
              ? "The sheets in the workbook. Long tables show their first rows here and all rows in the file."
              : "The contents of the document. Long tables show their first rows here; page breaks in the file can differ."}
          </p>
          <ReportPreview report={report} format={format} />
        </section>
      )}
    </>
  );
}

export default function ReportsPage() {
  return <PageTemplate label="Reports">{() => <Reports />}</PageTemplate>;
}
