// The Excel workbook, written directly as an Office Open XML package on top of JSZip (so it can be tested
// here without a spreadsheet library). One sheet per report section; tables have a styled header row, a
// frozen header and filters where the sheet has a single table; status cells carry the same colours as on screen.
import JSZip from "jszip";
import { sheetsOf } from "@/lib/reports/sheets.mjs";

const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
const colName = (n) => {
  let s = "";
  for (let i = n + 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
};
const TONES = {
  good: ["E2F2E3", "2F7D37"],
  warn: ["FDEEDB", "B45F06"],
  bad: ["FDE4E0", "C9301E"],
  info: ["E6E8F3", "2E3569"],
  mute: ["ECEEF6", "5A5F80"],
};
const BLUE = "2E3569";

function styleBook() {
  const fonts = [];
  const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  const borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
  const xfs = [];
  const idx = (list, xml) => {
    const i = list.indexOf(xml);
    if (i >= 0) return i;
    list.push(xml);
    return list.length - 1;
  };
  const line = '<border><left style="thin"><color rgb="FFD6DAE8"/></left><right style="thin"><color rgb="FFD6DAE8"/></right><top style="thin"><color rgb="FFD6DAE8"/></top><bottom style="thin"><color rgb="FFD6DAE8"/></bottom><diagonal/></border>';
  const get = ({ b = false, i = false, sz = 10, color = "1F2330", fill = null, h = null, v = "top", wrap = false, border = false, fmt = 0 } = {}) => {
    const font = `<font>${b ? "<b/>" : ""}${i ? "<i/>" : ""}<sz val="${sz}"/><color rgb="FF${color}"/><name val="Arial"/><family val="2"/></font>`;
    const fillXml = fill ? `<fill><patternFill patternType="solid"><fgColor rgb="FF${fill}"/><bgColor indexed="64"/></patternFill></fill>` : null;
    const xf = `<xf numFmtId="${fmt}" fontId="${idx(fonts, font)}" fillId="${fillXml ? idx(fills, fillXml) : 0}" borderId="${border ? idx(borders, line) : 0}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment${h ? ` horizontal="${h}"` : ""} vertical="${v}"${wrap ? ' wrapText="1"' : ""}/></xf>`;
    return idx(xfs, xf);
  };
  get(); // index 0 is the default
  const xml = () =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="${fonts.length}">${fonts.join("")}</fonts><fills count="${fills.length}">${fills.join("")}</fills><borders count="${borders.length}">${borders.join("")}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return { get, xml };
}

const text = (ref, s, style) => `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(s)}</t></is></c>`;
const number = (ref, n, style) => `<c r="${ref}" s="${style}"><v>${n}</v></c>`;
const blank = (ref, style) => `<c r="${ref}" s="${style}"/>`;

function sheetXml(sheet, index, report, st) {
  const tables = sheet.blocks.filter((b) => b.type === "table");
  const cols = Math.max(4, ...tables.map((t) => t.columns.length));
  const widths = Array(cols).fill(10);
  for (const t of tables)
    t.columns.forEach((c, j) => {
      const sample = t.rows.slice(0, 200).map((r) => String(r[c.key] ?? "").length);
      const longest = Math.max(c.label.length + 3, ...sample, 6);
      widths[j] = Math.max(widths[j], Math.min(longest + 2, c.kind === "year" || c.kind === "num" || c.kind === "pct" ? 16 : 56));
    });

  const rows = [];
  const merges = [];
  let r = 1;
  const push = (cells, ht) => rows.push(`<row r="${r}"${ht ? ` ht="${ht}" customHeight="1"` : ""}>${cells.join("")}</row>`);

  if (index === 0) {
    push([text(`A${r}`, report.title, st.get({ b: true, sz: 16, color: BLUE, v: "center" }))], 26);
    merges.push(`A${r}:${colName(Math.min(cols, 8) - 1)}${r}`);
    r++;
    push([text(`A${r}`, report.subtitle, st.get({ color: "5A5F80" }))]);
    r++;
    push([text(`A${r}`, report.scopeLine, st.get({ color: "5A5F80" }))]);
    r += 2;
  }
  let freeze = null;
  let filter = null;
  const singleTable = tables.length === 1 && index > 0; // the Summary sheet keeps its small tables plain
  for (const b of sheet.blocks) {
    if (b.type === "text") {
      const span = Math.min(cols, 8);
      const chars = widths.slice(0, span).reduce((a, w) => a + w, 0) * 1.05;
      const lines = Math.max(1, Math.ceil(b.text.length / chars));
      push([text(`A${r}`, b.text, st.get({ wrap: true, i: b.note, color: b.note ? "5A5F80" : "1F2330" }))], Math.max(15, lines * 13.5));
      merges.push(`A${r}:${colName(span - 1)}${r}`);
      r += 2;
      continue;
    }
    if (b.title) {
      push([text(`A${r}`, b.title, st.get({ b: true, sz: 11, color: BLUE }))], 20);
      r++;
    }
    const header = r;
    push(b.columns.map((c, j) => text(`${colName(j)}${r}`, c.label, st.get({ b: true, color: "FFFFFF", fill: BLUE, wrap: true, v: "center", border: true, h: c.kind === "num" || c.kind === "year" || c.kind === "pct" ? "right" : null }))), 22);
    r++;
    const first = r;
    if (!b.rows.length) {
      push([text(`A${r}`, b.empty || "Nothing to show.", st.get({ i: true, color: "5A5F80" }))]);
      r++;
    }
    for (const row of b.rows) {
      push(
        b.columns.map((c, j) => {
          const ref = `${colName(j)}${r}`;
          const v = row[c.key];
          const tone = (c.kind === "tone" || c.tone || c.key === "value") && row[`${c.key}_tone`] ? TONES[row[`${c.key}_tone`]] : null;
          const base = { border: true, wrap: true, fill: tone ? tone[0] : null, color: tone ? tone[1] : "1F2330", b: !!tone };
          if (v === "" || v == null) return blank(ref, st.get({ ...base }));
          if ((c.kind === "num" || c.kind === "year" || c.kind === "pct") && typeof v === "number")
            return number(ref, v, st.get({ ...base, h: "right", fmt: c.kind === "pct" ? 9 : c.kind === "year" ? 1 : 3 }));
          return text(ref, v, st.get({ ...base, h: c.kind === "num" || c.kind === "pct" ? "right" : null }));
        }),
      );
      r++;
    }
    if (singleTable && b.rows.length) {
      freeze = header;
      filter = `A${header}:${colName(b.columns.length - 1)}${r - 1}`;
    }
    void first;
    r++;
  }
  const view = freeze
    ? `<sheetView workbookViewId="0" showGridLines="0"${index === 0 ? ' tabSelected="1"' : ""}><pane ySplit="${freeze}" topLeftCell="A${freeze + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/></sheetView>`
    : `<sheetView workbookViewId="0" showGridLines="0"${index === 0 ? ' tabSelected="1"' : ""}/>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews>${view}</sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${widths.map((w, j) => `<col min="${j + 1}" max="${j + 1}" width="${w.toFixed(1)}" customWidth="1"/>`).join("")}</cols><sheetData>${rows.join("")}</sheetData>${filter ? `<autoFilter ref="${filter}"/>` : ""}${merges.length ? `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : ""}<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup orientation="landscape" fitToHeight="0"/></worksheet>`;
}

/** The workbook as bytes (a Uint8Array). */
export async function renderXlsx(report) {
  const sheets = sheetsOf(report);
  const st = styleBook();
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
  zip.file("docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(report.title)}</dc:title><dc:creator>Venue Compliance Hub</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${report.generatedIso}T00:00:00Z</dcterms:created></cp:coreProperties>`);
  zip.file("docProps/app.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Venue Compliance Hub</Application></Properties>`);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  sheets.forEach((s, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s, i, report, st)));
  zip.file("xl/styles.xml", st.xml()); // after the sheets: styles are registered while they are written
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
