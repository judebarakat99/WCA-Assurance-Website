// Word (.docx) rendering of a report model.
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { DOC_ROW_LIMIT, cellText, cellTone } from "@/lib/domain/report.mjs";
import { BAND, INK, LINE, MUTED, NAVY, TONE } from "@/lib/export/style";

const FONT = "Calibri";
const PAGE_WIDTH = 15137; // A4 landscape minus 1.5 cm margins, in twips
const shade = (fill) => ({ type: ShadingType.CLEAR, color: "auto", fill });
const thin = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const run = (text, o = {}) => new TextRun({ text: String(text), font: FONT, size: o.size || 18, bold: o.bold, color: o.color || INK, italics: o.italics });
const para = (children, o = {}) => new Paragraph({ children: [].concat(children), spacing: { before: o.before ?? 0, after: o.after ?? 0 }, alignment: o.align, keepNext: o.keepNext });

function banner(model) {
  return new Table({
    width: { size: PAGE_WIDTH, type: WidthType.DXA },
    columnWidths: [PAGE_WIDTH],
    borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: shade(NAVY),
            margins: { top: 240, bottom: 240, left: 320, right: 320 },
            children: [
              para(run(model.title, { size: 36, bold: true, color: "FFFFFF" })),
              para(run(model.subtitle, { size: 22, color: "FFFFFF" }), { before: 60 }),
              para(run(`${model.app} · ${model.dateLabel}`, { size: 17, color: "D9DCEB" }), { before: 40 }),
            ],
          }),
        ],
      }),
    ],
  });
}

function heading(title, subtitle) {
  return [
    para(run(title, { size: 26, bold: true, color: NAVY }), { before: 280, after: subtitle ? 40 : 120, keepNext: true }),
    ...(subtitle ? [para(run(subtitle, { size: 18, color: MUTED }), { after: 120, keepNext: true })] : []),
  ];
}

function kpis(section) {
  const w = Math.floor(PAGE_WIDTH / section.items.length);
  return [
    ...heading(section.title),
    new Table({
      width: { size: PAGE_WIDTH, type: WidthType.DXA },
      columnWidths: section.items.map(() => w),
      borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: { style: BorderStyle.SINGLE, size: 24, color: "FFFFFF" } },
      rows: [
        new TableRow({
          children: section.items.map((k) => {
            const t = TONE[k.tone] || TONE.mute;
            return new TableCell({
              shading: shade(t.fill),
              borders: { left: { style: BorderStyle.SINGLE, size: 24, color: t.text }, top: none, bottom: none, right: none },
              margins: { top: 140, bottom: 140, left: 180, right: 120 },
              children: [
                para(run(k.value, { size: 34, bold: true, color: t.text })),
                para(run(k.label, { size: 17, bold: true }), { before: 40 }),
                para(run(k.note || "", { size: 15, color: MUTED })),
              ],
            });
          }),
        }),
      ],
    }),
  ];
}

function table(section) {
  const total = section.columns.reduce((t, c) => t + (c.width || 10), 0);
  const widths = section.columns.map((c) => Math.floor(((c.width || 10) / total) * PAGE_WIDTH));
  const rows = section.rows.slice(0, DOC_ROW_LIMIT);
  const align = (c) => (c.align === "center" ? AlignmentType.CENTER : AlignmentType.LEFT);
  const head = new TableRow({
    tableHeader: true,
    children: section.columns.map(
      (c) =>
        new TableCell({
          shading: shade(NAVY),
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [para(run(c.label, { size: 15, bold: true, color: "FFFFFF" }), { align: align(c) })],
        }),
    ),
  });
  const body = rows.map(
    (row, i) =>
      new TableRow({
        cantSplit: true,
        children: section.columns.map((c) => {
          const tone = cellTone(row[c.key]);
          return new TableCell({
            shading: shade(tone ? TONE[tone].fill : i % 2 ? BAND : "FFFFFF"),
            margins: { top: 50, bottom: 50, left: 80, right: 80 },
            children: [para(run(cellText(row[c.key]), { size: 15, bold: !!tone, color: tone ? TONE[tone].text : INK }), { align: align(c) })],
          });
        }),
      }),
  );
  const out = [
    ...heading(section.title, section.subtitle),
    new Table({
      width: { size: PAGE_WIDTH, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      columnWidths: widths,
      borders: { top: thin, bottom: thin, left: thin, right: thin, insideHorizontal: thin, insideVertical: thin },
      rows: [head, ...body],
    }),
  ];
  if (!section.rows.length) out.push(para(run("None.", { color: MUTED, italics: true }), { before: 80 }));
  if (section.rows.length > rows.length)
    out.push(para(run(`Showing the first ${rows.length} of ${section.rows.length} rows. The Excel workbook has the full list.`, { size: 16, color: MUTED, italics: true }), { before: 80 }));
  return out;
}

/** Render the report model as a .docx Blob. */
export async function reportToDocx(model) {
  const children = [banner(model)];
  for (const s of model.sections) {
    if (s.type === "kpis") children.push(...kpis(s));
    else if (s.type === "text") children.push(para(run(s.text, { size: 20 }), { before: 200 }));
    else if (s.type === "table") children.push(...table(s));
  }
  children.push(...heading("About this report"));
  for (const a of model.about) children.push(para(run(a, { size: 16, color: MUTED }), { after: 80 }));
  const doc = new Document({
    creator: model.app,
    title: model.title,
    description: model.subtitle,
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.LANDSCAPE },
            margin: { top: 850, bottom: 850, left: 850, right: 850 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              para([
                run(`${model.app} · ${model.dateLabel}      `, { size: 15, color: MUTED }),
                new TextRun({ font: FONT, size: 15, color: MUTED, children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES] }),
              ]),
            ],
          }),
        },
        children,
      },
    ],
  });
  return Packer.toBlob(doc);
}
