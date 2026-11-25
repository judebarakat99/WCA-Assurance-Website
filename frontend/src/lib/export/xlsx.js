// Excel (.xlsx) rendering of a report model: a Summary sheet, then one sheet
// per table with every row, a filter and a frozen header.
import ExcelJS from "exceljs";
import { cellText, cellTone } from "@/lib/domain/report.mjs";
import { BAND, LINE, MUTED, NAVY, TONE } from "@/lib/export/style";

const argb = (hex) => `FF${hex}`;
const fill = (hex) => ({ type: "pattern", pattern: "solid", fgColor: { argb: argb(hex) } });
const border = { style: "thin", color: { argb: argb(LINE) } };

// Numbers stay numbers so they can be sorted and summed.
function value(c) {
  const t = cellText(c);
  return t !== "" && /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : t;
}

function sheetName(title, used) {
  let name = title.replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "Sheet";
  for (let i = 2; used.has(name); i++) name = `${name.slice(0, 28)} ${i}`;
  used.add(name);
  return name;
}

/** Render the report model as an .xlsx Blob. */
export async function reportToXlsx(model) {
  const wb = new ExcelJS.Workbook();
  wb.creator = model.app;
  wb.title = model.title;
  const used = new Set();

  const sum = wb.addWorksheet(sheetName("Summary", used), { views: [{ showGridLines: false }] });
  sum.columns = [{ width: 30 }, { width: 18 }, { width: 44 }];
  const title = sum.addRow([model.title]);
  title.font = { size: 18, bold: true, color: { argb: argb("FFFFFF") } };
  sum.mergeCells(title.number, 1, title.number, 3);
  title.getCell(1).fill = fill(NAVY);
  title.height = 30;
  const sub = sum.addRow([`${model.subtitle} · ${model.app} · ${model.dateLabel}`]);
  sum.mergeCells(sub.number, 1, sub.number, 3);
  sub.getCell(1).fill = fill(NAVY);
  sub.font = { color: { argb: argb("D9DCEB") } };
  sum.addRow([]);
  for (const s of model.sections) {
    if (s.type === "kpis") {
      sum.addRow([s.title]).font = { bold: true, size: 13, color: { argb: argb(NAVY) } };
      for (const k of s.items) {
        const r = sum.addRow([k.label, value(k.value), k.note || ""]);
        const t = TONE[k.tone] || TONE.mute;
        r.getCell(2).font = { bold: true, size: 13, color: { argb: argb(t.text) } };
        r.getCell(2).fill = fill(t.fill);
        r.getCell(2).alignment = { horizontal: "center" };
        r.getCell(3).font = { color: { argb: argb(MUTED) } };
      }
      sum.addRow([]);
    } else if (s.type === "text") {
      const r = sum.addRow([s.text]);
      sum.mergeCells(r.number, 1, r.number, 3);
      r.getCell(1).alignment = { wrapText: true, vertical: "top" };
      r.height = Math.max(30, Math.ceil(s.text.length / 95) * 16);
      sum.addRow([]);
    }
  }
  const tables = model.sections.filter((s) => s.type === "table");
  sum.addRow(["Sheets"]).font = { bold: true, size: 13, color: { argb: argb(NAVY) } };
  for (const t of tables) sum.addRow([t.title, `${t.rows.length} rows`, t.subtitle || ""]);
  sum.addRow([]);
  sum.addRow(["About this report"]).font = { bold: true, size: 13, color: { argb: argb(NAVY) } };
  for (const a of model.about) {
    const r = sum.addRow([a]);
    sum.mergeCells(r.number, 1, r.number, 3);
    r.getCell(1).alignment = { wrapText: true, vertical: "top" };
    r.getCell(1).font = { color: { argb: argb(MUTED) } };
    r.height = Math.max(16, Math.ceil(a.length / 95) * 15);
  }

  for (const t of tables) {
    const ws = wb.addWorksheet(sheetName(t.title, used), { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = t.columns.map((c) => ({ header: c.label, key: c.key, width: Math.max(10, Math.round((c.width || 10) * 1.6)) }));
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: argb("FFFFFF") } };
    head.fill = fill(NAVY);
    head.alignment = { vertical: "middle", wrapText: true };
    head.height = 30;
    t.rows.forEach((row, i) => {
      const r = ws.addRow(t.columns.map((c) => value(row[c.key])));
      t.columns.forEach((c, j) => {
        const cellRef = r.getCell(j + 1);
        const tone = cellTone(row[c.key]);
        cellRef.border = { top: border, bottom: border, left: border, right: border };
        cellRef.alignment = { vertical: "top", wrapText: true, horizontal: c.align === "center" ? "center" : "left" };
        if (tone) {
          cellRef.fill = fill(TONE[tone].fill);
          cellRef.font = { bold: true, color: { argb: argb(TONE[tone].text) } };
        } else if (i % 2) cellRef.fill = fill(BAND);
      });
    });
    if (t.rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: t.rows.length + 1, column: t.columns.length } };
  }
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
