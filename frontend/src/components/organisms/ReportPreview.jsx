"use client";

import { DOC_ROW_LIMIT, cellText, cellTone } from "@/lib/domain/report.mjs";

function Kpis({ section }) {
  return (
    <>
      <h3>{section.title}</h3>
      <div className="rp-kpis">
        {section.items.map((k) => (
          <div key={k.label} className={`rp-kpi ${k.tone || "mute"}`}>
            <b>{k.value}</b>
            <span>{k.label}</span>
            <small>{k.note}</small>
          </div>
        ))}
      </div>
    </>
  );
}

function Table({ section }) {
  const rows = section.rows.slice(0, DOC_ROW_LIMIT);
  return (
    <>
      <h3>{section.title}</h3>
      {section.subtitle && <p className="rp-sub">{section.subtitle}</p>}
      <div className="rp-tablewrap">
        <table>
          <thead>
            <tr>
              {section.columns.map((c) => (
                <th key={c.key} className={c.align === "center" ? "c" : undefined}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {section.columns.map((c) => {
                  const tone = cellTone(row[c.key]);
                  return (
                    <td key={c.key} className={[c.align === "center" ? "c" : "", tone ? `t-${tone}` : ""].join(" ").trim() || undefined}>
                      {cellText(row[c.key])}
                    </td>
                  );
                })}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={section.columns.length} className="rp-none">
                  None.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {section.rows.length > rows.length && (
        <p className="rp-sub">
          Showing the first {rows.length} of {section.rows.length} rows. The Excel workbook has the full list.
        </p>
      )}
    </>
  );
}

/** On-screen preview of a report model, laid out like the Word and PDF exports. */
export default function ReportPreview({ model }) {
  return (
    <article className="rp-paper" aria-label={`Preview: ${model.title}`}>
      <header className="rp-banner">
        <h2>{model.title}</h2>
        <p>{model.subtitle}</p>
        <small>
          {model.app} · {model.dateLabel}
        </small>
      </header>
      {model.sections.map((s, i) =>
        s.type === "kpis" ? (
          <Kpis key={i} section={s} />
        ) : s.type === "text" ? (
          <p key={i} className="rp-text">
            {s.text}
          </p>
        ) : (
          <Table key={i} section={s} />
        ),
      )}
      <h3>About this report</h3>
      {model.about.map((a) => (
        <p key={a} className="rp-about">
          {a}
        </p>
      ))}
    </article>
  );
}
