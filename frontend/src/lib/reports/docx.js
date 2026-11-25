// The Word document, built with the docx library. A4 landscape (the tables are wide), a branded title block,
// KPI tiles, tables with a repeating header row, status cells in the same colours as on screen, and a footer with
// the date and page numbers.
import {
  AlignmentType, BorderStyle, Document, Footer, Packer, PageNumber, PageOrientation, Paragraph, ShadingType,
  Table, TableCell, TableLayoutType, TableRow, TextRun, VerticalAlign, WidthType,
} from "docx";
import { columnsFor, rowsFor } from "@/lib/reports/model.mjs";
import { num } from "@/lib/reports/text.mjs";

const BLUE = "2E3569";
const GREY = "5A5F80";
const INK = "1F2330";
const TONE = { good: ["E2F2E3", "2F7D37"], warn: ["FDEEDB", "B45F06"], bad: ["FDE4E0", "C9301E"], info: ["E6E8F3", "2E3569"], mute: ["ECEEF6", "5A5F80"] };
const FONT = "Arial";
const WIDTH = 15038; // A4 landscape (16838) minus 2 × 900 margins, in twentieths of a point
const line = { style: BorderStyle.SINGLE, size: 4, color: "D6DAE8" };
const borders = { top: line, bottom: line, left: line, right: line };
const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: none, bottom: none, left: none, right: none };

const run = (text, o = {}) => new TextRun({ text: String(text), font: FONT, size: o.size || 18, bold: o.bold, italics: o.italics, color: o.color || INK });
const para = (children, o = {}) => new Paragraph({ children: Array.isArray(children) ? children : [children], spacing: { before: o.before ?? 0, after: o.after ?? 0, line: o.line }, alignment: o.align, keepNext: o.keepNext });

function cell(children, { width, fill, borders: b = borders, margins = { top: 60, bottom: 60, left: 90, right: 90 }, valign = VerticalAlign.TOP, span } = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: fill ? { type: ShadingType.CLEAR, color: "auto", fill } : undefined,
    borders: b,
    margins,
    verticalAlign: valign,
    columnSpan: span,
    children,
  });
}
const table = (widths, rows) => new Table({ width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED, rows });

function titleBlock(report) {
  return table([WIDTH], [
    new TableRow({
      children: [
        cell(
          [
            para(run(report.title, { size: 40, bold: true, color: "FFFFFF" }), { after: 80 }),
            para(run(report.scopeLine, { size: 22, color: "E6E8F3" }), { after: 40 }),
            para(run(report.subtitle, { size: 18, color: "C8CCE6" })),
          ],
          { width: WIDTH, fill: BLUE, borders: noBorders, margins: { top: 260, bottom: 260, left: 300, right: 300 } },
        ),
      ],
    }),
  ]);
}

function kpiBlock(block) {
  const n = block.items.length;
  const w = Math.floor(WIDTH / n);
  const widths = Array(n).fill(w);
  widths[n - 1] += WIDTH - w * n;
  return table(widths, [
    new TableRow({
      cantSplit: true,
      children: block.items.map((k, i) => {
        const [fill, color] = TONE[k.tone] || TONE.mute;
        return cell(
          [para(run(k.value, { size: 40, bold: true, color }), { after: 20 }), para(run(k.label, { size: 18, bold: true }), { after: 10 }), para(run(k.sub || "", { size: 15, color: GREY }))],
          { width: widths[i], fill, borders: { ...noBorders, left: { style: BorderStyle.SINGLE, size: 24, color: "FFFFFF" }, right: { style: BorderStyle.SINGLE, size: 24, color: "FFFFFF" } }, margins: { top: 140, bottom: 140, left: 160, right: 120 } },
        );
      }),
    }),
  ]);
}

function factsBlock(block) {
  const a = 2600;
  return table([a, WIDTH - a], block.items.map((f) => new TableRow({ cantSplit: true, children: [cell([para(run(f.label, { bold: true, color: GREY }))], { width: a }), cell([para(run(f.value))], { width: WIDTH - a })] })));
}

function tableBlock(block) {
  const columns = columnsFor(block, "docx");
  const { rows, hidden } = rowsFor(block, "docx");
  const total = columns.reduce((a, c) => a + c.w, 0);
  const widths = columns.map((c) => Math.floor((c.w / total) * WIDTH));
  widths[widths.length - 1] += WIDTH - widths.reduce((a, b) => a + b, 0);
  const alignOf = (c) => (c.kind === "num" || c.kind === "year" || c.kind === "pct" ? AlignmentType.RIGHT : AlignmentType.LEFT);
  const show = (c, v) => (c.kind === "pct" ? `${Math.round(v * 100)}%` : c.kind === "num" && typeof v === "number" ? num(v) : v ?? "");
  const out = [];
  if (block.title) out.push(para(run(block.title, { size: 22, bold: true, color: BLUE }), { before: 160, after: 80, keepNext: true }));
  if (!rows.length) {
    out.push(para(run(block.empty || "Nothing to show.", { italics: true, color: GREY }), { after: 80 }));
    return out;
  }
  out.push(
    table(widths, [
      new TableRow({ tableHeader: true, cantSplit: true, children: columns.map((c, i) => cell([para(run(c.label, { bold: true, color: "FFFFFF", size: 17 }), { align: alignOf(c) })], { width: widths[i], fill: BLUE, valign: VerticalAlign.CENTER })) }),
      ...rows.map(
        (row, r) =>
          new TableRow({
            cantSplit: true,
            children: columns.map((c, i) => {
              const toneKey = row[`${c.key}_tone`];
              const tone = (c.kind === "tone" || c.tone) && toneKey ? TONE[toneKey] : null;
              return cell([para(run(show(c, row[c.key]), { size: 17, bold: !!tone, color: tone ? tone[1] : INK }), { align: alignOf(c) })], { width: widths[i], fill: tone ? tone[0] : r % 2 ? "F6F7FB" : "FFFFFF" });
            }),
          }),
      ),
    ]),
  );
  if (hidden) out.push(para(run(`Showing the first ${rows.length} of ${rows.length + hidden} rows. The Excel workbook has the full list.`, { italics: true, color: GREY, size: 16 }), { before: 60, after: 60 }));
  return out;
}

/** The document as bytes (a Uint8Array). */
export async function renderDocx(report) {
  const children = [titleBlock(report), para(run(""), { after: 120 })];
  for (const section of report.sections) {
    children.push(para(run(section.title, { size: 30, bold: true, color: BLUE }), { before: 280, after: 100, keepNext: true }));
    for (const b of section.blocks) {
      if (b.type === "kpis") children.push(kpiBlock(b), para(run(""), { after: 60 }));
      else if (b.type === "facts") children.push(factsBlock(b), para(run(""), { after: 60 }));
      else if (b.type === "text") children.push(para(run(b.text, { size: 21 }), { before: 80, after: 100, line: 300 }));
      else if (b.type === "note") children.push(para(run(b.text, { size: 17, color: GREY }), { after: 80 }));
      else children.push(...tableBlock(b));
    }
  }
  const doc = new Document({
    creator: "Venue Compliance Hub",
    title: report.title,
    description: report.scopeLine,
    styles: { default: { document: { run: { font: FONT, size: 18 } } } },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE }, margin: { top: 900, bottom: 900, left: 900, right: 900 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                tabStops: [{ type: "right", position: WIDTH }],
                children: [
                  run(`Venue Compliance Hub · ${report.generatedText}`, { size: 15, color: GREY }),
                  new TextRun({ text: "\tPage ", font: FONT, size: 15, color: GREY }),
                  new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 15, color: GREY }),
                  new TextRun({ text: " of ", font: FONT, size: 15, color: GREY }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 15, color: GREY }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  return new Uint8Array(await Packer.toArrayBuffer(doc));
}
