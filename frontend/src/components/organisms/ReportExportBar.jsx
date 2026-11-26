"use client";

const list = (items) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items.at(-1)}` : items[0] || "");

/**
 * The bar under the options: what will be exported (or what is still missing), the result of the last export,
 * and the Export button.
 */
export default function ReportExportBar({ report, formatInfo, missing, busy, saved, error, onExport }) {
  return (
    <div className="rp-bar" role="group" aria-label="Export">
      <div>
        {report ? (
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
      <button type="button" className="primary" disabled={!report || busy} onClick={onExport}>
        {busy ? "Preparing…" : report ? `Export ${formatInfo.label}` : "Export"}
      </button>
    </div>
  );
}
