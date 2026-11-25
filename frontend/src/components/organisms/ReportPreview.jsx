"use client";

import { useState } from "react";
import { rowsFor } from "@/lib/reports/model.mjs";
import { sheetsOf } from "@/lib/reports/sheets.mjs";
import { num } from "@/lib/reports/text.mjs";
import { publicAssetUrl } from "@/lib/assets.mjs";

const PAPER_ROWS = 6;
const SHEET_ROWS = 10;
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const FIFA_COVER = publicAssetUrl("/reports/fifa-compliance-report-cover.png", BASE);

const show = (c, v) => (c.kind === "pct" && typeof v === "number" ? `${Math.round(v * 100)}%` : c.kind === "num" && typeof v === "number" ? num(v) : v ?? "");
const right = (c) => c.kind === "num" || c.kind === "year" || c.kind === "pct";

function Table({ block, columns, rows, hidden, grid }) {
  if (!rows.length) return <p className="muted small">{block.empty || "Nothing to show."}</p>;
  return (
    <div className={`rp-tablewrap${grid ? " grid" : ""}`}>
      {block.title && <p className="rp-table-title">{block.title}</p>}
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={right(c) ? "r" : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => {
                const tone = (c.kind === "tone" || c.tone || c.key === "value") && row[`${c.key}_tone`];
                return (
                  <td key={c.key} className={`${right(c) ? "r" : ""} ${tone ? `tone ${tone}` : ""}`.trim() || undefined}>
                    {show(c, row[c.key])}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {hidden > 0 && <p className="rp-more">+ {hidden} more row{hidden === 1 ? "" : "s"} in the file</p>}
    </div>
  );
}

function PaperBlock({ block, format }) {
  if (block.type === "kpis")
    return (
      <div className="rp-kpis">
        {block.items.map((k) => (
          <div key={k.label} className={`rp-kpi ${k.tone || ""}`.trim()}>
            <b>{k.value}</b>
            <span>{k.label}</span>
            <small>{k.sub}</small>
          </div>
        ))}
      </div>
    );
  if (block.type === "facts")
    return (
      <dl className="rp-facts">
        {block.items.map((f) => (
          <div key={f.label}>
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
    );
  if (block.type === "text") return <p className="rp-text">{block.text}</p>;
  if (block.type === "note") return <p className="rp-note">{block.text}</p>;
  const { rows, hidden } = rowsFor(block, format);
  const shown = rows.slice(0, PAPER_ROWS);
  return <Table block={block} columns={block.columns.filter((c) => !c.formats || c.formats.includes(format))} rows={shown} hidden={hidden + (rows.length - shown.length)} />;
}

function Paper({ report, format }) {
  return (
    <div className="rp-paper" role="region" aria-label="Report preview">
      <header>
        <h2>{report.title}</h2>
        <p>{report.scopeLine}</p>
        <p className="sub">{report.subtitle}</p>
      </header>
      {report.sections.map((s) => (
        <section key={s.id}>
          <h3>{s.title}</h3>
          {s.blocks.map((b, i) => (
            <PaperBlock key={i} block={b} format={format} />
          ))}
        </section>
      ))}
      <footer>Venue Compliance Hub · {report.generatedText}</footer>
    </div>
  );
}

function Sheets({ report }) {
  const sheets = sheetsOf(report);
  const [active, setActive] = useState(0);
  const sheet = sheets[Math.min(active, sheets.length - 1)];
  return (
    <div className="rp-sheets" role="region" aria-label="Workbook preview">
      <div className="rp-sheetbar" role="tablist" aria-label="Sheets">
        {sheets.map((s, i) => (
          <button key={s.name} type="button" role="tab" aria-selected={i === active} className={i === active ? "on" : undefined} onClick={() => setActive(i)}>
            {s.name}
          </button>
        ))}
      </div>
      <div className="rp-grid">
        {sheet.blocks.map((b, i) =>
          b.type === "text" ? (
            <p key={i} className={b.note ? "rp-note" : "rp-text"}>
              {b.text}
            </p>
          ) : (
            <Table key={i} block={b} columns={b.columns} rows={b.rows.slice(0, SHEET_ROWS)} hidden={Math.max(0, b.rows.length - SHEET_ROWS)} grid />
          ),
        )}
      </div>
    </div>
  );
}

function FifaCoverPreview({ report }) {
  return (
    <div className="rp-fifa-cover" role="img" aria-label="FIFA report cover preview">
      <img src={FIFA_COVER} alt="FIFA World Cup 2034 report cover" />
      <div className="rp-fifa-cover-title">FIFA Compliance Report</div>
      <div className="rp-fifa-cover-subject">{report.coverSubject || "Saudi Arabia · All stadiums"}</div>
    </div>
  );
}

/** What the file will contain: a page for Word and PDF, sheets for Excel. Long tables show their first rows. */
export default function ReportPreview({ report, format }) {
  if (format === "xlsx") return <Sheets report={report} />;
  if (report.kind === "fifa") {
    return (
      <div className="rp-fifa-preview">
        <FifaCoverPreview report={report} />
        <Paper report={report} format={format} />
      </div>
    );
  }
  return <Paper report={report} format={format} />;
}
