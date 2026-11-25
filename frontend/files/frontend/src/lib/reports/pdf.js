// The PDF, laid out directly with pdf-lib: A4 landscape, a branded title block, KPI tiles, tables that wrap their
// text and repeat the header row across pages, status cells in the on-screen colours, and a footer with the date
// and page numbers. The standard Helvetica fonts only encode Western characters, so text is cleaned first (the
// report wording avoids symbols such as ≥ already).
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { columnsFor, rowsFor } from "@/lib/reports/model.mjs";
import { num } from "@/lib/reports/text.mjs";

const PAGE = [841.89, 595.28];
const M = 36;
const hex = (h) => rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
const BLUE = hex("2E3569");
const GREY = hex("5A5F80");
const INK = hex("1F2330");
const LINE = hex("D6DAE8");
const ZEBRA = hex("F6F7FB");
const WHITE = rgb(1, 1, 1);
const TONE = { good: ["E2F2E3", "2F7D37"], warn: ["FDEEDB", "B45F06"], bad: ["FDE4E0", "C9301E"], info: ["E6E8F3", "2E3569"], mute: ["ECEEF6", "5A5F80"] };

const SWAP = { "≥": ">=", "≤": "<=", "→": "to", "−": "-", "‑": "-", "\u00a0": " ", "\u202f": " ", "‐": "-", "✓": "", "•": "-" };

class Pdf {
  constructor(doc, regular, bold, italic) {
    this.doc = doc;
    this.f = { regular, bold, italic };
    this.page = null;
    this.y = 0;
    this.safe = new Map();
  }
  clean(text, font) {
    const s = String(text ?? "");
    const key = `${font.name}|${s}`;
    if (this.safe.has(key)) return this.safe.get(key);
    let out = "";
    for (const ch of s) {
      const c = SWAP[ch] ?? ch;
      try {
        font.encodeText(c);
        out += c;
      } catch {
        out += "?";
      }
    }
    this.safe.set(key, out);
    return out;
  }
  width(text, font, size) {
    return font.widthOfTextAtSize(this.clean(text, font), size);
  }
  /** Break text into lines that fit maxWidth. */
  wrap(text, font, size, maxWidth) {
    const lines = [];
    for (const para of String(text ?? "").split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        let w = word;
        while (this.width(w, font, size) > maxWidth) {
          let cut = w.length - 1;
          while (cut > 1 && this.width(w.slice(0, cut), font, size) > maxWidth) cut--;
          if (line) { lines.push(line); line = ""; }
          lines.push(w.slice(0, cut));
          w = w.slice(cut);
        }
        const tryLine = line ? `${line} ${w}` : w;
        if (this.width(tryLine, font, size) <= maxWidth) line = tryLine;
        else { lines.push(line); line = w; }
      }
      lines.push(line);
    }
    return lines.length ? lines : [""];
  }
  newPage() {
    this.page = this.doc.addPage(PAGE);
    this.y = PAGE[1] - M;
    return this.page;
  }
  need(h) {
    if (!this.page || this.y - h < M + 14) { this.newPage(); return true; }
    return false;
  }
  text(s, x, y, { font = this.f.regular, size = 9, color = INK } = {}) {
    this.page.drawText(this.clean(s, font), { x, y, size, font, color });
  }
  rect(x, y, w, h, fill, border) {
    this.page.drawRectangle({ x, y, width: w, height: h, color: fill, borderColor: border, borderWidth: border ? 0.5 : 0 });
  }
}

function titleBlock(p, report) {
  p.newPage();
  const h = 96;
  p.rect(M, p.y - h, PAGE[0] - 2 * M, h, BLUE);
  const lines = p.wrap(report.title, p.f.bold, 22, PAGE[0] - 2 * M - 40);
  let y = p.y - 34;
  for (const l of lines) { p.text(l, M + 20, y, { font: p.f.bold, size: 22, color: WHITE }); y -= 26; }
  p.text(report.scopeLine, M + 20, y - 2, { size: 11, color: hex("E6E8F3") });
  p.text(report.subtitle, M + 20, y - 18, { size: 9, color: hex("C8CCE6") });
  p.y -= h + 18;
}

function heading(p, text) {
  p.need(60);
  p.y -= 8;
  p.text(text, M, p.y - 14, { font: p.f.bold, size: 15, color: BLUE });
  p.page.drawLine({ start: { x: M, y: p.y - 20 }, end: { x: PAGE[0] - M, y: p.y - 20 }, thickness: 0.75, color: LINE });
  p.y -= 32;
}

function paragraph(p, text, { size = 10, color = INK, font = p.f.regular, gap = 8 } = {}) {
  const lines = p.wrap(text, font, size, PAGE[0] - 2 * M);
  for (const l of lines) {
    p.need(size + 4);
    p.text(l, M, p.y - size, { font, size, color });
    p.y -= size + 4;
  }
  p.y -= gap;
}

function kpis(p, block) {
  const n = block.items.length;
  const gap = 8;
  const w = (PAGE[0] - 2 * M - gap * (n - 1)) / n;
  const h = 62;
  p.need(h + 12);
  block.items.forEach((k, i) => {
    const [fill, color] = TONE[k.tone] || TONE.mute;
    const x = M + i * (w + gap);
    p.rect(x, p.y - h, w, h, hex(fill));
    p.rect(x, p.y - h, 3, h, hex(color));
    p.text(k.value, x + 12, p.y - 26, { font: p.f.bold, size: 20, color: hex(color) });
    p.text(k.label, x + 12, p.y - 40, { font: p.f.bold, size: 8.5 });
    const sub = p.wrap(k.sub || "", p.f.regular, 7.5, w - 20)[0];
    p.text(sub, x + 12, p.y - 52, { size: 7.5, color: GREY });
  });
  p.y -= h + 14;
}

function facts(p, block) {
  const a = 120;
  for (const f of block.items) {
    const lines = p.wrap(f.value, p.f.regular, 9.5, PAGE[0] - 2 * M - a);
    p.need(lines.length * 13 + 4);
    p.text(f.label, M, p.y - 10, { font: p.f.bold, size: 9.5, color: GREY });
    lines.forEach((l, i) => p.text(l, M + a, p.y - 10 - i * 13, { size: 9.5 }));
    p.y -= lines.length * 13 + 3;
  }
  p.y -= 8;
}

function drawTable(p, block) {
  const columns = columnsFor(block, "pdf");
  const { rows, hidden } = rowsFor(block, "pdf");
  const total = columns.reduce((a, c) => a + c.w, 0);
  const full = PAGE[0] - 2 * M;
  const widths = columns.map((c) => (c.w / total) * full);
  const size = 7.8;
  const lh = 10;
  const pad = 4;
  const right = (c) => c.kind === "num" || c.kind === "year" || c.kind === "pct";
  const show = (c, v) => (c.kind === "pct" ? `${Math.round(v * 100)}%` : c.kind === "num" && typeof v === "number" ? num(v) : String(v ?? ""));

  if (block.title) {
    p.need(46);
    p.text(block.title, M, p.y - 12, { font: p.f.bold, size: 11, color: BLUE });
    p.y -= 22;
  }
  if (!rows.length) {
    paragraph(p, block.empty || "Nothing to show.", { font: p.f.italic, color: GREY });
    return;
  }
  const headLines = columns.map((c, i) => p.wrap(c.label, p.f.bold, size, widths[i] - 2 * pad));
  const headH = Math.max(...headLines.map((l) => l.length)) * lh + 2 * pad;
  const drawHeader = () => {
    p.rect(M, p.y - headH, full, headH, BLUE);
    let x = M;
    columns.forEach((c, i) => {
      headLines[i].forEach((l, k) => {
        const tx = right(c) ? x + widths[i] - pad - p.width(l, p.f.bold, size) : x + pad;
        p.text(l, tx, p.y - pad - size - k * lh + 1, { font: p.f.bold, size, color: WHITE });
      });
      x += widths[i];
    });
    p.y -= headH;
  };
  p.need(headH + 40);
  drawHeader();
  rows.forEach((row, r) => {
    const cells = columns.map((c, i) => p.wrap(show(c, row[c.key]), (c.kind === "tone" || c.tone) && row[`${c.key}_tone`] ? p.f.bold : p.f.regular, size, widths[i] - 2 * pad));
    const h = Math.max(...cells.map((l) => l.length)) * lh + 2 * pad;
    if (p.y - h < M + 14) {
      p.newPage();
      drawHeader();
    }
    p.rect(M, p.y - h, full, h, r % 2 ? ZEBRA : WHITE);
    let x = M;
    columns.forEach((c, i) => {
      const toneKey = row[`${c.key}_tone`];
      const tone = (c.kind === "tone" || c.tone) && toneKey ? TONE[toneKey] : null;
      if (tone) p.rect(x, p.y - h, widths[i], h, hex(tone[0]));
      cells[i].forEach((l, k) => {
        const f = tone ? p.f.bold : p.f.regular;
        const tx = right(c) ? x + widths[i] - pad - p.width(l, f, size) : x + pad;
        p.text(l, tx, p.y - pad - size - k * lh + 1, { font: f, size, color: tone ? hex(tone[1]) : INK });
      });
      x += widths[i];
    });
    p.page.drawLine({ start: { x: M, y: p.y - h }, end: { x: M + full, y: p.y - h }, thickness: 0.4, color: LINE });
    p.y -= h;
  });
  p.y -= 6;
  if (hidden) paragraph(p, `Showing the first ${rows.length} of ${rows.length + hidden} rows. The Excel workbook has the full list.`, { size: 8, font: p.f.italic, color: GREY });
  p.y -= 8;
}

/** The PDF as bytes (a Uint8Array). */
export async function renderPdf(report) {
  const doc = await PDFDocument.create();
  doc.setTitle(report.title);
  doc.setAuthor("Venue Compliance Hub");
  doc.setCreator("Venue Compliance Hub");
  const p = new Pdf(doc, await doc.embedFont(StandardFonts.Helvetica), await doc.embedFont(StandardFonts.HelveticaBold), await doc.embedFont(StandardFonts.HelveticaOblique));
  titleBlock(p, report);
  for (const section of report.sections) {
    heading(p, section.title);
    for (const b of section.blocks) {
      if (b.type === "kpis") kpis(p, b);
      else if (b.type === "facts") facts(p, b);
      else if (b.type === "text") paragraph(p, b.text, { size: 10.5 });
      else if (b.type === "note") paragraph(p, b.text, { size: 8.5, color: GREY, gap: 4 });
      else drawTable(p, b);
    }
  }
  const pages = doc.getPages();
  pages.forEach((page, i) => {
    page.drawText(p.clean(`Venue Compliance Hub · ${report.generatedText}`, p.f.regular), { x: M, y: 20, size: 7.5, font: p.f.regular, color: GREY });
    const label = p.clean(`Page ${i + 1} of ${pages.length}`, p.f.regular);
    page.drawText(label, { x: PAGE[0] - M - p.f.regular.widthOfTextAtSize(label, 7.5), y: 20, size: 7.5, font: p.f.regular, color: GREY });
  });
  return doc.save();
}
