// PDF rendering of a report model (A4 landscape), with jsPDF and AutoTable.
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { DOC_ROW_LIMIT, cellText, cellTone } from "@/lib/domain/report.mjs";
import { BAND, INK, LINE, MUTED, NAVY, TONE, rgb } from "@/lib/export/style";

const M = 14; // page margin, mm

// PDF's built-in fonts only cover Windows-1252; spell out the few symbols outside it.
const SAFE = { "≥": ">=", "≤": "<=", "→": "->", "←": "<-", "−": "-", "✓": "yes", "≠": "!=" };
const safe = (t) => String(t ?? "").replace(/[≥≤→←−✓≠]/g, (ch) => SAFE[ch]);

/** Render the report model as a PDF Blob. */
export async function reportToPdf(model) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const width = W - 2 * M;
  let y = M;
  const ensure = (needed) => {
    if (y + needed > H - 16) {
      doc.addPage();
      y = M;
    }
  };
  const write = (text, { size = 9, color = INK, bold = false, gap = 1.5 } = {}) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...rgb(color));
    const lines = doc.splitTextToSize(safe(text), width);
    const lh = size * 0.42;
    ensure(lines.length * lh);
    doc.text(lines, M, y + lh * 0.8);
    y += lines.length * lh + gap;
  };
  const heading = (title, subtitle) => {
    ensure(22);
    y += 4;
    write(title, { size: 13, color: NAVY, bold: true, gap: 1 });
    if (subtitle) write(subtitle, { size: 8.5, color: MUTED, gap: 2 });
  };

  // Title band
  doc.setFillColor(...rgb(NAVY));
  doc.rect(M, y, width, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(safe(model.title), M + 7, y + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.text(safe(model.subtitle), M + 7, y + 16.5);
  doc.setFontSize(8);
  doc.setTextColor(217, 220, 235);
  doc.text(`${model.app} · ${model.dateLabel}`, M + 7, y + 21.5);
  y += 30;

  for (const s of model.sections) {
    if (s.type === "kpis") {
      heading(s.title);
      const gap = 3;
      const w = (width - gap * (s.items.length - 1)) / s.items.length;
      ensure(24);
      s.items.forEach((k, i) => {
        const t = TONE[k.tone] || TONE.mute;
        const x = M + i * (w + gap);
        doc.setFillColor(...rgb(t.fill));
        doc.rect(x, y, w, 21, "F");
        doc.setFillColor(...rgb(t.text));
        doc.rect(x, y, 1.2, 21, "F");
        doc.setTextColor(...rgb(t.text));
        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.text(doc.splitTextToSize(safe(k.value), w - 6)[0], x + 4, y + 8);
        doc.setTextColor(...rgb(INK));
        doc.setFontSize(8);
        doc.text(doc.splitTextToSize(safe(k.label), w - 6)[0], x + 4, y + 13.5);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...rgb(MUTED));
        doc.text(doc.splitTextToSize(safe(k.note), w - 6)[0] || "", x + 4, y + 17.5);
      });
      y += 25;
    } else if (s.type === "text") {
      write(s.text, { size: 9.5, gap: 3 });
    } else if (s.type === "table") {
      heading(s.title, s.subtitle);
      const total = s.columns.reduce((t, c) => t + (c.width || 10), 0);
      const rows = s.rows.slice(0, DOC_ROW_LIMIT);
      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M, bottom: 16 },
        head: [s.columns.map((c) => safe(c.label))],
        body: rows.map((row) => s.columns.map((c) => safe(cellText(row[c.key])))),
        theme: "grid",
        styles: { font: "helvetica", fontSize: 7.2, cellPadding: 1.6, textColor: rgb(INK), lineColor: rgb(LINE), lineWidth: 0.15, overflow: "linebreak" },
        headStyles: { fillColor: rgb(NAVY), textColor: [255, 255, 255], fontStyle: "bold", valign: "middle" },
        alternateRowStyles: { fillColor: rgb(BAND) },
        columnStyles: Object.fromEntries(
          s.columns.map((c, i) => [i, { cellWidth: ((c.width || 10) / total) * width, halign: c.align === "center" ? "center" : "left" }]),
        ),
        didParseCell: (d) => {
          if (d.section !== "body") return;
          const tone = cellTone(rows[d.row.index][s.columns[d.column.index].key]);
          if (tone) {
            d.cell.styles.fillColor = rgb(TONE[tone].fill);
            d.cell.styles.textColor = rgb(TONE[tone].text);
            d.cell.styles.fontStyle = "bold";
          }
        },
      });
      y = doc.lastAutoTable.finalY + 3;
      if (!s.rows.length) write("None.", { size: 8.5, color: MUTED });
      if (s.rows.length > rows.length)
        write(`Showing the first ${rows.length} of ${s.rows.length} rows. The Excel workbook has the full list.`, { size: 8, color: MUTED });
    }
  }
  heading("About this report");
  for (const a of model.about) write(a, { size: 8, color: MUTED, gap: 2 });

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...rgb(LINE));
    doc.line(M, H - 11, W - M, H - 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...rgb(MUTED));
    doc.text(`${model.app} · ${model.dateLabel}`, M, H - 7);
    doc.text(`Page ${i} of ${pages}`, W - M, H - 7, { align: "right" });
  }
  return doc.output("blob");
}
