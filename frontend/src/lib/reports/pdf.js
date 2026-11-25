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

async function fifaCover(p, report) {
  const response = await fetch("/reports/fifa-compliance-report-cover.png");
  if (!response.ok) throw new Error("The FIFA cover image could not be loaded.");
  const coverImage = await p.doc.embedPng(await response.arrayBuffer());
  const cover = p.doc.addPage([coverImage.width, coverImage.height]);
  cover.drawImage(coverImage, { x: 0, y: 0, width: coverImage.width, height: coverImage.height });
  cover.drawText(p.clean("FIFA Compliance Report", p.f.bold), { x: 72, y: 242, size: 27, font: p.f.bold, color: WHITE });
  cover.drawText(p.clean(report.coverSubject || "Saudi Arabia · All stadiums", p.f.regular), { x: 72, y: 208, size: 15, font: p.f.regular, color: WHITE });
}

function fifaHeader(p, title, subtitle) {
  p.newPage();
  p.rect(M, p.y - 58, PAGE[0] - 2 * M, 58, BLUE);
  p.text("FIFA", M + 18, p.y - 24, { font: p.f.bold, size: 17, color: WHITE });
  p.text(title, M + 92, p.y - 24, { font: p.f.bold, size: 17, color: WHITE });
  p.text(subtitle, M + 92, p.y - 42, { size: 8.5, color: hex("E6E8F3") });
  p.y -= 78;
}

function fifaCard(p, x, y, w, h, label, value, detail, tone = "2E3569") {
  p.rect(x, y - h, w, h, WHITE, hex("D6DAE8"));
  p.rect(x, y - h, 4, h, hex(tone));
  p.text(label, x + 14, y - 19, { font: p.f.bold, size: 8.5, color: GREY });
  p.text(value, x + 14, y - 43, { font: p.f.bold, size: 22, color: hex(tone) });
  if (detail) p.text(detail, x + 14, y - h + 14, { size: 8, color: GREY });
}

function fifaVisualPages(p, report) {
  const v = report.fifaVisuals || {};
  fifaHeader(p, "Programme overview", "A visual copy of the Venue Compliance Hub Overview page");
  const gap = 12;
  const w = (PAGE[0] - 2 * M - gap * 3) / 4;
  [
    ["Stadium portfolio", String(v.stadiums || 0), "venues in the programme", "2E3569"],
    ["Open findings", String(v.alerts || 0), "alerts requiring attention", "C9301E"],
    ["Requirement watch", String(v.watchChanges || 0), "tracked requirement changes", "B45F06"],
    ["Assurance view", "FIFA", "reviewer-led compliance position", "2F7D37"],
  ].forEach((card, i) => fifaCard(p, M + i * (w + gap), p.y, w, 82, ...card));
  p.y -= 108;
  p.text("National programme status", M, p.y, { font: p.f.bold, size: 14, color: BLUE });
  p.y -= 20;
  p.rect(M, p.y - 220, PAGE[0] - 2 * M, 220, hex("F6F7FB"), hex("D6DAE8"));
  p.text("Map view", M + 18, p.y - 24, { font: p.f.bold, size: 12, color: INK });
  p.text("Host cities and stadium readiness", M + 18, p.y - 40, { size: 9, color: GREY });
  const mapX = M + 190;
  const mapY = p.y - 56;
  p.page.drawEllipse({ x: mapX + 120, y: mapY - 70, xScale: 150, yScale: 82, color: hex("E6E8F3"), borderColor: hex("B8BED4"), borderWidth: 1 });
  [[80, 45, "2F7D37"], [145, 88, "B45F06"], [210, 35, "C9301E"], [270, 104, "2E3569"]].forEach(([dx, dy, color]) => p.page.drawCircle({ x: mapX + dx, y: mapY - dy, size: 7, color: hex(color), borderColor: WHITE, borderWidth: 2 }));
  p.text("Map and portfolio views connect programme-level status to each stadium page.", M + 18, p.y - 196, { size: 9, color: GREY });
  p.y -= 252;

  fifaHeader(p, "3D design review", "A visual copy of the King Salman International Stadium model review");
  const d = v.design;
  fifaCard(p, M, p.y, 180, 82, "Model revision", d?.revision ? `Rev ${d.revision}` : "Rev C", "design-freeze package", "2E3569");
  fifaCard(p, M + 192, p.y, 180, 82, "Checks passed", String(d?.pass || 0), "model checks accepted", "2F7D37");
  fifaCard(p, M + 384, p.y, 180, 82, "Checks failed", String(d?.fail || 0), "findings to resolve", "C9301E");
  fifaCard(p, M + 576, p.y, 180, 82, "Needs review", String(d?.review || 0), "reviewer judgement", "B45F06");
  p.y -= 112;
  p.rect(M, p.y - 270, PAGE[0] - 2 * M, 270, hex("15183A"), hex("2E3569"));
  p.text("King Salman International Stadium", M + 20, p.y - 28, { font: p.f.bold, size: 15, color: WHITE });
  p.text("3D model · design review · critical areas", M + 20, p.y - 48, { size: 9, color: hex("C8CCE6") });
  p.page.drawEllipse({ x: M + 420, y: p.y - 145, xScale: 190, yScale: 74, color: hex("2E3569"), borderColor: hex("6FE3D2"), borderWidth: 2 });
  p.page.drawEllipse({ x: M + 420, y: p.y - 145, xScale: 130, yScale: 44, color: hex("15183A"), borderColor: hex("6FE3D2"), borderWidth: 1 });
  p.text("The model links design findings to FIFA requirements and site conditions.", M + 20, p.y - 244, { size: 9, color: hex("C8CCE6") });
  p.y -= 302;

  fifaHeader(p, "Requirement watch", "A visual copy of the FIFA requirement-watch view");
  fifaCard(p, M, p.y, 230, 82, "Tracked changes", String(v.watchChanges || 0), "requirements under watch", "B45F06");
  fifaCard(p, M + 242, p.y, 230, 82, "Impact review", "Open", "preview before applying changes", "2E3569");
  fifaCard(p, M + 484, p.y, 285, 82, "Decision rule", "Human review", "nothing changes in the register until confirmed", "2F7D37");
  p.y -= 112;
  p.rect(M, p.y - 190, PAGE[0] - 2 * M, 190, WHITE, hex("D6DAE8"));
  p.text("FIFA requirement watch", M + 18, p.y - 25, { font: p.f.bold, size: 14, color: BLUE });
  ["Extracted requirement", "Affected stadiums and requirement families", "Projected readiness effect", "Owner alerts and due dates"].forEach((line, i) => p.text(line, M + 18, p.y - 58 - i * 30, { font: p.f.bold, size: 10, color: GREY }));
}

function heading(p, text, firstBlock) {
  // a heading moves to the next page together with a small table that follows it
  const w = firstBlock && firstBlock.type === "table" ? wholeTableHeight(p, firstBlock) : 0;
  p.need(w > 0 && w <= 340 ? 60 + w + (firstBlock.title ? 30 : 0) : 60);
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

/** The height of a whole table in the PDF, used to keep a table that fits on one page together (0 for an empty table). */
function wholeTableHeight(p, block) {
  const columns = columnsFor(block, "pdf");
  const { rows } = rowsFor(block, "pdf");
  if (!rows.length) return 0;
  const total = columns.reduce((a, c) => a + c.w, 0);
  const widths = columns.map((c) => (c.w / total) * (PAGE[0] - 2 * M));
  const size = 7.8;
  const lh = 10;
  const pad = 4;
  const show = (c, v) => (c.kind === "pct" ? `${Math.round(v * 100)}%` : c.kind === "num" && typeof v === "number" ? num(v) : String(v ?? ""));
  const head = Math.max(...columns.map((c, i) => p.wrap(c.label, p.f.bold, size, widths[i] - 2 * pad).length)) * lh + 2 * pad;
  return head + rows.reduce((t, row) => t + Math.max(...columns.map((c, i) => p.wrap(show(c, row[c.key]), p.f.regular, size, widths[i] - 2 * pad).length)) * lh + 2 * pad, 0);
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

  // A table that fits on one page stays together: if the space left is too small it starts on the next page.
  const whole = wholeTableHeight(p, block);
  const keep = whole > 0 && whole <= 340 ? whole + (block.title ? 30 : 0) : 46;
  if (block.title) {
    p.need(keep);
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
  p.need(Math.max(headH + 40, block.title ? 0 : keep));
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
  if (report.kind === "fifa") {
    await fifaCover(p, report);
    fifaVisualPages(p, report);
  } else titleBlock(p, report);
  for (const section of report.sections) {
    heading(p, section.title, section.blocks[0]);
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
    const { width } = page.getSize();
    page.drawText(p.clean(`Venue Compliance Hub · ${report.generatedText}`, p.f.regular), { x: M, y: 20, size: 7.5, font: p.f.regular, color: GREY });
    const label = p.clean(`Page ${i + 1} of ${pages.length}`, p.f.regular);
    page.drawText(label, { x: width - M - p.f.regular.widthOfTextAtSize(label, 7.5), y: 20, size: 7.5, font: p.f.regular, color: GREY });
  });
  return doc.save();
}
